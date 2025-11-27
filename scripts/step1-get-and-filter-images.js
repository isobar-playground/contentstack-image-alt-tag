import {
  getStack,
  getContentTypeInfo,
  getComponentInfo
} from './contentstack-client.js';
import prompts from 'prompts';
import { writeJsonFile } from './utils/file-utils.js';

// --- Functions from original step1 ---

async function getLanguages() {
  try {
    const stack = getStack();
    const response = await stack.locale().query().find();

    const languages = response.items.map((locale) => ({
      code: locale.code,
      name: locale.name,
      uid: locale.uid,
    }));

    console.log(`Found ${languages.length} languages:`);
    languages.forEach((lang, index) => {
      console.log(`${index + 1}. ${lang.name} (${lang.code})`);
    });
    console.log('');

    return languages;
  } catch (error) {
    console.error('Error while fetching languages:', error.message);
    // ... (error handling as before)
    process.exit(1);
  }
}

async function selectLanguages(languages) {
  const response = await prompts({
    type: 'multiselect',
    name: 'selected',
    message: 'Select languages (use space to toggle, arrows to navigate):',
    choices: languages.map((lang) => ({
      title: `${lang.name} (${lang.code})`,
      value: lang,
      selected: true,
    })),
    instructions: false,
  });

  return response.selected || [];
}

