import OpenAI from 'openai';

interface OpenAIConfig {
    apiKey: string;
}

export const createOpenAIClient = (config: OpenAIConfig) => {
    return new OpenAI({
        apiKey: config.apiKey,
        dangerouslyAllowBrowser: true // We might need this if running client-side, but better to use server actions.
        // However, for "stateless" app without backend DB, client-side is easier but exposes keys in network tab (HTTPS protects them but still).
        // Given the requirement "keys in cookies", usually implies server-side usage.
        // But "stateless" also implies no DB.
        // If we use Server Actions, we can pass keys from cookies/client to the action.
        // So we don't need dangerouslyAllowBrowser if we only use this in Server Actions.
    });
};

// We will use Server Actions for these to keep keys off the client-side JS (mostly) and avoid CORS if OpenAI blocks browser requests (it usually does).
// So this file will be used by Server Actions.

export async function uploadBatchFile(config: OpenAIConfig, fileContent: string, fileName: string) {
    const openai = createOpenAIClient(config);
    // OpenAI expects a File object or ReadStream.
    // In Node (Server Action), we can use a Blob or Buffer.
    const file = new File([fileContent], fileName, { type: 'application/jsonl' });

    const response = await openai.files.create({
        file: file,
        purpose: 'batch',
    });

    return response.id;
}

export async function createBatch(config: OpenAIConfig, inputFileId: string) {
    const openai = createOpenAIClient(config);

    const batch = await openai.batches.create({
        input_file_id: inputFileId,
        endpoint: '/v1/chat/completions',
        completion_window: '24h',
    });

    return batch.id;
}

export async function retrieveBatch(config: OpenAIConfig, batchId: string) {
    const client = createOpenAIClient(config);
    const batch = await client.batches.retrieve(batchId);
    // Convert to plain object to avoid serialization issues with Next.js
    return JSON.parse(JSON.stringify(batch));
}

export async function downloadBatchResults(config: OpenAIConfig, fileId: string) {
    const openai = createOpenAIClient(config);
    const response = await openai.files.content(fileId);
    return await response.text();
}

export async function cancelBatch(config: OpenAIConfig, batchId: string) {
    const openai = createOpenAIClient(config);
    return await openai.batches.cancel(batchId);
}
