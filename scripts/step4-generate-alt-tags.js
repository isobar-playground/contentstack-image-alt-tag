import OpenAI from 'openai';
import dotenv from 'dotenv';
import { getStack, getEntryTitle } from './contentstack-client.js';
import { readJsonFile, writeJsonFile, readTextFile, getInstructionsPath, writeTextFile, createReadStream } from './utils/file-utils.js';
import { isDryRun } from './utils/arg-utils.js';

dotenv.config();

const {
  OPENAI_API_KEY,
  OPENAI_MODEL,
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

async function getFilteredImages() {
  const data = readJsonFile('filtered-images.json');
  return data.images || [];
}

async function getInstructions() {
  return readTextFile(getInstructionsPath());
}

function addResizeParams(url) {
  try {
    const urlObj = new URL(url);
    urlObj.searchParams.set('height', '720');
    urlObj.searchParams.set('fit', 'scale-down');
    urlObj.searchParams.set('quality', '85');
    return urlObj.toString();
  } catch (error) {
    return url;
  }
}

async function fetchImageAsBase64(imageUrl) {
  try {
    const resizedUrl = addResizeParams(imageUrl);
    const response = await fetch(resizedUrl);
    if (!response.ok) {
      throw new Error(`Failed to fetch image: ${response.statusText}`);
    }
    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const base64Image = buffer.toString('base64');
    
    const contentType = response.headers.get('content-type') || 'image/jpeg';
    return {
      base64: base64Image,
      mimeType: contentType,
    };
  } catch (error) {
    throw new Error(`Error fetching image: ${error.message}`);
  }
}

async function buildUsageContext(stack, image) {
  if (!image.usages || image.usages.length === 0) {
    return null;
  }

  const usageContexts = [];
  const entryCache = {};

  for (const usage of image.usages) {
    const cacheKey = `${usage.contentTypeUid}:${usage.entryUid}:${usage.locale}`;
    
    if (!entryCache[cacheKey]) {
      entryCache[cacheKey] = await getEntryTitle(
        stack,
        usage.contentTypeUid,
        usage.entryUid,
        usage.locale
      );
    }

    const entryTitle = entryCache[cacheKey];
    const contentTypeTitle = usage.contentTypeTitle || usage.contentTypeUid;
    
    usageContexts.push(`Used in content type ${contentTypeTitle} named ${entryTitle}`);
  }

  return usageContexts.join('. ');
}

async function prepareBatchRequests(images, instructions, stack) {
  const requests = [];
  const imageMetadata = [];

  for (let i = 0; i < images.length; i++) {
    const image = images[i];
    console.log(`\n[${i + 1}/${images.length}] Preparing request for: ${image.filename || image.uid}`);
    
    const usageContext = await buildUsageContext(stack, image);
    
    if (usageContext) {
      console.log(`  Context: ${usageContext}`);
    }

    try {
      const imageData = await fetchImageAsBase64(image.url);
      
      let userMessage = 'Generate an ALT tag for this image.';
      if (image.localeName) {
        userMessage += `\n\nGenerate the ALT tag in the language: ${image.localeName}`;
      }
      if (usageContext) {
        userMessage += `\n\nContext: ${usageContext}`;
      }

      const request = {
        custom_id: `image-${image.uid}-${i}`,
        method: 'POST',
        url: '/v1/chat/completions',
        body: {
          model: OPENAI_MODEL || 'gpt-4o',
          messages: [
            {
              role: 'system',
              content: instructions,
            },
            {
              role: 'user',
              content: [
                {
                  type: 'text',
                  text: userMessage,
                },
                {
                  type: 'image_url',
                  image_url: {
                    url: `data:${imageData.mimeType};base64,${imageData.base64}`,
                  },
                },
              ],
            },
          ],
          max_tokens: 150,
          temperature: 0.7,
        },
      };

      requests.push(request);
      imageMetadata.push({
        customId: request.custom_id,
        uid: image.uid,
        filename: image.filename,
        url: image.url,
        locale: image.locale,
      });

      console.log(`  Prepared request with custom_id: ${request.custom_id}`);
    } catch (error) {
      console.error(`  Error preparing request for image ${image.uid}:`, error.message);
      imageMetadata.push({
        customId: null,
        uid: image.uid,
        filename: image.filename,
        url: image.url,
        locale: image.locale,
        error: error.message,
      });
    }
  }

  return { requests, imageMetadata };
}

function createJsonlFile(requests) {
  const lines = requests.map(req => JSON.stringify(req));
  const content = lines.join('\n') + '\n';
  const jsonlPath = writeTextFile('batch-requests.jsonl', content);
  return jsonlPath;
}

async function uploadFile(filename) {
  const file = await openai.files.create({
    file: createReadStream(filename),
    purpose: 'batch',
  });
  return file.id;
}

async function createBatch(fileId) {
  const batch = await openai.batches.create({
    input_file_id: fileId,
    endpoint: '/v1/chat/completions',
    completion_window: '24h',
  });
  return batch.id;
}

async function main() {
  try {
    const dryRun = isDryRun();
    
    if (dryRun) {
      console.log('⚠️  DRY RUN MODE ENABLED - Batch API will be skipped');
      return;
    }
    
    const images = await getFilteredImages();
    console.log(`\nFound ${images.length} images to process`);
    
    const instructions = await getInstructions();
    const stack = getStack();
    
    console.log('\nPreparing batch requests...');
    const { requests, imageMetadata } = await prepareBatchRequests(images, instructions, stack);
    
    const validRequests = requests.filter((_, index) => imageMetadata[index].customId !== null);
    console.log(`\nPrepared ${validRequests.length}/${images.length} valid requests`);
    
    if (validRequests.length === 0) {
      console.error('No valid requests to process');
      process.exit(1);
    }
    
    console.log('\nCreating JSONL file...');
    const jsonlPath = createJsonlFile(validRequests);
    console.log(`JSONL file created: ${jsonlPath}`);
    
    console.log('\nUploading file to OpenAI...');
    const fileId = await uploadFile('batch-requests.jsonl');
    console.log(`File uploaded with ID: ${fileId}`);
    
    console.log('\nCreating batch...');
    const batchId = await createBatch(fileId);
    console.log(`Batch created with ID: ${batchId}`);
    
    const batchInfo = {
      batchId,
      fileId,
      totalRequests: validRequests.length,
      createdAt: new Date().toISOString(),
      imageMetadata,
    };
    
    const batchInfoPath = writeJsonFile('batch-info.json', batchInfo);
    console.log(`\nBatch info saved to ${batchInfoPath}`);
    console.log(`\nBatch processing started. Run step5 to monitor the batch status.`);
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

main();
