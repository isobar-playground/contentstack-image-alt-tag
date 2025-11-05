import { getStack } from './contentstack-client.js';
import prompts from 'prompts';
import { readJsonFile, writeJsonFile } from './utils/file-utils.js';

async function getLanguages() {
  return readJsonFile('languages.json');
}

async function selectLanguages(languages) {
  const response = await prompts({
    type: 'multiselect',
    name: 'selected',
    message: 'Select languages (use space to toggle, arrows to navigate):',
    choices: languages.map(lang => ({
      title: `${lang.name} (${lang.code})`,
      value: lang,
      selected: true,
    })),
    instructions: false,
  });

  if (!response.selected || response.selected.length === 0) {
    return [];
  }

  return response.selected;
}

async function discoverContentTypes(stack, selectedLanguages) {
  console.log('\nDiscovering available content types...');
  
  const contentTypes = new Set();
  
  for (const lang of selectedLanguages) {
    try {
      const response = await stack.asset().query({
        skip: 0,
        limit: 100,
      }).find({ locale: lang.code });
      
      response.items.forEach(asset => {
        if (asset.content_type) {
          contentTypes.add(asset.content_type);
        }
      });
    } catch (error) {
      console.error(`Error discovering content types for ${lang.code}:`, error.message);
    }
  }
  
  return Array.from(contentTypes).sort();
}

async function selectContentTypes(contentTypes) {
  const imageTypes = contentTypes.filter(type => type.startsWith('image/'));
  const otherTypes = contentTypes.filter(type => !type.startsWith('image/'));
  
  const choices = [
    ...imageTypes.map(type => ({
      title: type,
      value: type,
      selected: true,
    })),
    ...otherTypes.map(type => ({
      title: type,
      value: type,
      selected: false,
    })),
  ];
  
  if (choices.length === 0) {
    console.log('No content types found');
    return [];
  }
  
  const response = await prompts({
    type: 'multiselect',
    name: 'selected',
    message: 'Select content types to include (use space to toggle, arrows to navigate):',
    choices,
    instructions: false,
  });

  if (!response.selected || response.selected.length === 0) {
    return [];
  }

  return response.selected;
}

async function fetchPage(stack, lang, skip, limit, allowedContentTypes) {
  const response = await stack.asset().query({
    skip,
    limit,
  }).find({ locale: lang.code });
  
  const allowedContentTypesSet = new Set(allowedContentTypes);
  
  return response.items.filter(asset => {
    const contentType = asset.content_type || '';
    const isAllowed = allowedContentTypesSet.has(contentType);
    const description = asset.description || '';
    return isAllowed && !description.trim();
  }).map(asset => ({
    uid: asset.uid,
    url: asset.url,
    filename: asset.filename,
    title: asset.title || '',
    locale: lang.code,
    localeName: lang.name,
  }));
}

async function getImagesForLanguage(stack, lang, allowedContentTypes) {
  console.log(`\nFetching images for language: ${lang.name} (${lang.code})...`);
  
  try {
    const limit = 100;
    const batchSize = 5;
    const images = [];
    let skip = 0;
    let hasMore = true;
    
    while (hasMore) {
      const batchPromises = [];
      for (let i = 0; i < batchSize; i++) {
        batchPromises.push(fetchPage(stack, lang, skip + i * limit, limit, allowedContentTypes));
      }
      
      const batchResults = await Promise.all(batchPromises);
      
      for (let i = 0; i < batchResults.length; i++) {
        const pageResults = batchResults[i];
        images.push(...pageResults);
        
        if (pageResults.length < limit) {
          hasMore = false;
          break;
        }
      }
      
      if (hasMore) {
        skip += batchSize * limit;
      }
    }
    
    console.log(`Found ${images.length} images without description for ${lang.name} (${lang.code})`);
    return images;
  } catch (error) {
    console.error(`Error while fetching images for language ${lang.code}:`, error.message);
    return [];
  }
}

async function getImagesWithoutDescription(stack, selectedLanguages, allowedContentTypes) {
  const results = await Promise.all(
    selectedLanguages.map(lang => getImagesForLanguage(stack, lang, allowedContentTypes))
  );
  
  return results.flat();
}

async function main() {
  try {
    const languages = await getLanguages();
    const selectedLanguages = await selectLanguages(languages);
    
    if (selectedLanguages.length === 0) {
      console.error('No languages selected');
      process.exit(1);
    }
    
    console.log(`\nSelected languages: ${selectedLanguages.map(l => l.name).join(', ')}`);
    
    const stack = getStack();
    const contentTypes = await discoverContentTypes(stack, selectedLanguages);
    
    if (contentTypes.length === 0) {
      console.error('No content types found');
      process.exit(1);
    }
    
    const selectedContentTypes = await selectContentTypes(contentTypes);
    
    if (selectedContentTypes.length === 0) {
      console.error('No content types selected');
      process.exit(1);
    }
    
    console.log(`\nSelected content types: ${selectedContentTypes.join(', ')}`);
    
    const images = await getImagesWithoutDescription(stack, selectedLanguages, selectedContentTypes);
    
    const outputPath = writeJsonFile('images.json', images);
    
    console.log(`\nFound ${images.length} images without description in total`);
    console.log(`Image list has been saved to ${outputPath}`);
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

main();

