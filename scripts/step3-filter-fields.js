import { getStack, getContentTypeInfo, getComponentInfo } from './contentstack-client.js';
import prompts from 'prompts';
import { readJsonFile, writeJsonFile } from './utils/file-utils.js';

async function getImages() {
  return readJsonFile('images.json');
}

async function getAssetReferences(stack, assetUid) {
  try {
    const response = await stack.asset(assetUid).getReferences();
    
    if (Array.isArray(response)) {
      return response;
    }
    
    if (response && Array.isArray(response.references)) {
      return response.references;
    }
    
    if (response && Array.isArray(response.items)) {
      return response.items;
    }
    
    return [];
  } catch (error) {
    console.error(`Error while fetching references for asset ${assetUid}:`, error.message);
    return [];
  }
}


function findAssetWithComponents(assetUid, fields, contentTypeUid, stack, path = [], componentHierarchy = []) {
  const foundPaths = [];
  
  if (!fields || typeof fields !== 'object') {
    return foundPaths;
  }
  
  for (const [key, value] of Object.entries(fields)) {
    if (key === 'uid' || key === '_version' || key === 'updated_at' || key === 'created_at' || key === 'ACL' || key === '_owner' || key === 'sys') {
      continue;
    }
    
    const currentPath = [...path, key];
    const currentComponentHierarchy = [...componentHierarchy];
    
    if (value === null || value === undefined) {
      continue;
    }
    
    if (typeof value === 'string' && value === assetUid) {
      foundPaths.push({
        path: currentPath,
        componentHierarchy: currentComponentHierarchy,
        fieldName: key,
      });
      continue;
    }
    
    if (typeof value === 'object' && value !== null) {
      const componentUid = value._content_type_uid || value.content_type_uid;
      
      if (componentUid) {
        currentComponentHierarchy.push({
          uid: componentUid,
          fieldName: key,
        });
      }
      
      if (Array.isArray(value)) {
        value.forEach((item, index) => {
          if (typeof item === 'string' && item === assetUid) {
            foundPaths.push({
              path: [...currentPath, index],
              componentHierarchy: currentComponentHierarchy,
              fieldName: key,
            });
          } else if (typeof item === 'object' && item !== null) {
            const itemComponentUid = item._content_type_uid || item.content_type_uid;
            const itemHierarchy = itemComponentUid 
              ? [...currentComponentHierarchy, { uid: itemComponentUid, fieldName: key }]
              : currentComponentHierarchy;
            
            if (item.uid === assetUid || (item.sys && item.sys.uid === assetUid)) {
              foundPaths.push({
                path: [...currentPath, index],
                componentHierarchy: itemHierarchy,
                fieldName: key,
              });
            } else {
              foundPaths.push(...findAssetWithComponents(assetUid, item, contentTypeUid, stack, [...currentPath, index], itemHierarchy));
            }
          }
        });
      } else {
        if (value.uid === assetUid || (value.sys && value.sys.uid === assetUid)) {
          foundPaths.push({
            path: currentPath,
            componentHierarchy: currentComponentHierarchy,
            fieldName: key,
          });
        } else {
          foundPaths.push(...findAssetWithComponents(assetUid, value, contentTypeUid, stack, currentPath, currentComponentHierarchy));
        }
      }
    }
  }
  
  return foundPaths;
}

