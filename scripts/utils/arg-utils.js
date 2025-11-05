export function isDryRun() {
  return process.argv.includes('--dry-run');
}

export function getBatchSize() {
  const batchSizeArg = process.argv.find(arg => arg.startsWith('--batch-size='));
  if (batchSizeArg) {
    const size = parseInt(batchSizeArg.split('=')[1], 10);
    if (isNaN(size) || size < 1) {
      console.warn('Invalid batch size argument, using default value');
      return 5;
    }
    return size;
  }
  
  const envBatchSize = process.env.BATCH_SIZE;
  if (envBatchSize) {
    const size = parseInt(envBatchSize, 10);
    if (isNaN(size) || size < 1) {
      console.warn('Invalid BATCH_SIZE environment variable, using default value');
      return 5;
    }
    return size;
  }
  
  return 5;
}

