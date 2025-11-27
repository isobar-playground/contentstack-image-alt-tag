import express from 'express';
import { readFile, writeFile } from 'fs/promises';
import path from 'path';
import { exec } from 'child_process';

const app = express();
const PORT = 3000;
const IMAGES_JSON_PATH = path.join(process.cwd(), 'outputs', 'images.json');

function openInBrowser(url) {
  const platform = process.platform;
  let command;

  if (platform === 'darwin') {
    command = `open "${url}"`;
  } else if (platform === 'win32') {
    command = `start "" "${url}"`;
  } else {
    command = `xdg-open "${url}"`;
  }

  exec(command, (err) => {
    if (err) {
      console.error(`Failed to open browser: ${err.message}`);
    }
  });
}

// Middleware to parse URL-encoded bodies (as sent by HTML forms)
app.use(express.urlencoded({ extended: true }));

// Route to display images
app.get('/', async (req, res) => {
  try {
    const data = await readFile(IMAGES_JSON_PATH, 'utf8');
    const images = JSON.parse(data);

    // Group images by usage
    const groupedImages = {};
    for (const image of images) {
      if (image.usages && image.usages.length > 0) {
        for (const usage of image.usages) {
          const key = usage.key || 'Unknown Usage';
          if (!groupedImages[key]) {
            groupedImages[key] = [];
          }
          if (!groupedImages[key].some(img => img.uid === image.uid)) {
            groupedImages[key].push(image);
          }
        }
      } else {
        if (!groupedImages['Unused']) {
          groupedImages['Unused'] = [];
        }
        groupedImages['Unused'].push(image);
      }
    }

    let html = `
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Image Review</title>
        <style>
          * { box-sizing: border-box; }
          body { font-family: sans-serif; margin: 0; padding: 2em; background-color: #f4f4f9; color: #333; }
          h1 { color: #555; }
          h2.group-title { color: #3498db; border-bottom: 2px solid #3498db; padding-bottom: 5px; margin-top: 2em; }
          .gallery { display: grid; grid-template-columns: repeat(auto-fill, minmax(250px, 1fr)); gap: 20px; }
          .image-card { background: #fff; border: 1px solid #ddd; border-radius: 8px; padding: 15px; text-align: center; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
          .image-card img { max-width: 100%; height: auto; border-radius: 4px; margin-bottom: 10px; }
          .image-card p { font-size: 0.9em; word-break: break-all; margin: 0 0 10px 0; }
          .delete-btn { background-color: #e74c3c; color: white; border: none; padding: 8px 12px; border-radius: 4px; cursor: pointer; font-size: 0.9em; }
          .delete-btn:hover { background-color: #c0392b; }
          .no-images { font-size: 1.2em; color: #888; }
        </style>
      </head>
      <body>
        <h1>Image Review (${images.length} images)</h1>
    `;

    if (images.length === 0) {
      html += '<p class="no-images">No images to display.</p>';
    } else {
      const sortedGroups = Object.keys(groupedImages).sort();
      for (const groupName of sortedGroups) {
        html += `<h2 class="group-title">${groupName} (${groupedImages[groupName].length} images)</h2>`;
        html += '<div class="gallery">';
        for (const image of groupedImages[groupName]) {
          html += `
            <div class="image-card">
              <img src="${image.url}" alt="${image.filename}" width="200">
              <p><strong>Filename:</strong> ${image.filename}</p>
              <p><strong>UID:</strong> ${image.uid}</p>
              <form action="/delete" method="POST" style="display:inline;">
                <input type="hidden" name="delete_uid" value="${image.uid}">
                <button type="submit" class="delete-btn">Delete</button>
              </form>
            </div>
          `;
        }
        html += '</div>';
      }
    }

    html += `
      </body>
      </html>
    `;
    res.send(html);
  } catch (error) {
    if (error.code === 'ENOENT') {
      res.status(404).send('<h1>Error</h1><p>Could not find outputs/images.json. Please run step 1 first.</p>');
    } else {
      console.error(error);
      res.status(500).send('<h1>Error</h1><p>An error occurred while reading the image data.</p>');
    }
  }
});

// Route to handle deletion
app.post('/delete', async (req, res) => {
  const { delete_uid } = req.body;
  if (!delete_uid) {
    return res.status(400).send('No image UID provided.');
  }

  try {
    const data = await readFile(IMAGES_JSON_PATH, 'utf8');
    let images = JSON.parse(data);

    const initial_count = images.length;
    images = images.filter(image => image.uid !== delete_uid);
    const final_count = images.length;

    if (initial_count > final_count) {
        await writeFile(IMAGES_JSON_PATH, JSON.stringify(images, null, 2), 'utf8');
        console.log(`Deleted image with UID: ${delete_uid}.`);
    } else {
        console.log(`Image with UID ${delete_uid} not found. No changes made.`);
    }

    res.redirect('/');
  } catch (error) {
    console.error(error);
    res.status(500).send('An error occurred while updating the image data.');
  }
});

app.listen(PORT, () => {
  const url = `http://localhost:${PORT}`;
  console.log(`Image review server started on ${url}`);
  console.log('Press Ctrl+C to stop the server.');
  openInBrowser(url);
});
