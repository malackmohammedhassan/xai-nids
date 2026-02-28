import { useCallback, useState } from 'react';
import { useDropzone } from 'react-dropzone';
import { UploadCloud, FileText, CheckCircle, AlertCircle } from 'lucide-react';
import { clsx } from 'clsx';
import { validateDatasetFile } from '@/utils/validators';
import { formatBytes } from '@/utils/formatters';

interface Props {
  onUpload: (file: File) => Promise<unknown>;
  uploading?: boolean;
  uploadProgress?: number;
}

export function DatasetUpload({ onUpload, uploading = false, uploadProgress = 0 }: Props) {
  const [error, setError] = useState<string | null>(null);
  const [staged, setStaged] = useState<File | null>(null);

  const onDrop = useCallback(
    (accepted: File[]) => {
      setError(null);
      const file = accepted[0];
      if (!file) return;
      const result = validateDatasetFile(file);
      if (!result.valid) {
        setError(result.error ?? 'Invalid file');
        return;
      }
      setStaged(file);
    },
    []
  );

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { 'text/csv': ['.csv'], 'application/octet-stream': ['.parquet'] },
    maxFiles: 1,
    disabled: uploading,
  });

  const handleUpload = async () => {
    if (!staged) return;
    setError(null);
    try {
      await onUpload(staged);
      setStaged(null);
    } catch {
      setError('Upload failed');
    }
  };

  return (
    <div className="space-y-4">
      <div
        {...getRootProps()}
        className={clsx(
          'border-2 border-dashed rounded-xl p-10 text-center cursor-pointer transition-colors',
          isDragActive
            ? 'border-cyan-500 bg-cyan-500/10'
            : 'border-gray-600 hover:border-gray-500 bg-gray-800/50',
          uploading && 'opacity-50 cursor-not-allowed'
        )}
      >
        <input {...getInputProps()} />
        <UploadCloud
          size={40}
          className={clsx('mx-auto mb-3', isDragActive ? 'text-cyan-400' : 'text-gray-500')}
        />
        <p className="text-gray-300 text-sm font-medium">
          {isDragActive ? 'Drop your dataset here' : 'Drag & drop a CSV or Parquet file'}
        </p>
        <p className="text-gray-500 text-xs mt-1">Max 200 MB · CSV or Parquet</p>
      </div>

      {error && (
        <div className="flex items-center gap-2 text-red-400 text-sm">
          <AlertCircle size={14} />
          {error}
        </div>
      )}

      {staged && !uploading && (
        <div className="flex items-center justify-between bg-gray-800 rounded-lg px-4 py-3">
          <div className="flex items-center gap-3">
            <FileText size={18} className="text-cyan-400" />
            <div>
              <p className="text-sm text-gray-200 font-medium">{staged.name}</p>
              <p className="text-xs text-gray-500">{formatBytes(staged.size)}</p>
            </div>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => setStaged(null)}
              className="text-xs text-gray-500 hover:text-gray-300 px-2 py-1"
            >
              Remove
            </button>
            <button
              onClick={handleUpload}
              className="text-xs bg-cyan-600 hover:bg-cyan-500 text-white px-4 py-1.5 rounded-md transition-colors"
            >
              Upload
            </button>
          </div>
        </div>
      )}

      {uploading && (
        <div className="space-y-1">
          <div className="flex justify-between text-xs text-gray-400">
            <span>Uploading…</span>
            <span>{uploadProgress}%</span>
          </div>
          <div className="w-full h-2 bg-gray-700 rounded-full overflow-hidden">
            <div
              className="h-full bg-cyan-500 transition-all duration-300"
              style={{ width: `${uploadProgress}%` }}
            />
          </div>
        </div>
      )}
    </div>
  );
}
