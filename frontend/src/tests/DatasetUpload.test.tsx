import { describe, it, expect, vi } from 'vitest';
import { render, screen, waitFor, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { DatasetUpload } from '@/components/dataset/DatasetUpload';

describe('DatasetUpload', () => {
  it('renders dropzone correctly', () => {
    render(<DatasetUpload onUpload={vi.fn()} />);
    expect(screen.getByText(/drag & drop/i)).toBeInTheDocument();
    expect(screen.getByText(/CSV or Parquet/i)).toBeInTheDocument();
  });

  it('shows upload button after staging valid file', async () => {
    const onUpload = vi.fn().mockResolvedValue(undefined);
    render(<DatasetUpload onUpload={onUpload} />);

    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    const file = new File(['col1,col2\n1,2\n3,4'], 'test.csv', { type: 'text/csv' });

    await act(async () => {
      await userEvent.upload(input, file);
    });

    await waitFor(() => {
      expect(screen.getByText('test.csv')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /upload/i })).toBeInTheDocument();
    });
  });

  it('rejects non-CSV/Parquet files', async () => {
    render(<DatasetUpload onUpload={vi.fn()} />);

    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    const file = new File(['test'], 'test.pdf', { type: 'application/pdf' });

    await act(async () => {
      await userEvent.upload(input, file);
    });

    await waitFor(() => {
      expect(screen.getByText(/unsupported file type/i)).toBeInTheDocument();
    });
  });

  it('shows progress bar when uploading', () => {
    render(<DatasetUpload onUpload={vi.fn()} uploading={true} uploadProgress={45} />);
    expect(screen.getByText('Uploading…')).toBeInTheDocument();
    expect(screen.getByText('45%')).toBeInTheDocument();
  });
});
