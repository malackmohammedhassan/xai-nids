import { describe, it, expect, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { PredictionPlayground } from '@/components/prediction/PredictionPlayground';

const FEATURES = ['duration', 'src_bytes', 'dst_bytes', 'protocol_type'];

describe('PredictionPlayground', () => {
  it('renders all feature inputs', () => {
    render(<PredictionPlayground featureNames={FEATURES} onPredict={vi.fn()} />);
    FEATURES.forEach((f) => {
      expect(screen.getByLabelText(f) ?? screen.getByTitle(f) ?? screen.getByDisplayValue('0')).toBeInTheDocument();
    });
    expect(screen.getByRole('button', { name: /run prediction/i })).toBeInTheDocument();
  });

  it('calls onPredict with numeric values', async () => {
    const onPredict = vi.fn().mockResolvedValue({
      model_id: 'x',
      prediction: '0',
      confidence: 0.9,
      probabilities: { '0': 0.9, '1': 0.1 },
      prediction_time_ms: 3,
    });
    render(<PredictionPlayground featureNames={FEATURES} onPredict={onPredict} />);
    await userEvent.click(screen.getByRole('button', { name: /run prediction/i }));
    await waitFor(() => expect(onPredict).toHaveBeenCalledOnce());
    const calledWith = onPredict.mock.calls[0][0];
    expect(typeof calledWith.duration).toBe('number');
  });

  it('shows benign verdict for prediction 0', async () => {
    const onPredict = vi.fn().mockResolvedValue({
      model_id: 'x',
      prediction: '0',
      confidence: 0.95,
      probabilities: {},
      prediction_time_ms: 2,
    });
    render(
      <PredictionPlayground
        featureNames={FEATURES}
        onPredict={onPredict}
        result={{
          model_id: 'x',
          prediction: '0',
          confidence: 0.95,
          probabilities: {},
          prediction_time_ms: 2,
        }}
      />
    );
    expect(screen.getByText(/benign traffic/i)).toBeInTheDocument();
  });

  it('shows attack verdict for prediction 1', () => {
    render(
      <PredictionPlayground
        featureNames={FEATURES}
        onPredict={vi.fn()}
        result={{
          model_id: 'x',
          prediction: 1,
          confidence: 0.87,
          probabilities: {},
          prediction_time_ms: 3,
        }}
      />
    );
    expect(screen.getByText(/intrusion detected/i)).toBeInTheDocument();
  });
});
