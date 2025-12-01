export interface AppConfig {
    contentstackApiKey: string;
    contentstackManagementToken: string;
    contentstackEnvironment: string;
    openaiApiKey: string;
    openaiModel: string;
    brandName: string;
    masterPrompt: string;
}

export interface Language {
    code: string;
    name: string;
    uid: string;
}

export interface ContentType {
    uid: string;
    title: string;
}

export interface ContentstackAsset {
    uid: string;
    url: string;
    filename: string;
    title: string;
    locale: string;
    description: string;
    content_type: string;
    tags?: (string | { uid: string })[];
}

export interface ImageAsset {
    uid: string;
    url: string;
    filename: string;
    title: string;
    locale: string;
    localeName: string;
    description?: string;
    width?: number;
    height?: number;
    usages?: ImageUsage[];
    status?: 'active' | 'ignored';
    generatedAltText?: string;
    updateStatus?: 'pending' | 'success' | 'error';
    updateError?: string;
}

export interface ImageUsage {
    contentTypeUid: string;
    contentTypeTitle: string;
    entryUid: string;
    locale: string;
    fieldName: string;
    key: string;
}

export interface BatchInfo {
    batchId: string;
    fileId: string;
    createdAt: string;
    status: 'validating' | 'failed' | 'in_progress' | 'finalizing' | 'completed' | 'expired' | 'cancelled';
    totalRequests: number;
    completedRequests: number;
    failedRequests: number;
    outputFileId?: string;
    errorFileId?: string;
}

export interface AppState {
    step: number;
    config: AppConfig;
    selectedLanguages: Language[];
    selectedContentTypes: ContentType[];
    images: ImageAsset[];
    batchInfo: BatchInfo | null;
}


export interface ErrorObject {
    message?: string;
}

export interface ContentstackAPIError extends Error {
    errorMessage?: string;
    errors?: ErrorObject[];
}