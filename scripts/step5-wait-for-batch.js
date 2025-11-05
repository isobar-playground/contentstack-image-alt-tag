import OpenAI from 'openai';
import dotenv from 'dotenv';
import { readJsonFile, writeJsonFile } from './utils/file-utils.js';
import { isDryRun } from './utils/arg-utils.js';

dotenv.config();

const {
  OPENAI_API_KEY,
} = process.env;

let openai = null;

if (!isDryRun()) {
  if (!OPENAI_API_KEY) {
    console.error('Error: Required environment variable OPENAI_API_KEY');
    process.exit(1);
  }
  try {
    openai = new OpenAI({ apiKey: OPENAI_API_KEY });
  } catch (error) {
    console.error('Error: Failed to initialize OpenAI client:', error.message);
    process.exit(1);
  }
}

async function getBatchInfo() {
  return readJsonFile('batch-info.json');
}

async function checkBatchStatus(batchId) {
  const batch = await openai.batches.retrieve(batchId);
  return batch;
}

async function downloadResults(outputFileId) {
  const file = await openai.files.retrieveContent(outputFileId);
  return file;
}

function parseJsonl(content) {
  const lines = content.trim().split('\n');
  return lines.map(line => JSON.parse(line));
}

function calculateTokenUsage(batchResults) {
  let totalInputTokens = 0;
  let totalOutputTokens = 0;
  let totalTokens = 0;
  
  for (const result of batchResults) {
    if (result.response && result.response.body && result.response.body.usage) {
      const usage = result.response.body.usage;
      totalInputTokens += usage.prompt_tokens || 0;
      totalOutputTokens += usage.completion_tokens || 0;
      totalTokens += usage.total_tokens || 0;
    }
  }
  
  return {
    inputTokens: totalInputTokens,
    outputTokens: totalOutputTokens,
    totalTokens: totalTokens,
  };
}

function mapResultsToImages(batchResults, imageMetadata) {
  const resultsMap = new Map();
  
  for (const result of batchResults) {
    const customId = result.custom_id;
    if (customId && result.response) {
      const responseBody = result.response.body;
      if (responseBody && responseBody.choices && responseBody.choices.length > 0) {
        const altText = responseBody.choices[0]?.message?.content?.trim() || null;
        const usage = responseBody.usage || null;
        
        const tokens = usage ? {
          input: usage.prompt_tokens || 0,
          output: usage.completion_tokens || 0,
          total: usage.total_tokens || 0,
        } : null;
        
        resultsMap.set(customId, {
          altText,
          success: result.response.status_code === 200,
          error: result.response.status_code !== 200 ? `HTTP ${result.response.status_code}` : null,
          tokens,
        });
      } else {
        resultsMap.set(customId, {
          altText: null,
          success: false,
          error: 'Invalid response format',
          tokens: null,
        });
      }
    } else if (result.error) {
      const customId = result.custom_id;
      if (customId) {
        resultsMap.set(customId, {
          altText: null,
          success: false,
          error: result.error.message || 'Unknown error',
          tokens: null,
        });
      }
    }
  }
  
  const results = [];
  for (const metadata of imageMetadata) {
    if (metadata.customId === null) {
      results.push({
        uid: metadata.uid,
        filename: metadata.filename,
        url: metadata.url,
        locale: metadata.locale,
        altText: null,
        error: metadata.error || 'Failed to prepare request',
        tokens: null,
      });
    } else {
      const result = resultsMap.get(metadata.customId);
      if (result) {
        results.push({
          uid: metadata.uid,
          filename: metadata.filename,
          url: metadata.url,
          locale: metadata.locale,
          altText: result.altText,
          error: result.error,
          tokens: result.tokens,
        });
      } else {
        results.push({
          uid: metadata.uid,
          filename: metadata.filename,
          url: metadata.url,
          locale: metadata.locale,
          altText: null,
          error: 'Result not found in batch output',
          tokens: null,
        });
      }
    }
  }
  
  return results;
}

async function waitForAllBatchesCompletion(batchInfos) {
  const pollInterval = 30000;
  const batchStatuses = new Map();
  const completedBatches = new Set();
  
  for (const batchInfo of batchInfos) {
    batchStatuses.set(batchInfo.batchId, {
      ...batchInfo,
      status: null,
      lastStatus: null,
      batch: null,
    });
  }
  
  while (completedBatches.size < batchInfos.length) {
    const checkPromises = [];
    
    for (const batchInfo of batchInfos) {
      if (completedBatches.has(batchInfo.batchId)) {
        continue;
      }
      
      checkPromises.push(
        checkBatchStatus(batchInfo.batchId).then(batch => ({
          batchInfo,
          batch,
        }))
      );
    }
    
    const results = await Promise.all(checkPromises);
    
    for (const { batchInfo, batch } of results) {
      const status = batch.status;
      const statusData = batchStatuses.get(batchInfo.batchId);
      
      if (status !== statusData.lastStatus) {
        console.log(`\nBatch ${batchInfo.batchIndex}/${batchInfos.length} (${batchInfo.batchId}): ${status}`);
        statusData.lastStatus = status;
        
        if (batch.request_counts) {
          console.log(`  Total: ${batch.request_counts.total || 0}`);
          console.log(`  Completed: ${batch.request_counts.completed || 0}`);
          console.log(`  Failed: ${batch.request_counts.failed || 0}`);
        }
      }
      
      statusData.status = status;
      statusData.batch = batch;
      
      if (status === 'completed' || status === 'failed' || status === 'cancelled' || status === 'expired') {
        completedBatches.add(batchInfo.batchId);
      }
    }
    
    if (completedBatches.size < batchInfos.length) {
      console.log(`Waiting ${pollInterval / 1000} seconds before next check...`);
      await new Promise(resolve => setTimeout(resolve, pollInterval));
    }
  }
  
  return Array.from(batchStatuses.values()).map(statusData => ({
    ...statusData.batchInfo,
    batch: statusData.batch,
  }));
}

