import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import contentstackManagementPkg from '@contentstack/management';
import OpenAI from 'openai';

const { client: contentstackClient } = contentstackManagementPkg;

const MODEL_PRICING_PER_MTOK = {
  'gpt-4.1': { input: 1.0, output: 4.0 },
  'gpt-4.1-mini': { input: 0.2, output: 0.8 },
  'gpt-4.1-nano': { input: 0.05, output: 0.2 },
  'gpt-4o': { input: 1.25, output: 5.0 },
  'gpt-4o-mini': { input: 0.075, output: 0.3 },
};

function getPricing(modelId) {
  const fromMap = MODEL_PRICING_PER_MTOK[modelId];
  if (fromMap) return fromMap;

  const envInput = Number(process.env.OPENAI_PRICE_INPUT_PER_MTOK || '');
  const envOutput = Number(process.env.OPENAI_PRICE_OUTPUT_PER_MTOK || '');
  const hasEnv = Number.isFinite(envInput) && Number.isFinite(envOutput) && envInput >= 0 && envOutput >= 0;

  return hasEnv ? { input: envInput, output: envOutput } : null;
}

function calculateCostUsd(modelId, promptTokens, completionTokens) {
  const pricing = getPricing(modelId);
  if (!pricing) return null;

  const inputCost = (promptTokens / 1_000_000) * pricing.input;
  const outputCost = (completionTokens / 1_000_000) * pricing.output;
  return inputCost + outputCost;
}

function getErrorMessage(error) {
  return error?.error?.message || error?.message || String(error);
}

function parseEnvFile(filePath) {
  const result = {};
  if (!fs.existsSync(filePath)) return result;

  const raw = fs.readFileSync(filePath, 'utf8');
  for (const line of raw.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;

    const eqIdx = trimmed.indexOf('=');
    if (eqIdx <= 0) continue;

    const key = trimmed.slice(0, eqIdx).trim();
    let value = trimmed.slice(eqIdx + 1).trim();

    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }

    if (key && process.env[key] === undefined) {
      result[key] = value;
    }
  }

  return result;
}

function loadEnv() {
  const envPath = path.resolve(process.cwd(), '.env');
  const fromFile = parseEnvFile(envPath);
  for (const [k, v] of Object.entries(fromFile)) {
    process.env[k] = v;
  }
}

function readDefaultMasterPrompt() {
  const constantsPath = path.resolve(process.cwd(), 'src/lib/constants.ts');
  if (!fs.existsSync(constantsPath)) return '';

  const content = fs.readFileSync(constantsPath, 'utf8');
  const match = content.match(/export const DEFAULT_MASTER_PROMPT\s*=\s*`([\s\S]*?)`\s*;?/);
  return match ? match[1] : '';
}

function getStack(apiKey, managementToken) {
  const cma = contentstackClient({ authorization: managementToken });
  return cma.stack({ api_key: apiKey });
}

async function getAssetReferences(stack, assetUid) {
  try {
    const response = await stack.asset(assetUid).getReferences();
    if (Array.isArray(response)) return response;
    if (response && Array.isArray(response.references)) return response.references;
    if (response && Array.isArray(response.items)) return response.items;
    return [];
  } catch {
    return [];
  }
}

async function getContentTypeInfo(stack, contentTypeUid) {
  try {
    const contentType = await stack.contentType(contentTypeUid).fetch();
    return {
      uid: contentType.uid,
      title: contentType.title || contentTypeUid,
    };
  } catch {
    return {
      uid: contentTypeUid,
      title: contentTypeUid,
    };
  }
}

async function getEntryTitle(stack, contentTypeUid, entryUid, locale) {
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
  } catch {
    return entryUid;
  }
}

async function analyzeImageUsage(stack, imageUid, locale) {
  const references = await getAssetReferences(stack, imageUid);
  if (!references || references.length === 0) return [];

  const uniqueContentTypeUids = new Set();
  const uniqueEntryRefs = new Map();
  const processedReferenceKeys = new Set();

  for (const ref of references) {
    const contentTypeUid = ref.content_type_uid;
    const entryUid = ref.entry_uid;
    const refLocale = ref.locale || locale;

    if (!contentTypeUid || !entryUid) continue;

    const key = `${contentTypeUid}:${entryUid}:${refLocale}`;
    if (processedReferenceKeys.has(key)) continue;

    processedReferenceKeys.add(key);
    uniqueContentTypeUids.add(contentTypeUid);
    uniqueEntryRefs.set(key, { contentTypeUid, entryUid, locale: refLocale });
  }

  const contentTypeInfoResults = await Promise.all(
    Array.from(uniqueContentTypeUids).map(async (uid) => ({ uid, info: await getContentTypeInfo(stack, uid) }))
  );

  const contentTypeInfoMap = new Map();
  for (const item of contentTypeInfoResults) {
    contentTypeInfoMap.set(item.uid, item.info);
  }

  const entryTitleResults = await Promise.all(
    Array.from(uniqueEntryRefs.values()).map(async ({ contentTypeUid, entryUid, locale: refLocale }) => ({
      key: `${contentTypeUid}:${entryUid}:${refLocale}`,
      title: await getEntryTitle(stack, contentTypeUid, entryUid, refLocale),
    }))
  );

  const entryTitleMap = new Map();
  for (const item of entryTitleResults) {
    entryTitleMap.set(item.key, item.title);
  }

  const usages = [];

  for (const ref of references) {
    const contentTypeUid = ref.content_type_uid;
    const entryUid = ref.entry_uid;
    const refLocale = ref.locale || locale;

    if (!contentTypeUid || !entryUid) continue;

    const key = `${contentTypeUid}:${entryUid}:${refLocale}`;
    if (!processedReferenceKeys.has(key)) continue;

    processedReferenceKeys.delete(key);

    const contentTypeInfo = contentTypeInfoMap.get(contentTypeUid);
    const entryTitle = entryTitleMap.get(key);

    if (contentTypeInfo && entryTitle) {
      usages.push({
        contentTypeUid,
        contentTypeTitle: contentTypeInfo.title,
        entryUid,
        locale: refLocale,
        fieldName: 'Reference',
        key: `${contentTypeInfo.title} - ${entryTitle}`,
      });
    }
  }

  return usages;
}

