import { getStack } from './contentstack-client.js';
import { writeJsonFile } from './utils/file-utils.js';

async function getLanguages() {
  try {
    const stack = getStack();
    const response = await stack.locale().query().find();
    
    const languages = response.items.map(locale => ({
      code: locale.code,
      name: locale.name,
      uid: locale.uid,
    }));

    const outputPath = writeJsonFile('languages.json', languages);
    
    console.log(`Found ${languages.length} languages:`);
    languages.forEach((lang, index) => {
      console.log(`${index + 1}. ${lang.name} (${lang.code})`);
    });
    console.log(`\nLanguage list has been saved to ${outputPath}`);
  } catch (error) {
    console.error('Error while fetching languages:');
    console.error('Message:', error.message);
    if (error.error) {
      console.error('Error details:', JSON.stringify(error.error, null, 2));
    }
    if (error.response) {
      console.error('Response status:', error.response.status);
      console.error('Response data:', JSON.stringify(error.response.data, null, 2));
    }
    console.error('Full error:', error);
    process.exit(1);
  }
}

getLanguages();

