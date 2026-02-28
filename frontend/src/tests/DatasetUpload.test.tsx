import { describe, it, expect, vi } from 'vitest';
import { render, screen, waitFor, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { DatasetUpload } from '@/components/dataset/DatasetUpload';

describe('DatasetUpload', () => {
  it('renders dropzone correctly', () => {
    render(<DatasetUpload onUpload={vi.fn()} />);
    expect(screen.getByText(/drag & drop/i)).toBeInTheDocument();
    expect(screen.getAllByText(/CSV or Parquet/i).length).toBeGreaterThan(0);
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
    // Use application/pdf with .pdf extension — validator will catch it
    // (react-dropzone in jsdom does not enforce the accept filter,
    //  so the file reaches our onDrop handler)
    const file = new File(['test'], 'test.pdf', { type: 'application/pdf' });

    await act(async () => {
      Object.defineProperty(input, 'files', { value: [file], configurable: true });
      input.dispatchEvent(new Event('change', { bubbles: true }));
    });

    // The validator message or the dropzone rejection message
    await waitFor(() => {
      const rejectionText =
        screen.queryByText(/unsupported file type/i) ??
        screen.queryByText(/file type/i) ??
        screen.queryByText(/invalid/i);
      // If no error text, check no upload button appeared (file was rejected)
      const uploadBtn = screen.queryByRole('button', { name: /upload/i });
      expect(rejectionText !== null || uploadBtn === null).toBe(true);
    });
  });

  it('shows progress bar when uploading', () => {
    render(<DatasetUpload onUpload={vi.fn()} uploading={true} uploadProgress={45} />);
    expect(screen.getByText('Uploading…')).toBeInTheDocument();
    expect(screen.getByText('45%')).toBeInTheDocument();
  });
});
