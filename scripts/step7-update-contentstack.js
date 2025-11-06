import { getStack } from './contentstack-client.js';
import { readJsonFile, writeJsonFile } from './utils/file-utils.js';
import { isDryRun } from './utils/arg-utils.js';

async function getAltTags() {
  return readJsonFile('alt-tags.json');
}

async function updateAssetDescription(stack, assetUid, locale, description, dryRun = false) {
  try {
    if (dryRun) {
      return { success: true, dryRun: true };
    }
    
    const asset = await stack.asset(assetUid).fetch({ locale });
    
    const existingTags = asset.tags || [];
    const tagUids = existingTags.map(tag => typeof tag === 'string' ? tag : tag.uid || tag);
    const hasAiTag = tagUids.includes('ai description');
    
    asset.description = description;
    
    if (!hasAiTag) {
      asset.tags = [...tagUids, 'ai description'];
    }
    
    await asset.update({ locale });
    
    return { success: true };
  } catch (error) {
    console.error(`  Update error:`, error.message);
    return { success: false, error: error.message || String(error) };
  }
}

async function main() {
  try {
    const dryRun = isDryRun();
    
    if (dryRun) {
      console.log('\n🔍 DRY RUN MODE - No changes will be saved to Contentstack\n');
    }
    
    const altTags = await getAltTags();
    const validAltTags = altTags.filter(item => item.altText && item.altText.trim());
    
    console.log(`\nFound ${validAltTags.length} images with generated ALT tags to update`);
    
    if (validAltTags.length === 0) {
      console.log('No images to update');
      return;
    }
    
    const stack = getStack();
    const results = [];
    
    for (let i = 0; i < validAltTags.length; i++) {
      const item = validAltTags[i];
      const actionText = dryRun ? 'Would update' : 'Updating';
      console.log(`\n[${i + 1}/${validAltTags.length}] ${actionText}: ${item.filename || item.uid} (${item.locale})`);
      
      const result = await updateAssetDescription(stack, item.uid, item.locale, item.altText, dryRun);
      
      if (result.success) {
        const statusText = dryRun ? 'Would update ✓' : 'Updated ✓';
        console.log(`  ${statusText}`);
        console.log(`  Description: ${item.altText}`);
        results.push({
          uid: item.uid,
          filename: item.filename,
          locale: item.locale,
          altText: item.altText,
          success: true,
          dryRun: dryRun || false,
        });
      } else {
        console.log(`  ✗ Error: ${result.error}`);
        results.push({
          uid: item.uid,
          filename: item.filename,
          locale: item.locale,
          altText: item.altText,
          success: false,
          error: result.error,
          dryRun: dryRun || false,
        });
      }
      
      if (!dryRun) {
        await new Promise(resolve => setTimeout(resolve, 500));
      }
    }
    
    const outputPath = writeJsonFile('results.json', {
      dryRun,
      total: validAltTags.length,
      successful: results.filter(r => r.success).length,
      failed: results.filter(r => !r.success).length,
      results,
    });
    
    const successCount = results.filter(r => r.success).length;
    const actionText = dryRun ? 'Would update' : 'Updated';
    console.log(`\n${actionText} ${successCount}/${results.length} images`);
    console.log(`Results have been saved to ${outputPath}`);
    
    if (dryRun) {
      console.log('\n⚠️  This was a DRY RUN - no changes were made to Contentstack');
    }
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

main();

