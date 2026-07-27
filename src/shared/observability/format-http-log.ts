export type HttpStatusColor = 'green' | 'cyan' | 'yellow' | 'red';

const ANSI = {
  reset: '\u001b[0m',
  green: '\u001b[32m',
  cyan: '\u001b[36m',
  yellow: '\u001b[33m',
  red: '\u001b[31m',
} as const;

export function httpStatusColor(status: number): HttpStatusColor {
  if (status >= 500) return 'red';
  if (status >= 400) return 'yellow';
  if (status >= 300) return 'cyan';
  return 'green';
}

export function shouldSkipHttpLog(method: string, pathname: string): boolean {
  if (method.toUpperCase() === 'OPTIONS') return true;
  if (pathname === '/health') return true;
  return false;
}

export type FormatHttpLogLineInput = {
  method: string;
  pathname: string;
  status: number;
  durationMs: number;
  color: boolean;
};

export function formatHttpLogLine(input: FormatHttpLogLineInput): string {
  const plain = `HTTP ${input.method.toUpperCase()} ${input.pathname} ${input.status} ${input.durationMs}ms`;
  if (!input.color) {
    return plain;
  }

  const color = ANSI[httpStatusColor(input.status)];
  return `${color}${plain}${ANSI.reset}`;
}
