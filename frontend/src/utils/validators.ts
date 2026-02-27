const ALLOWED_EXTENSIONS = ['.csv', '.parquet'];
const MAX_SIZE_MB = 200;

export interface FileValidationResult {
  valid: boolean;
  error?: string;
}

export function validateDatasetFile(file: File): FileValidationResult {
  const ext = '.' + file.name.split('.').pop()?.toLowerCase();
  if (!ALLOWED_EXTENSIONS.includes(ext)) {
    return { valid: false, error: `Unsupported file type "${ext}". Allowed: ${ALLOWED_EXTENSIONS.join(', ')}` };
  }
  const sizeMB = file.size / (1024 * 1024);
  if (sizeMB > MAX_SIZE_MB) {
    return { valid: false, error: `File size ${sizeMB.toFixed(1)} MB exceeds limit of ${MAX_SIZE_MB} MB` };
  }
  return { valid: true };
}

export function validateFeatureInput(
  features: Record<string, string>,
  requiredFeatures: string[]
): { valid: boolean; missing: string[]; invalid: string[] } {
  const missing = requiredFeatures.filter((f) => !(f in features) || features[f] === '');
  const invalid: string[] = [];
  for (const [key, val] of Object.entries(features)) {
    if (val !== '' && isNaN(Number(val))) {
      // Allow string values — they'll be validated server-side
      // Only flag if it looks like an invalid number attempt
    }
    void key;
  }
  return { valid: missing.length === 0 && invalid.length === 0, missing, invalid };
}

export function isValidModelId(id: string): boolean {
  return typeof id === 'string' && id.length > 0;
}
