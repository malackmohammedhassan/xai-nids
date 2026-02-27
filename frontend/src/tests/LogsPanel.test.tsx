import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { LogsPanel } from '@/components/training/LogsPanel';

describe('LogsPanel', () => {
  it('shows empty state when no logs', () => {
    render(<LogsPanel logs={[]} onClear={vi.fn()} />);
    expect(screen.getByText(/no logs yet/i)).toBeInTheDocument();
  });

  it('renders log lines', () => {
    const logs = ['[10:00:00] Loading data', '[10:00:01] Preprocessing features'];
    render(<LogsPanel logs={logs} onClear={vi.fn()} />);
    expect(screen.getByText('[10:00:00] Loading data')).toBeInTheDocument();
    expect(screen.getByText('[10:00:01] Preprocessing features')).toBeInTheDocument();
  });

  it('calls onClear when Clear button clicked', async () => {
    const onClear = vi.fn();
    render(<LogsPanel logs={['Line 1']} onClear={onClear} />);
    await userEvent.click(screen.getByText('Clear'));
    expect(onClear).toHaveBeenCalledOnce();
  });

  it('shows correct log count', () => {
    const logs = Array.from({ length: 42 }, (_, i) => `Line ${i}`);
    render(<LogsPanel logs={logs} onClear={vi.fn()} />);
    expect(screen.getByText(/42/)).toBeInTheDocument();
  });
});
