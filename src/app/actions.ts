"use server";

import * as contentstack from '@/lib/contentstack';
import * as openai from '@/lib/openai';
import { AppConfig } from '@/lib/types';

// Contentstack Actions

export async function getLanguages(config: AppConfig) {
    return contentstack.getLanguages({
        apiKey: config.contentstackApiKey,
        managementToken: config.contentstackManagementToken,
    });
}

export async function getEnvironments(config: AppConfig) {
    return contentstack.getEnvironments({
        apiKey: config.contentstackApiKey,
        managementToken: config.contentstackManagementToken,
    });
}

export async function getContentTypes(config: AppConfig, languageCode: string) {
    return contentstack.getContentTypes({
        apiKey: config.contentstackApiKey,
        managementToken: config.contentstackManagementToken,
    }, languageCode);
}

export async function getAssets(config: AppConfig, languageCode: string, contentTypes: string[]) {
    return contentstack.getAssets({
        apiKey: config.contentstackApiKey,
        managementToken: config.contentstackManagementToken,
    }, languageCode, contentTypes);
}

export async function updateAssetDescription(config: AppConfig, assetUid: string, locale: string, description: string) {
    return contentstack.updateAssetDescription({
        apiKey: config.contentstackApiKey,
        managementToken: config.contentstackManagementToken,
    }, assetUid, locale, description);
}

export async function analyzeImageUsage(config: AppConfig, imageUid: string, locale: string) {
    const csConfig = {
        apiKey: config.contentstackApiKey,
        managementToken: config.contentstackManagementToken,
    };

    const references = await contentstack.getAssetReferences(csConfig, imageUid);

    if (!references || references.length === 0) {
        return [];
    }

    const usages = [];
    const processedKeys = new Set();

    for (const ref of references) {
        const contentTypeUid = ref.content_type_uid;
        const entryUid = ref.entry_uid;
        const refLocale = ref.locale || locale;

        if (!contentTypeUid || !entryUid) continue;

        // Avoid duplicates
        const key = `${contentTypeUid}:${entryUid}:${refLocale}`;
        if (processedKeys.has(key)) continue;
        processedKeys.add(key);

        const contentTypeInfo = await contentstack.getContentTypeInfo(csConfig, contentTypeUid);
        const entryTitle = await contentstack.getEntryTitle(csConfig, contentTypeUid, entryUid, refLocale);

        usages.push({
            contentTypeUid,
            contentTypeTitle: contentTypeInfo.title,
            entryUid,
            locale: refLocale,
            fieldName: 'Reference', // Simplified, we don't traverse deep to find exact field name for now
            key: `${contentTypeInfo.title} - ${entryTitle}`,
        });
    }

    return usages;
}

// OpenAI Actions

export async function uploadBatchFile(config: AppConfig, fileContent: string, fileName: string) {
    return openai.uploadBatchFile({ apiKey: config.openaiApiKey }, fileContent, fileName);
}

export async function createBatch(config: AppConfig, inputFileId: string) {
    return openai.createBatch({ apiKey: config.openaiApiKey }, inputFileId);
}

export async function retrieveBatch(config: AppConfig, batchId: string) {
    return openai.retrieveBatch({ apiKey: config.openaiApiKey }, batchId);
}

export async function downloadBatchResults(config: AppConfig, fileId: string) {
    return openai.downloadBatchResults({ apiKey: config.openaiApiKey }, fileId);
}
