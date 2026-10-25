// Running token totals and token budgets, as metrics/tokens.py defines them (shown by the SCORE
// line and the Tokens view). The data tests check these against the real recall@budget values.

/** Running totals: cum[k] is the tokens read after hit k + 1. */
export function runningTotals(tokens: number[]): number[] {
  const cum: number[] = [];
  tokens.reduce((a, b, k) => (cum[k] = a + b), 0);
  return cum;
}

/** How many whole hits fit in a budget: the agent stops before a hit that would pass it. */
export function hitsInBudget(cum: number[], budget: number): number {
  const k = cum.findIndex((c) => c > budget);
  return k === -1 ? cum.length : k;
}