function buildUserMessage({ localeName, usages, brandName }) {
  let userMessage = 'Generate an ALT tag for this image.';

  if (localeName) {
    userMessage += `\n\nGenerate the ALT tag in the language: ${localeName}`;
  }

  if (usages && usages.length > 0) {
    const context = usages
      .map((u) => `Used in content type ${u.contentTypeTitle} named ${u.key.split(' - ')[1] || 'Unknown'}`)
      .join('. ');
    userMessage += `\n\nContext: ${context}`;
  }

  if (brandName) {
    userMessage += `\n\nBrand: ${brandName}`;
  }

  return userMessage;
}

async function main() {
  loadEnv();

  const getAssetUid = () => {
    const argUid = process.argv[2]?.trim();
    if (argUid) return argUid;

    const envUid = process.env.ASSET_UID || process.env.npm_config_assetuid || process.env.npm_config_asset_uid;
    if (envUid) return envUid.trim();

    const rawNpmArgv = process.env.npm_config_argv;
    if (!rawNpmArgv) return '';

    try {
      const parsed = JSON.parse(rawNpmArgv);
      const original = Array.isArray(parsed?.original) ? parsed.original : [];
      const maybeUid = original.find((item) => typeof item === 'string' && !item.startsWith('-') && item !== 'run' && item !== 'generate-alt');
      return maybeUid ? maybeUid.trim() : '';
    } catch {
      return '';
    }
  };

  const assetUid = getAssetUid();
  if (!assetUid) {
    console.error('Usage: npm run generate-alt -- <contentstack_asset_uid>');
    console.error('Alt:   npm run generate-alt --assetUid=<contentstack_asset_uid>');
    process.exit(1);
  }

  const contentstackApiKey = process.env.CONTENTSTACK_API_KEY;
  const contentstackManagementToken = process.env.CONTENTSTACK_MANAGEMENT_TOKEN;
  const openaiApiKey = process.env.OPENAI_API_KEY;
  const openaiModel = process.env.OPENAI_MODEL;

  if (!contentstackApiKey || !contentstackManagementToken || !openaiApiKey || !openaiModel) {
    console.error('Missing required env vars: CONTENTSTACK_API_KEY, CONTENTSTACK_MANAGEMENT_TOKEN, OPENAI_API_KEY, OPENAI_MODEL');
    process.exit(1);
  }

  const locale = process.env.CONTENTSTACK_LOCALE || 'en-us';
  const localeName = process.env.CONTENTSTACK_LOCALE_NAME || locale;
  const brandName = process.env.BRAND_NAME || '';
  const masterPrompt = process.env.MASTER_PROMPT || readDefaultMasterPrompt();

  if (!masterPrompt) {
    console.error('MASTER_PROMPT is empty and DEFAULT_MASTER_PROMPT could not be read from src/lib/constants.ts');
    process.exit(1);
  }

  const stack = getStack(contentstackApiKey, contentstackManagementToken);
  const asset = await stack.asset(assetUid).fetch({ locale });
  const usages = await analyzeImageUsage(stack, assetUid, locale);

  const imageUrl = new URL(asset.url);
  imageUrl.searchParams.set('height', '1080');
  imageUrl.searchParams.set('fit', 'scale-down');
  imageUrl.searchParams.set('quality', '85');

  const userMessage = buildUserMessage({ localeName, usages, brandName });

  const openai = new OpenAI({ apiKey: openaiApiKey });
  const response = await openai.chat.completions.create({
    model: openaiModel,
    messages: [
      { role: 'system', content: masterPrompt },
      {
        role: 'user',
        content: [
          { type: 'text', text: userMessage },
          { type: 'image_url', image_url: { url: imageUrl.toString() } },
        ],
      },
    ],
    temperature: 0.7,
  });

  const altText = response.choices?.[0]?.message?.content?.trim() || '';
  const promptTokens = response.usage?.prompt_tokens || 0;
  const completionTokens = response.usage?.completion_tokens || 0;
  const totalTokens = response.usage?.total_tokens || promptTokens + completionTokens;
  const estimatedCostUsd = calculateCostUsd(openaiModel, promptTokens, completionTokens);

  console.log(`Image: ${asset.filename || asset.title || assetUid}`);
  console.log(`UID: ${assetUid}`);
  console.log(`Model: ${openaiModel}`);
  console.log(`ALT: ${altText}`);
  console.log(`Tokens: prompt=${promptTokens}, completion=${completionTokens}, total=${totalTokens}`);
  if (estimatedCostUsd === null) {
    console.log('Estimated cost: unknown model price (set OPENAI_PRICE_INPUT_PER_MTOK and OPENAI_PRICE_OUTPUT_PER_MTOK in .env)');
  } else {
    console.log(`Estimated cost (USD): $${estimatedCostUsd.toFixed(6)}`);
  }
}

main().catch((error) => {
  const message = getErrorMessage(error);
  console.error(`Error: ${message}`);
  process.exit(1);
});
