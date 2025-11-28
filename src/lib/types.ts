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
    locale: string; // Added locale here
    localeName: string;
    description?: string;
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


export const DEFAULT_MASTER_PROMPT = `You are an accessibility expert specializing in WCAG 2.1 standards for e-commerce cosmetic brands. Your task is to generate precise, functional ALT text for images.

Output a SINGLE LINE of plain text.

**HIERARCHY OF DECISIONS:**

**STEP 1: THE "TEXT IS KING" CHECK**
Does the image contain readable, meaningful text relevant to the brand context?
* **YES:** The image is INFORMATIONAL. Proceed to "STEP 3".
* **NO:** Proceed to Step 2.

**STEP 2: THE EXCLUSION CHECK (Safety & Relevance)**
If Step 1 was "NO", return strictly an empty string (no characters) if ANY of the following are true:

*   **Decorative/Layout:**
    *   Large empty space (negative space) designed for text overlay.
    *   Purely decorative frames, borders, or separator lines.
    *   Abstract textures (gradients, blurs) without a defined product.

*   **Ambiguous/Irrelevant Person:**
    *   The image shows a person or body part that is blurry, obscured, or heavily cropped (e.g., just a back, an arm holding a bottle).
    *   **CRITICAL EXCEPTION:** Do NOT exclude the image if it shows a **cosmetic result** (e.g., nails with polish, lips with lipstick, eye makeup, or hair color swatch). These are informational.

*   **Unknown/Corrupted:**
    *   The content is too dark, corrupted, or visually ambiguous to identify with certainty.

*   **Action:** If the image matches the exclusion criteria (and isn't an exception) -> Output strictly an empty string.

**STEP 3: GENERATION RULES (STRICT LOGIC)**
If the image passed the checks, follow this priority order:

1.  **DEFINE THE OBJECT:**
    *   Start with the specific product type, body part (for swatches), or subject.
    *   *Examples:* "Origen Yucatan Midnight Amber body mist bottle...", "Hand showing red nail polish..."

2.  **CONTEXTUAL TEXT FILTERING:**
    *   **Text ON the product:** Transcribe ONLY the Brand, Product Name, and Shade. IGNORE fine print/ingredients.
    *   **Text NEXT TO the product:** If there is a layout with headlines or bullet points, INCLUDE them (summarize if very long).

3.  **VISUAL SUPPORT:**
    *   Mention key visual elements (e.g., "with amber stones").
    *   If describing a model/swatch, focus solely on the cosmetic attribute (e.g., "glossy finish", "volumized lashes").

4.  **FINAL ASSEMBLY:**
    *   Combine: [Object] + [Visual Context] + "Text: [Layout Text/Headline]".
    *   Keep it concise (under 150 chars preferred).`

export interface ContentstackAPIError extends Error {
    errorMessage?: string;
    errors?: Array<{ message: string }>;
}