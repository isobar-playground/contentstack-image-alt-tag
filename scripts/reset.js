import fs from 'fs';
import path from 'path';
import { getOutputsDir } from './utils/file-utils.js';

function formatDateTime(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  const seconds = String(date.getSeconds()).padStart(2, '0');
  
  return `${year}-${month}-${day}-${hours}-${minutes}-${seconds}`;
}

function main() {
  try {
    const outputsDir = getOutputsDir();
    
    if (!fs.existsSync(outputsDir)) {
      console.log('Outputs directory does not exist, nothing to reset.');
      return;
    }
    
    // Get all .json and .jsonl files
    const files = fs.readdirSync(outputsDir).filter(file => {
      return file.endsWith('.json') || file.endsWith('.jsonl');
    });
    
    if (files.length === 0) {
      console.log('No JSON/JSONL files to move.');
      return;
    }
    
    // Create backup directory with current date-time
    const now = new Date();
    const backupDirName = formatDateTime(now);
    const backupDir = path.join(outputsDir, backupDirName);
    
    fs.mkdirSync(backupDir, { recursive: true });
    console.log(`Created backup directory: ${backupDirName}`);
    
    // Move files to backup directory
    let movedCount = 0;
    for (const file of files) {
      const sourcePath = path.join(outputsDir, file);
      const destPath = path.join(backupDir, file);
      
      fs.renameSync(sourcePath, destPath);
      movedCount++;
      console.log(`Moved: ${file}`);
    }
    
    console.log(`\n✓ Successfully moved ${movedCount} file(s) to outputs/${backupDirName}/`);
  } catch (error) {
    console.error('Error during reset:', error);
    process.exit(1);
  }
}

main();
