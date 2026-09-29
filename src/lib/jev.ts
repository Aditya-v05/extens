import { request } from './errors';

const ENDPOINT = 'https://api.typesafe.ai/v1/systemone';
const MODEL = 'jev-latest';

export type Question =
  | { type: 'noul'; instructions: string; criteria?: { true: string; false: string } }
  | { type: 'choice'; instructions: string; criteria: Record<string, string> }
  | { type: 'score'; instructions: string; criteria: string[] };

export type Answer =
  | { type: 'noul'; noul: number }
  | { type: 'choice'; choice: string; confidence: number; probabilities: Record<string, number> }
  | { type: 'score'; score: number; confidence: number; probabilities: Record<string, number> };

export async function ask(
  key: string,
  state: unknown,
  questions: Record<string, Question>,
): Promise<Record<string, Answer>> {
  const body = (await request('jev', ENDPOINT, {
    method: 'POST',
    headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ model: MODEL, state, questions }),
  })) as any;
  return body?.answers ?? {};
}

export async function checkKey(key: string): Promise<boolean> {
  const answers = await ask(key, 'ping', { ok: { type: 'noul', instructions: 'Is the state a short word?' } });
  return answers.ok?.type === 'noul';
}

/** Map a Score (0..levels-1) to 0–100. */
export function scoreToPercent(score: number, levels: number): number {
  return Math.round((score / (levels - 1)) * 100);
}