async function discoverContentTypes(stack, selectedLanguages) {
  console.log('\nDiscovering available content types...');
  const contentTypes = new Set();
  for (const lang of selectedLanguages) {
    try {
      const response = await stack.asset().query({ skip: 0, limit: 100 }).find({ locale: lang.code });
      response.items.forEach((asset) => {
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
  const imageTypes = contentTypes.filter((type) => type.startsWith('image/'));
  const otherTypes = contentTypes.filter((type) => !type.startsWith('image/'));
  const choices = [
    ...imageTypes.map((type) => ({ title: type, value: type, selected: true })),
    ...otherTypes.map((type) => ({ title: type, value: type, selected: false })),
  ];

  if (choices.length === 0) {
    console.log('No content types found');
    return [];
  }

  const response = await prompts({
    type: 'multiselect',
    name: 'selected',
    message: 'Select content types to include:',
    choices,
    instructions: false,
  });

  return response.selected || [];
}

async function fetchPage(stack, lang, skip, limit, allowedContentTypes) {
  const response = await stack.asset().query({ skip, limit }).find({ locale: lang.code });
  const allowedContentTypesSet = new Set(allowedContentTypes);
  return response.items
    .filter((asset) => {
      const contentType = asset.content_type || '';
      const isAllowed = allowedContentTypesSet.has(contentType);
      const description = asset.description || '';
      return isAllowed && !description.trim();
    })
    .map((asset) => ({
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
      const batchPromises = Array.from({ length: batchSize }, (_, i) =>
        fetchPage(stack, lang, skip + i * limit, limit, allowedContentTypes)
      );
      const batchResults = await Promise.all(batchPromises);
      for (const pageResults of batchResults) {
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
    selectedLanguages.map((lang) => getImagesForLanguage(stack, lang, allowedContentTypes))
  );
  return results.flat();
}


// --- Functions from original step3 ---

async function getAssetReferences(stack, assetUid) {
    try {
      const response = await stack.asset(assetUid).getReferences();
      if (Array.isArray(response)) return response;
      if (response && Array.isArray(response.references)) return response.references;
      if (response && Array.isArray(response.items)) return response.items;
      return [];
    } catch (error) {
      console.error(`Error while fetching references for asset ${assetUid}:`, error.message);
      return [];
    }
}

function findAssetWithComponents(assetUid, fields, path = []) {
    const foundPaths = [];
    if (!fields || typeof fields !== 'object') return foundPaths;

    for (const [key, value] of Object.entries(fields)) {
        if (['uid', '_version', 'updated_at', 'created_at', 'ACL', '_owner', 'sys'].includes(key)) continue;

        const currentPath = [...path, key];
        if (value === null || value === undefined) continue;

        if (typeof value === 'string' && value === assetUid) {
            foundPaths.push({ path: currentPath, fieldName: key, componentHierarchy: [] });
            continue;
        }

        if (Array.isArray(value)) {
            value.forEach((item, index) => {
                if (typeof item === 'string' && item === assetUid) {
                    foundPaths.push({ path: [...currentPath, index], fieldName: key, componentHierarchy: [] });
                } else if (typeof item === 'object' && item !== null) {
                    if (item.uid === assetUid || (item.sys && item.sys.uid === assetUid)) {
                        foundPaths.push({ path: [...currentPath, index], fieldName: key, componentHierarchy: [] });
                    } else {
                        // This part handles nested objects/components within arrays
                        const nestedResult = findAssetWithComponents(assetUid, item, [...currentPath, index]);
                        foundPaths.push(...nestedResult);
                    }
                }
            });
        } else if (typeof value === 'object') {
             if (value.uid === assetUid || (value.sys && value.sys.uid === assetUid)) {
                foundPaths.push({ path: currentPath, fieldName: key, componentHierarchy: [] });
            } else if (value.hasOwnProperty('_content_type_uid')) { // It's a component
                const componentHierarchy = [{ uid: value._content_type_uid, fieldName: key }];
                const nestedResult = findAssetWithComponents(assetUid, value, currentPath);
                nestedResult.forEach(res => {
                    res.componentHierarchy = [...componentHierarchy, ...res.componentHierarchy];
                });
                foundPaths.push(...nestedResult);
            }
            else {
                const nestedResult = findAssetWithComponents(assetUid, value, currentPath);
                foundPaths.push(...nestedResult);
            }
        }
    }
    return foundPaths;
}

async function getEntryWithComponents(stack, contentTypeUid, entryUid, locale, assetUid) {
    try {
      const entry = await stack.contentType(contentTypeUid).entry(entryUid).fetch({ locale });
      return findAssetWithComponents(assetUid, entry);
    } catch (error) {
      console.error(`Error fetching entry ${entryUid}:`, error.message);
      return [];
    }
}

function buildComponentKey(componentHierarchy, contentTypeInfo, componentInfoCache, fieldName) {
    const keyParts = [contentTypeInfo.title];
    for (const component of componentHierarchy) {
      const componentInfo = componentInfoCache[component.uid] || { title: component.uid };
      keyParts.push(componentInfo.title);
    }
    keyParts.push(fieldName);
    return keyParts.join('.');
}

async function analyzeImageUsages(images) {
    const stack = getStack();
    const componentInfoCache = {};
    const contentTypeInfoCache = {};

    console.log(`\nAnalyzing usages for ${images.length} images...`);

    for (let i = 0; i < images.length; i++) {
        const image = images[i];
        console.log(`Processing image ${i + 1}/${images.length}: ${image.filename} (${image.uid})`);
        const references = await getAssetReferences(stack, image.uid);

        image.usages = [];
        if (references.length === 0) {
            console.log(`  No usages found`);
            continue;
        }

        console.log(`  Found ${references.length} usages`);
        for (const ref of references) {
            const contentTypeUid = ref.content_type_uid;
            const entryUid = ref.entry_uid;
            const locale = ref.locale || image.locale;

            if (!contentTypeUid || !entryUid) continue;

            if (!contentTypeInfoCache[contentTypeUid]) {
                contentTypeInfoCache[contentTypeUid] = await getContentTypeInfo(stack, contentTypeUid);
            }
            const contentTypeInfo = contentTypeInfoCache[contentTypeUid];

            const pathInfos = await getEntryWithComponents(stack, contentTypeUid, entryUid, locale, image.uid);

            for (const pathInfo of pathInfos) {
                const componentHierarchy = pathInfo.componentHierarchy || [];
                const fieldName = pathInfo.fieldName || 'Image';

                 for (const component of componentHierarchy) {
                    if (!componentInfoCache[component.uid]) {
                        componentInfoCache[component.uid] = await getComponentInfo(stack, component.uid);
                    }
                }

                const key = buildComponentKey(componentHierarchy, contentTypeInfo, componentInfoCache, fieldName);
                image.usages.push({
                    contentTypeUid,
                    contentTypeTitle: contentTypeInfo.title,
                    entryUid,
                    locale,
                    componentHierarchy: componentHierarchy.map(c => ({ uid: c.uid, title: componentInfoCache[c.uid]?.title || c.uid, fieldName: c.fieldName })),
                    fieldName,
                    key,
                });
            }
             await new Promise(resolve => setTimeout(resolve, 200)); // Rate limiting
        }
    }
    return images; // Return modified images array
}


// --- New Main Orchestration ---

async function main() {
  try {
    // 1. Get initial images
    const languages = await getLanguages();
    const selectedLanguages = await selectLanguages(languages);
    if (selectedLanguages.length === 0) {
      console.error('No languages selected');
      process.exit(1);
    }
    console.log(`\nSelected languages: ${selectedLanguages.map((l) => l.name).join(', ')}`);
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
    let images = await getImagesWithoutDescription(stack, selectedLanguages, selectedContentTypes);
    console.log(`\nFound ${images.length} initial images without description.`);

    // 2. Analyze usages
    images = await analyzeImageUsages(images);

    // 3. Ask to remove unused
    const { confirmRemoveUnused } = await prompts({
        type: 'confirm',
        name: 'confirmRemoveUnused',
        message: 'Do you want to filter out images that have no usages in any entries?',
        initial: true
    });

    let finalImages = images;
    if (confirmRemoveUnused) {
        finalImages = images.filter(img => img.usages && img.usages.length > 0);
        console.log(`\nFiltered out ${images.length - finalImages.length} unused images.`);
    }

    // 4. Save result
    const outputPath = writeJsonFile('images.json', finalImages);
    console.log(`\nSaved ${finalImages.length} images to ${outputPath}`);

  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

main();
