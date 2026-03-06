/** session.ts — v2 session persistence API */
import { v2delete, v2get, v2post } from './v2client';
import type { SessionState } from '@/store/sessionStore';

export async function fetchSession(): Promise<SessionState> {
  return v2get('/session');
}

export async function saveSession(state: Partial<SessionState>): Promise<SessionState> {
  return v2post('/session', state);
}

export async function clearSession(): Promise<{ message: string }> {
  return v2delete('/session');
}
