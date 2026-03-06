/**
 * Validation API
 * ==============
 * POST /api/v1/models/{model_id}/validate
 *
 * Accepts a CSV file of NEW (unseen) data and runs it through a trained
 * model, returning per-row predictions + aggregated metrics.
 */
import client from './client';
import type { ValidationSummary } from '@/types/pipeline';

export const validationApi = {
  /**
   * Validate a trained model against a CSV file.
   *
   * @param modelId       The model's ID from the registry
   * @param file          The CSV File object from an <input type="file">
   * @param labelColumn   Optional name of the ground-truth column in the CSV
   * @param maxRows       Cap rows processed (default 50 000)
   * @param onProgress    Optional upload progress callback (0–100)
   */
  validate: async (
    modelId: string,
    file: File,
    labelColumn?: string,
    maxRows: number = 50_000,
    onProgress?: (pct: number) => void,
  ): Promise<ValidationSummary> => {
    const form = new FormData();
    form.append('file', file);
    if (labelColumn) form.append('label_column', labelColumn);
    form.append('max_rows', String(maxRows));

    const response = await client.post<ValidationSummary>(
      `/models/${modelId}/validate`,
      form,
      {
        headers: { 'Content-Type': 'multipart/form-data' },
        onUploadProgress: (e) => {
          if (onProgress && e.total) {
            onProgress(Math.round((e.loaded * 100) / e.total));
          }
        },
      },
    );
    return response.data;
  },
};
