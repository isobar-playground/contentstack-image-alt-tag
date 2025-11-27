import express from 'express';
import { readFile } from 'fs/promises';
import path from 'path';
import { glob } from 'glob';

const app = express();
const PORT = 3001;
const BATCH_REQUESTS_GLOB = path.join(process.cwd(), 'outputs', 'batch-requests-*.jsonl');
const ALT_TAGS_PATH = path.join(process.cwd(), 'outputs', 'alt-tags.json');

// Function to extract the required data from a single JSON object from the .jsonl file
const extractDataFromRequest = (jsonRequest) => {
  try {
    const userMessageContent = jsonRequest.body.messages.find(m => m.role === 'user')?.content;
    if (!userMessageContent || !Array.isArray(userMessageContent)) return null;

    const textPart = userMessageContent.find(c => c.type === 'text');
    const imageUrlPart = userMessageContent.find(c => c.type === 'image_url');

    if (!textPart || !imageUrlPart) return null;

    // Extract the core UID from the custom_id (e.g., "image-blt123-0" -> "blt123")
    const uid = jsonRequest.custom_id.split('-')[1];

    return {
      id: jsonRequest.custom_id,
      uid: uid,
      promptText: textPart.text,
      imageUrl: imageUrlPart.image_url.url,
    };
  } catch (e) {
    console.error('Error parsing a request object:', e);
    return null;
  }
};

// Route to display the batch requests and their results
app.get('/', async (req, res) => {
  try {
    // Find all request files
    const requestFiles = await glob(BATCH_REQUESTS_GLOB, { ignore: 'node_modules/**' });
    if (requestFiles.length === 0) {
        return res.status(404).send('<h1>Error</h1><p>No `batch-requests-*.jsonl` files found in `outputs/` directory. Please run step 4 first.</p>');
    }

    // Read and process all request files
    let allRequests = [];
    for (const file of requestFiles) {
      const content = await readFile(file, 'utf8');
      const lines = content.split('\n').filter(line => line.trim() !== '');
      for (const line of lines) {
        const jsonData = JSON.parse(line);
        const extracted = extractDataFromRequest(jsonData);
        if (extracted) {
          allRequests.push(extracted);
        }
      }
    }

    // Read the results file and create a map
    let altTagsMap = new Map();
    try {
        const altTagsContent = await readFile(ALT_TAGS_PATH, 'utf8');
        const altTags = JSON.parse(altTagsContent);
        for (const tag of altTags) {
            altTagsMap.set(tag.uid, { altText: tag.altText, error: tag.error });
        }
    } catch (e) {
        if (e.code !== 'ENOENT') throw e;
        // alt-tags.json might not exist yet, which is fine.
        console.log('alt-tags.json not found, will not display generated tags.');
    }


    let html = `
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Batch Request & Result Review</title>
        <style>
          * { box-sizing: border-box; }
          body { font-family: sans-serif; margin: 0; padding: 2em; background-color: #f8f9fa; color: #212529; }
          h1 { color: #343a40; }
          .gallery { display: grid; grid-template-columns: repeat(auto-fill, minmax(450px, 1fr)); gap: 20px; }
          .card { background: #fff; border: 1px solid #dee2e6; border-radius: 8px; padding: 15px; box-shadow: 0 2px 4px rgba(0,0,0,0.05); display: flex; flex-direction: column; }
          .card img { max-width: 100%; height: auto; border-radius: 4px; margin-bottom: 15px; }
          .card p { font-size: 0.9em; margin: 5px 0; }
          .card pre { flex-grow: 1; background-color: #e9ecef; padding: 10px; border-radius: 4px; white-space: pre-wrap; word-wrap: break-word; font-size: 0.85em; margin-bottom: 10px; }
          .label { font-weight: bold; color: #007bff; }
          .alt-text { background-color: #d4edda; color: #155724; padding: 10px; border-radius: 4px; border-left: 5px solid #28a745;}
          .error-text { background-color: #f8d7da; color: #721c24; padding: 10px; border-radius: 4px; border-left: 5px solid #dc3545;}
          .no-data { font-size: 1.2em; color: #6c757d; }
        </style>
      </head>
      <body>
        <h1>Batch Request & Result Review (${allRequests.length} items)</h1>
    `;

    if (allRequests.length === 0) {
      html += '<p class="no-data">No valid requests found in the files.</p>';
    } else {
      html += '<div class="gallery">';
      for (const item of allRequests) {
        const result = altTagsMap.get(item.uid);
        html += `
          <div class="card">
            <img src="${item.imageUrl}" alt="Preview for ${item.id}">
            <p class="label">User Prompt:</p>
            <pre>${item.promptText.replace(/\\n/g, '<br>')}</pre>
            <p class="label">Generated ALT Tag:</p>
            ${result ? 
                (result.error ? `<div class="error-text"><b>Error:</b> ${result.error}</div>` : `<div class="alt-text">${result.altText || 'Empty response'}</div>`) : 
                '<div class="no-data">Not yet generated.</div>'
            }
          </div>
        `;
      }
      html += '</div>';
    }

    html += `
      </body>
      </html>
    `;
    res.send(html);
  } catch (error) {
    console.error(error);
    res.status(500).send('<h1>Error</h1><p>An error occurred while reading or parsing the files.</p>');
  }
});

app.listen(PORT, () => {
  console.log(`Batch Request & Result review server started on http://localhost:${PORT}`);
  console.log('Press Ctrl+C to stop the server.');
});
