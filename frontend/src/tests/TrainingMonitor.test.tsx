import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { TrainingMonitor } from '@/components/training/TrainingMonitor';
import type { TrainingStatus } from '@/types';

describe('TrainingMonitor', () => {
  it('shows waiting state when no status', () => {
    render(<TrainingMonitor status={null} wsConnected={false} logs={[]} />);
    expect(screen.getByText(/waiting for training job/i)).toBeInTheDocument();
  });

  it('displays current step and progress', () => {
    const status: TrainingStatus = {
      is_training: true,
      current_step: 'Training',
      progress: 50,
      total: 100,
    };
    render(<TrainingMonitor status={status} wsConnected={true} logs={[]} />);
    expect(screen.getByText('Training')).toBeInTheDocument();
    expect(screen.getByText('50%')).toBeInTheDocument();
  });

  it('shows model ID on completion', () => {
    const status: TrainingStatus = {
      is_training: false,
      current_step: 'Complete',
      progress: 100,
      total: 100,
      model_id: 'test-model-123',
    };
    render(<TrainingMonitor status={status} wsConnected={true} logs={[]} />);
    expect(screen.getByText(/test-model-123/)).toBeInTheDocument();
  });

  it('shows error message on failure', () => {
    const status: TrainingStatus = {
      is_training: false,
      current_step: 'Error',
      progress: 0,
      total: 100,
      error: 'Out of memory',
    };
    render(<TrainingMonitor status={status} wsConnected={false} logs={[]} />);
    expect(screen.getByText(/out of memory/i)).toBeInTheDocument();
  });

  it('shows WS connection status indicator', () => {
    const status: TrainingStatus = {
      is_training: true,
      current_step: 'Training',
      progress: 30,
      total: 100,
    };
    render(<TrainingMonitor status={status} wsConnected={true} logs={[]} />);
    expect(screen.getByText('Live')).toBeInTheDocument();
  });
});
