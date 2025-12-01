import { client } from '@contentstack/management';
import { Asset } from '@contentstack/management/types/stack/asset';
import { ImageAsset } from './types';
import { parseContentstackError } from './utils';

interface ContentstackConfig {
    apiKey: string;
    managementToken: string;
}

export const createClient = (config: ContentstackConfig) => {
    return client({
        authorization: config.managementToken,
    });
};

export const getStack = (config: ContentstackConfig) => {
    const stackClient = createClient(config);
    return stackClient.stack({ api_key: config.apiKey });
};

export async function getLanguages(config: ContentstackConfig) {
    const stack = getStack(config);
    const response = await stack.locale().query().find();
    return response.items.map((locale) => ({
        code: locale.code,
        name: locale.name,
        uid: locale.uid,
    }));
}

export async function getEnvironments(config: ContentstackConfig) {
    const stack = getStack(config);
    const response = await stack.environment().query().find();
    return response.items.map((env) => ({
        uid: env.uid,
        name: env.name,
    }));
}

export async function getContentTypes(config: ContentstackConfig, languageCode: string) {
    const stack = getStack(config);

    const contentTypes = new Set<string>();
    try {
        const response = await stack.asset().query({ limit: 100, locale: languageCode }).find();
        response.items.forEach((asset: Asset) => {
            if (asset.content_type) {
                contentTypes.add(asset.content_type);
            }
        });
    } catch (error: unknown) {
        console.error('Error discovering content types:', parseContentstackError(error));
        throw error;
    }

    return Array.from(contentTypes).sort().map(type => ({
        uid: type,
        title: type
    }));
}

export async function getAssets(config: ContentstackConfig, languageCode: string, contentTypes: string[]): Promise<Partial<ImageAsset>[]> {
    const stack = getStack(config);
    const allowedContentTypesSet = new Set(contentTypes);

    const limit = 100;
    let skip = 0;
    let allAssets: Asset[] = [];
    let hasMore = true;

    const MAX_ASSETS = 5000;

    while (hasMore && allAssets.length < MAX_ASSETS) {
        const response = await stack.asset().query({
            skip,
            limit,
            locale: languageCode,
            include_count: true
        }).find();

        const items = response.items || [];

        if (items.length < limit) {
            hasMore = false;
        }

        const filtered = items.filter((asset: Asset) => {
            const contentType = asset.content_type || '';
            const isAllowed = allowedContentTypesSet.has(contentType);
            const description = asset.description || '';
            return isAllowed && !description.trim();
        });

        allAssets = [...allAssets, ...filtered];
        skip += limit;

    }

    return allAssets.map((asset: Asset) => ({
        uid: asset.uid,
        url: asset.url,
        filename: asset.filename,
        title: asset.title || '',
        locale: languageCode,
        localeName: '',
        description: asset.description,
        width: asset.dimension?.width,
        height: asset.dimension?.height,
    }));
}

export async function getAssetReferences(config: ContentstackConfig, assetUid: string) {
    const stack = getStack(config);
    try {
        const response = await stack.asset(assetUid).getReferences();
        if (Array.isArray(response)) return response;
        if (response && Array.isArray(response.references)) return response.references;
        if (response && Array.isArray(response.items)) return response.items;
        return [];
    } catch (error: unknown) {
        console.error(`Error while fetching references for asset ${assetUid}:`, parseContentstackError(error));
        return [];
    }
}

export async function getEntryTitle(config: ContentstackConfig, contentTypeUid: string, entryUid: string, locale: string) {
    const stack = getStack(config);
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
    } catch (error: unknown) {
        console.error(`Error fetching entry ${entryUid}:`, parseContentstackError(error));
        return entryUid;
    }
}

export async function getContentTypeInfo(config: ContentstackConfig, contentTypeUid: string) {
    const stack = getStack(config);
    try {
        const contentType = await stack.contentType(contentTypeUid).fetch();
        return {
            uid: contentType.uid,
            title: contentType.title || contentTypeUid,
        };
    } catch (error: unknown) {
        console.error(`Error fetching content type ${contentTypeUid}:`, parseContentstackError(error));
        return {
            uid: contentTypeUid,
            title: contentTypeUid,
        };
    }
}

export async function updateAssetDescription(config: ContentstackConfig, assetUid: string, locale: string, description: string) {
    const stack = getStack(config);
    try {
        const asset = await stack.asset(assetUid).fetch({ locale });

        const existingTags = asset.tags || [];
        const tagUids = existingTags.map((tag: string | { uid: string }) => typeof tag === 'string' ? tag : tag.uid || tag);
        const hasAiTag = tagUids.includes('ai description');

        asset.description = description;

        if (!hasAiTag) {
            asset.tags = [...tagUids, 'ai description'];
        }

        await asset.update({ locale });

        return { success: true };
    } catch (error: unknown) {
        const errMessage = parseContentstackError(error);
        console.error(`Error updating asset ${assetUid}:`, errMessage);
        return { success: false, error: errMessage };
    }
};