async function processBatchResults(batchData, imageMetadata) {
  const { batch, imageStartIndex, imageEndIndex } = batchData;
  const batchImageMetadata = imageMetadata.slice(imageStartIndex, imageEndIndex);
  let batchResults = [];
  let tokenUsage = null;
  
  if (batch.status === 'completed') {
    if (!batch.output_file_id) {
      throw new Error('Batch completed but no output file ID found');
    }
    
    console.log(`\nDownloading results for batch ${batchData.batchIndex}...`);
    const resultsContent = await downloadResults(batch.output_file_id);
    batchResults = parseJsonl(resultsContent);
    console.log(`Downloaded ${batchResults.length} results`);
    
    tokenUsage = calculateTokenUsage(batchResults);
    const results = mapResultsToImages(batchResults, batchImageMetadata);
    return { results, tokenUsage };
  } else if (batch.status === 'failed' || batch.status === 'cancelled' || batch.status === 'expired') {
    console.log(`\nBatch ${batchData.batchIndex} ended with status: ${batch.status}`);
    
    if (batch.output_file_id) {
      console.log('Partial results available, downloading...');
      try {
        const resultsContent = await downloadResults(batch.output_file_id);
        batchResults = parseJsonl(resultsContent);
        console.log(`Downloaded ${batchResults.length} partial results`);
        
        tokenUsage = calculateTokenUsage(batchResults);
        const results = mapResultsToImages(batchResults, batchImageMetadata);
        console.log('⚠️  Using partial results');
        return { results, tokenUsage };
      } catch (error) {
        console.error('Error downloading partial results:', error.message);
        throw new Error(`Batch ${batch.status} and no results available`);
      }
    } else {
      throw new Error(`Batch ${batch.status} and no results available`);
    }
  } else {
    throw new Error(`Unexpected batch status: ${batch.status}`);
  }
}

async function processAllBatchesResults(batchesData, imageMetadata) {
  const allResults = [];
  let totalTokenUsage = {
    inputTokens: 0,
    outputTokens: 0,
    totalTokens: 0,
  };
  
  for (const batchData of batchesData) {
    console.log(`\n${'='.repeat(60)}`);
    console.log(`Processing results for batch ${batchData.batchIndex}/${batchesData.length}`);
    console.log(`${'='.repeat(60)}`);
    
    const { results, tokenUsage } = await processBatchResults(batchData, imageMetadata);
    allResults.push(...results);
    
    if (tokenUsage) {
      totalTokenUsage.inputTokens += tokenUsage.inputTokens;
      totalTokenUsage.outputTokens += tokenUsage.outputTokens;
      totalTokenUsage.totalTokens += tokenUsage.totalTokens;
    }
  }
  
  return { results: allResults, tokenUsage: totalTokenUsage };
}

async function main() {
  try {
    const dryRun = isDryRun();
    
    if (dryRun) {
      console.log('⚠️  DRY RUN MODE ENABLED - Batch monitoring will be skipped');
      return;
    }
    
    console.log('Loading batch information...');
    const batchInfo = await getBatchInfo();
    
    if (!batchInfo.batches || !Array.isArray(batchInfo.batches) || batchInfo.batches.length === 0) {
      console.error('Error: batch-info.json does not contain batches array');
      process.exit(1);
    }
    
    if (!batchInfo.imageMetadata) {
      console.error('Error: batch-info.json does not contain imageMetadata');
      process.exit(1);
    }
    
    const batches = batchInfo.batches;
    const imageMetadata = batchInfo.imageMetadata;
    
    console.log(`\nMonitoring ${batches.length} batches`);
    console.log(`Total requests: ${batchInfo.totalRequests || 'unknown'}`);
    console.log(`Total images: ${batchInfo.totalImages || imageMetadata.length}`);
    
    const batchesData = await waitForAllBatchesCompletion(batches);
    
    console.log('\nProcessing batch results...');
    const { results, tokenUsage } = await processAllBatchesResults(batchesData, imageMetadata);
    
    const outputPath = writeJsonFile('alt-tags.json', results);
    
    const successCount = results.filter(r => r.altText).length;
    console.log(`\n${'='.repeat(60)}`);
    console.log(`Generated ALT for ${successCount}/${results.length} images`);
    console.log(`Results have been saved to ${outputPath}`);
    
    if (tokenUsage) {
      console.log('\n📊 Total Token Usage:');
      console.log(`  Input tokens: ${tokenUsage.inputTokens.toLocaleString()}`);
      console.log(`  Output tokens: ${tokenUsage.outputTokens.toLocaleString()}`);
      console.log(`  Total tokens: ${tokenUsage.totalTokens.toLocaleString()}`);
    }
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

main();