async function getEntryWithComponents(stack, contentTypeUid, entryUid, locale, assetUid) {
  try {
    const entry = await stack.contentType(contentTypeUid).entry(entryUid).fetch({ locale });
    const fields = entry.fields || entry;
    const foundPaths = findAssetWithComponents(assetUid, fields, contentTypeUid, stack);
    
    return foundPaths.map(pathInfo => ({
      ...pathInfo,
      contentTypeUid,
      entryUid,
      locale,
    }));
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
  const keyGroups = {};
  const componentInfoCache = {};
  const contentTypeInfoCache = {};
  
  console.log(`\nAnalyzing usages for ${images.length} images...`);
  
  for (let i = 0; i < images.length; i++) {
    const image = images[i];
    console.log(`Processing image ${i + 1}/${images.length}: ${image.filename} (${image.uid})`);
    
    const references = await getAssetReferences(stack, image.uid);
    
    if (references.length === 0) {
      console.log(`  No usages found`);
      image.usages = [];
      continue;
    }
    
    console.log(`  Found ${references.length} usages`);
    
    const usages = [];
    let skippedReferences = 0;
    let skippedPathInfos = 0;
    
    for (const ref of references) {
      const contentTypeUid = ref.content_type_uid || ref._content_type_uid;
      const entryUid = ref.entry_uid || ref.uid;
      const locale = ref.locale || image.locale || 'en-us';
      
      if (!contentTypeUid || !entryUid) {
        console.log(`  Skipping reference - missing contentTypeUid or entryUid`);
        skippedReferences++;
        continue;
      }
      
      if (!contentTypeInfoCache[contentTypeUid]) {
        contentTypeInfoCache[contentTypeUid] = await getContentTypeInfo(stack, contentTypeUid);
      }
      const contentTypeInfo = contentTypeInfoCache[contentTypeUid];
      
      const pathInfos = await getEntryWithComponents(stack, contentTypeUid, entryUid, locale, image.uid);
      
      if (pathInfos.length === 0) {
        console.log(`  Warning: Asset ${image.uid} not found in entry ${entryUid} fields`);
        skippedPathInfos++;
        continue;
      }
      
      for (const pathInfo of pathInfos) {
        const componentHierarchy = pathInfo.componentHierarchy || [];
        const fieldName = pathInfo.fieldName || 'Image';
        
        for (const component of componentHierarchy) {
          if (!componentInfoCache[component.uid]) {
            componentInfoCache[component.uid] = await getComponentInfo(stack, component.uid);
          }
        }
        
        const key = buildComponentKey(componentHierarchy, contentTypeInfo, componentInfoCache, fieldName);
        
        usages.push({
          contentTypeUid,
          contentTypeTitle: contentTypeInfo.title,
          entryUid,
          locale,
          componentHierarchy: componentHierarchy.map(c => ({
            uid: c.uid,
            title: componentInfoCache[c.uid]?.title || c.uid,
            fieldName: c.fieldName,
          })),
          fieldName,
          key,
        });
        
        if (!keyGroups[key]) {
          keyGroups[key] = {
            key,
            contentTypeUid,
            contentTypeTitle: contentTypeInfo.title,
            componentHierarchy: componentHierarchy.map(c => ({
              uid: c.uid,
              title: componentInfoCache[c.uid]?.title || c.uid,
              fieldName: c.fieldName,
            })),
            fieldName,
            imageCount: 0,
            images: [],
          };
        }
        
        keyGroups[key].imageCount++;
        if (!keyGroups[key].images.find(img => img.uid === image.uid)) {
          keyGroups[key].images.push({
            uid: image.uid,
            filename: image.filename,
            url: image.url,
            locale: image.locale,
          });
        }
      }
      
      await new Promise(resolve => setTimeout(resolve, 200));
    }
    
    if (usages.length === 0 && references.length > 0) {
      console.log(`  ⚠️  Image ${image.uid} has ${references.length} references but 0 usages (skipped: ${skippedReferences} refs, ${skippedPathInfos} pathInfos)`);
    }
    
    image.usages = usages;
  }
  
  return keyGroups;
}

async function selectKeysToInclude(keyGroups) {
  const keys = Object.values(keyGroups).sort((a, b) => a.key.localeCompare(b.key));
  
  if (keys.length === 0) {
    console.log('\nNo keys found for images');
    return [];
  }
  
  const response = await prompts({
    type: 'multiselect',
    name: 'selected',
    message: 'Select keys to include (use space to toggle, arrows to navigate):',
    choices: keys.map(keyGroup => ({
      title: `${keyGroup.key} (${keyGroup.imageCount} images)`,
      value: keyGroup.key,
      selected: true,
    })),
    instructions: false,
  });

  if (!response.selected || response.selected.length === 0) {
    return [];
  }

  return response.selected;
}

function filterImages(images, selectedKeys) {
  if (selectedKeys.length === 0) {
    return [];
  }
  
  const selectedKeysSet = new Set(selectedKeys);
  
  return images.filter(image => {
    if (!image.usages || image.usages.length === 0) {
      console.log(`  ⚠️  Filtering out image ${image.uid} (${image.filename}) - no usages`);
      return false;
    }
    
    const hasMatchingKey = image.usages.some(usage => {
      return selectedKeysSet.has(usage.key);
    });
    
    if (!hasMatchingKey) {
      const usageKeys = image.usages.map(u => u.key).join(', ');
      console.log(`  ⚠️  Filtering out image ${image.uid} (${image.filename}) - no matching keys. Usage keys: [${usageKeys}], Selected keys: [${Array.from(selectedKeysSet).join(', ')}]`);
    }
    
    return hasMatchingKey;
  });
}

async function main() {
  try {
    const images = await getImages();
    console.log(`\nLoaded ${images.length} images`);
    
    console.log('\nAnalyzing image usages and building component hierarchy...');
    const keyGroups = await analyzeImageUsages(images);
    
    console.log(`\nFound ${Object.keys(keyGroups).length} unique keys`);
    
    const selectedKeys = await selectKeysToInclude(keyGroups);
    console.log(`\nSelected ${selectedKeys.length} keys to include`);
    
    const filteredImages = filterImages(images, selectedKeys);
    
    const outputPath = writeJsonFile('filtered-images.json', {
      totalImages: images.length,
      filteredImages: filteredImages.length,
      selectedKeys,
      keyGroups,
      images: filteredImages,
    });
    
    console.log(`\nFiltered ${images.length} images to ${filteredImages.length}`);
    console.log(`Results have been saved to ${outputPath}`);
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

main();

