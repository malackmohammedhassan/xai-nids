/**
 * WebSocket message parser tests.
 *
 * We don't mount the hook (which needs a running server);
 * instead we test the pure parse logic that processes messages.
 * The hook itself is tested via useJobWebSocket integration path.
 */
import { describe, it, expect } from 'vitest';

// ─── Inline the parse logic (mirroring useWebSocket.ts) ──────────────────────

type TrainingProgressEvent = {
  event?: string;
  data?: Record<string, unknown>;
  // flattened legacy shape
  status?: string;
  progress_pct?: number;
  current_step?: string;
  error_message?: string;
};

function parseWsMessage(raw: string): TrainingProgressEvent | null {
  try {
    return JSON.parse(raw) as TrainingProgressEvent;
  } catch {
    return null;
  }
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('WebSocket message parser', () => {
  it('parses a well-formed step event', () => {
    const msg = JSON.stringify({
      event: 'step',
      data: { step_name: 'Preprocessing', step_number: 1, total_steps: 5, progress_pct: 20 },
    });
    const result = parseWsMessage(msg);
    expect(result).not.toBeNull();
    expect(result!.event).toBe('step');
    expect((result!.data as any).progress_pct).toBe(20);
  });

  it('parses a log event', () => {
    const msg = JSON.stringify({
      event: 'log',
      data: { level: 'INFO', message: 'Training started', timestamp: '12:00:00' },
    });
    const result = parseWsMessage(msg);
    expect(result!.event).toBe('log');
    expect((result!.data as any).message).toBe('Training started');
  });

  it('parses a metrics event', () => {
    const msg = JSON.stringify({
      event: 'metrics',
      data: { accuracy: 0.95, f1_score: 0.94 },
    });
    const result = parseWsMessage(msg);
    expect((result!.data as any).accuracy).toBe(0.95);
  });

  it('parses a complete event', () => {
    const msg = JSON.stringify({
      event: 'complete',
      data: { duration_seconds: 12.5, failed: false },
    });
    const result = parseWsMessage(msg);
    expect(result!.event).toBe('complete');
    expect((result!.data as any).failed).toBe(false);
  });

  it('returns null for malformed JSON', () => {
    expect(parseWsMessage('{')).toBeNull();
    expect(parseWsMessage('')).toBeNull();
    expect(parseWsMessage('undefined')).toBeNull();
  });

  it('handles legacy flat status shape', () => {
    const msg = JSON.stringify({
      status: 'RUNNING',
      progress_pct: 45,
      current_step: 'Training Model',
    });
    const result = parseWsMessage(msg);
    expect(result!.status).toBe('RUNNING');
    expect(result!.progress_pct).toBe(45);
  });

  it('handles empty object without throwing', () => {
    const result = parseWsMessage('{}');
    expect(result).not.toBeNull();
    expect(typeof result).toBe('object');
  });

  it('handles JSON array (unexpected shape) without crashing', () => {
    const result = parseWsMessage('[1,2,3]');
    expect(Array.isArray(result)).toBe(true);
  });
});

// ─── Event type discriminator ─────────────────────────────────────────────────

describe('WebSocket event type discrimination', () => {
  type WsEvent = { event: string; data: Record<string, unknown> };

  function routeEvent(msg: WsEvent, handlers: Record<string, (d: Record<string, unknown>) => void>) {
    handlers[msg.event]?.(msg.data);
  }

  it('routes step event to step handler', () => {
    const stepHandler = (d: Record<string, unknown>) => {
      expect(d.step_name).toBe('Training');
    };
    routeEvent(
      { event: 'step', data: { step_name: 'Training', progress_pct: 40 } },
      { step: stepHandler }
    );
    expect.assertions(1);
  });

  it('does not crash on unhandled event type', () => {
    expect(() =>
      routeEvent({ event: 'unknown_future_event', data: {} }, {})
    ).not.toThrow();
  });
});
