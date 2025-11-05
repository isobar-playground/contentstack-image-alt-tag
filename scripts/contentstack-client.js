import Contentstack from '@contentstack/management';
import dotenv from 'dotenv';

dotenv.config();

const {
  CONTENTSTACK_API_KEY,
  CONTENTSTACK_MANAGEMENT_TOKEN,
  CONTENTSTACK_HOST,
} = process.env;

if (!CONTENTSTACK_API_KEY || !CONTENTSTACK_MANAGEMENT_TOKEN) {
  console.error('Error: Required environment variables CONTENTSTACK_API_KEY and CONTENTSTACK_MANAGEMENT_TOKEN');
  process.exit(1);
}

const clientConfig = { 
  authorization: CONTENTSTACK_MANAGEMENT_TOKEN
};
if (CONTENTSTACK_HOST) {
  clientConfig.host = CONTENTSTACK_HOST;
}

const client = Contentstack.client(clientConfig);

export function getStack() {
  return client.stack({ api_key: CONTENTSTACK_API_KEY });
}

export async function getEntryTitle(stack, contentTypeUid, entryUid, locale) {
  try {
    const entry = await stack.contentType(contentTypeUid).entry(entryUid).fetch({ locale });
    const fields = entry.fields || entry;
    
    const titleFields = ['title', 'name', 'entryTitle', 'entry_title'];
    for (const field of titleFields) {
      if (fields[field]) {
        return typeof fields[field] === 'string' ? fields[field] : String(fields[field]);
      }
    }
    
    return entryUid;
  } catch (error) {
    console.error(`Error fetching entry ${entryUid}:`, error.message);
    return entryUid;
  }
}

export async function getContentTypeInfo(stack, contentTypeUid) {
  try {
    const contentType = await stack.contentType(contentTypeUid).fetch();
    return {
      uid: contentType.uid,
      title: contentType.title || contentTypeUid,
      schema: contentType.schema || [],
    };
  } catch (error) {
    console.error(`Error fetching content type ${contentTypeUid}:`, error.message);
    return {
      uid: contentTypeUid,
      title: contentTypeUid,
      schema: [],
    };
  }
}

export async function getComponentInfo(stack, componentUid) {
  try {
    const component = await stack.contentType(componentUid).fetch();
    return {
      uid: component.uid,
      title: component.title || componentUid,
    };
  } catch (error) {
    return {
      uid: componentUid,
      title: componentUid,
    };
  }
}

export { client, CONTENTSTACK_API_KEY };

