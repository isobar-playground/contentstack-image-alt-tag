import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export function getScriptDir() {
  return path.dirname(__dirname);
}

export function getOutputsDir() {
  return path.join(getScriptDir(), '../outputs');
}

export function getOutputPath(filename) {
  return path.join(getOutputsDir(), filename);
}

export function readJsonFile(filename, required = true) {
  const filePath = getOutputPath(filename);
  
  if (!fs.existsSync(filePath)) {
    if (required) {
      console.error(`Error: File outputs/${filename} does not exist. Run previous step first`);
      process.exit(1);
    }
    return null;
  }
  
  return JSON.parse(fs.readFileSync(filePath, 'utf-8'));
}

export function writeJsonFile(filename, data) {
  const filePath = getOutputPath(filename);
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
  return filePath;
}

export function readTextFile(filepath) {
  if (!fs.existsSync(filepath)) {
    console.error(`Error: File ${filepath} does not exist`);
    process.exit(1);
  }
  return fs.readFileSync(filepath, 'utf-8').trim();
}

export function getInstructionsPath() {
  return path.join(getScriptDir(), '../alt-generation-instructions.md');
}

export function writeTextFile(filename, content) {
  const filePath = getOutputPath(filename);
  fs.writeFileSync(filePath, content);
  return filePath;
}

export function createReadStream(filename) {
  const filePath = getOutputPath(filename);
  return fs.createReadStream(filePath);
}

