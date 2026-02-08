const integerNumberFormat = new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 });
const oneDecimalNumberFormat = new Intl.NumberFormat('en-US', { minimumFractionDigits: 1, maximumFractionDigits: 1 });

export function formatInteger(value: number) {
  return integerNumberFormat.format(value);
}

export function formatOneDecimal(value: number) {
  return oneDecimalNumberFormat.format(value);
}

export function formatEstimate(minutes: number) {
  if (minutes < 60) return `${formatInteger(minutes)}m`;
  const hours = minutes / 60;
  if (Math.abs(hours - Math.round(hours)) < 1e-9) return `${formatInteger(Math.round(hours))}h`;
  return `${formatOneDecimal(hours)}h`;
}

export function formatDuration(ms: number) {
  const totalSeconds = Math.floor(ms / 1000);
  const seconds = totalSeconds % 60;
  const totalMinutes = Math.floor(totalSeconds / 60);
  const minutes = totalMinutes % 60;
  const hours = Math.floor(totalMinutes / 60);

  if (hours > 0) {
    return `${hours}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
  }
  return `${minutes}:${String(seconds).padStart(2, '0')}`;
}

export function timeAgo(timestampMs: number, nowMs: number) {
  const diffMs = nowMs - timestampMs;
  const diffSeconds = Math.floor(diffMs / 1000);
  if (diffSeconds < 5) return 'just now';
  if (diffSeconds < 60) return `${formatInteger(diffSeconds)}s ago`;
  const diffMinutes = Math.floor(diffSeconds / 60);
  if (diffMinutes < 60) return `${formatInteger(diffMinutes)}m ago`;
  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 24) return `${formatInteger(diffHours)}h ago`;
  const diffDays = Math.floor(diffHours / 24);
  return `${formatInteger(diffDays)}d ago`;
}

export function shortId(id: string) {
  if (id.length <= 10) return id;
  return `${id.slice(0, 6)}…${id.slice(-4)}`;
}

