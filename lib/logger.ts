type LogEntry = {
  timestamp: string;
  level: 'error' | 'warn' | 'info';
  scope: string;
  message: string;
  details?: unknown;
};

const RING_SIZE = 100;
const ring: LogEntry[] = [];

function push(entry: LogEntry) {
  ring.push(entry);
  if (ring.length > RING_SIZE) ring.shift();
}

function format(scope: string, message: string, details?: unknown): string {
  const ts = new Date().toISOString();
  const detailStr = details ? ` :: ${stringify(details)}` : '';
  return `[${ts}] [${scope}] ${message}${detailStr}`;
}

function stringify(v: unknown): string {
  if (v instanceof Error) return `${v.name}: ${v.message}`;
  if (typeof v === 'string') return v;
  try { return JSON.stringify(v); } catch { return String(v); }
}

export function logError(scope: string, message: string, details?: unknown) {
  const entry: LogEntry = { timestamp: new Date().toISOString(), level: 'error', scope, message, details };
  push(entry);
  console.error(format(scope, message, details));
}

export function logWarn(scope: string, message: string, details?: unknown) {
  const entry: LogEntry = { timestamp: new Date().toISOString(), level: 'warn', scope, message, details };
  push(entry);
  console.warn(format(scope, message, details));
}

export function logInfo(scope: string, message: string, details?: unknown) {
  const entry: LogEntry = { timestamp: new Date().toISOString(), level: 'info', scope, message, details };
  push(entry);
  console.log(format(scope, message, details));
}

export function getRecentLogs(): LogEntry[] {
  return [...ring];
}
