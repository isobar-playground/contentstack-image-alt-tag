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

export const OPENAI_MODELS = [
    { id: 'gpt-4.1', name: 'GPT-4.1', inputPrice: 1.00, outputPrice: 4.00 },
    { id: 'gpt-4.1-mini', name: 'GPT-4.1-mini', inputPrice: 0.20, outputPrice: 0.80 },
    { id: 'gpt-4.1-nano', name: 'GPT-4.1-nano', inputPrice: 0.05, outputPrice: 0.20 },
    { id: 'gpt-4o', name: 'GPT-4o', inputPrice: 1.25, outputPrice: 5.00 },
    { id: 'gpt-4o-mini', name: 'gpt-4o-mini', inputPrice: 0.075, outputPrice: 0.30 },
];

export function calculateImageTokens(width: number, height: number, detail: 'low' | 'high' = 'high'): number {
    if (detail === 'low') return 85;

    // High detail calculation
    // 1. Scale to fit within 2048x2048
    let scaledWidth = width;
    let scaledHeight = height;

    if (scaledWidth > 2048 || scaledHeight > 2048) {
        const ratio = Math.min(2048 / scaledWidth, 2048 / scaledHeight);
        scaledWidth = Math.floor(scaledWidth * ratio);
        scaledHeight = Math.floor(scaledHeight * ratio);
    }

    // 2. Scale such that shortest side is 768px
    const shortestSide = Math.min(scaledWidth, scaledHeight);
    if (shortestSide > 768) {
        const ratio = 768 / shortestSide;
        scaledWidth = Math.floor(scaledWidth * ratio);
        scaledHeight = Math.floor(scaledHeight * ratio);
    }

    // 3. Count 512px tiles
    const tilesX = Math.ceil(scaledWidth / 512);
    const tilesY = Math.ceil(scaledHeight / 512);
    const totalTiles = tilesX * tilesY;

    // 4. Calculate tokens: 170 per tile + 85 base
    return (totalTiles * 170) + 85;
}

export function estimateCost(modelId: string, inputTokens: number, outputTokens: number): number {
    const model = OPENAI_MODELS.find(m => m.id === modelId);
    if (!model) return 0;

    const inputCost = (inputTokens / 1_000_000) * model.inputPrice;
    const outputCost = (outputTokens / 1_000_000) * model.outputPrice;

    return inputCost + outputCost;
}