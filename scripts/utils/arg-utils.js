export function isDryRun() {
  return process.argv.includes('--dry-run');
}

export const DEFAULT_BATCH_SIZE = 5;

export function getBatchSize() {
  const batchSizeArg = process.argv.find(arg => arg.startsWith('--batch-size='));
  if (batchSizeArg) {
    const size = parseInt(batchSizeArg.split('=')[1], 10);
    if (isNaN(size) || size < 1) {
      console.warn('Invalid batch size argument, using default value');
      return DEFAULT_BATCH_SIZE;
    }
    return size;
  }
  
  const envBatchSize = process.env.BATCH_SIZE;
  if (envBatchSize) {
    const size = parseInt(envBatchSize, 10);
    if (isNaN(size) || size < 1) {
      console.warn('Invalid BATCH_SIZE environment variable, using default value');
      return DEFAULT_BATCH_SIZE;
    }
    return size;
  }
  
  return DEFAULT_BATCH_SIZE;
}

