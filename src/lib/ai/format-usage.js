/**
 * costUsd at 4 decimal places, not 2 — a single turn typically runs
 * $0.0002-$0.004, and 2dp would render "$0.00" for nearly every row.
 */
export function formatUsage(usage) {
  if (!usage || usage.totalTokens == null) return null;
  const tokens = `~${Number(usage.totalTokens).toLocaleString()} tokens`;
  if (usage.costUsd == null) return tokens;
  return `${tokens} · $${Number(usage.costUsd).toFixed(4)}`;
}
