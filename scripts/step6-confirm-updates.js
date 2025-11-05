import prompts from 'prompts';
import { readJsonFile, writeJsonFile } from './utils/file-utils.js';

async function getAltTags() {
  return readJsonFile('alt-tags.json');
}

function truncateText(text, maxLength) {
  if (!text) return '';
  if (text.length <= maxLength) return text;
  return text.substring(0, maxLength - 3) + '...';
}

function formatChoice(altTag, index) {
  const altText = altTag.altText || '(brak ALT)';
  const url = altTag.url || '(brak URL)';
  const filename = altTag.filename || altTag.uid || 'unknown';
  const locale = altTag.locale || '';
  
  const truncatedAlt = truncateText(altText, 50);
  
  const title = `${index + 1}. ALT: "${truncatedAlt}" | Link: ${url} | ${filename}${locale ? ` (${locale})` : ''}`;
  
  return {
    title,
    value: index,
    selected: true,
  };
}

async function main() {
  try {
    const altTags = await getAltTags();
    const validAltTags = altTags.filter(item => item.altText && item.altText.trim());
    
    if (validAltTags.length === 0) {
      console.log('No images with ALT tags to update');
      return;
    }
    
    console.log(`\nFound ${validAltTags.length} images with generated ALT tags`);
    console.log('\nSelect images to update (use space to toggle, arrows to navigate):\n');
    
    const choices = validAltTags.map((altTag, index) => formatChoice(altTag, index));
    
    const response = await prompts({
      type: 'multiselect',
      name: 'selected',
      message: 'Select images to update:',
      choices,
      instructions: false,
      hint: 'Use space to select, arrows to navigate, Enter to confirm',
    });
    
    if (!response.selected || response.selected.length === 0) {
      console.log('\nNo images selected. Update cancelled.');
      return;
    }
    
    const selectedAltTags = response.selected.map(index => validAltTags[index]);
    
    const outputPath = writeJsonFile('alt-tags.json', selectedAltTags);
    
    console.log(`\n✓ Selected ${selectedAltTags.length}/${validAltTags.length} images to update`);
    console.log(`Results have been saved to ${outputPath}`);
    console.log('\nYou can now run step7 to update the selected images in Contentstack.');
  } catch (error) {
    if (error.name === 'ExitError' || error.message === 'User cancelled') {
      console.log('\nUpdate cancelled by user');
      process.exit(0);
    }
    console.error('Error:', error);
    process.exit(1);
  }
}

main();

