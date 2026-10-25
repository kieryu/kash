import type { StrategyKey } from './compare';

// 04a "Help me choose" (design/proposals/quiz.md). Only free strategies are recommended.
export type Motivation = 'wins' | 'savings';

export function recommend(motivation: Motivation, ownOrder: boolean): StrategyKey {
  if (ownOrder) return 'custom';
  return motivation === 'wins' ? 'snowball' : 'avalanche';
}
