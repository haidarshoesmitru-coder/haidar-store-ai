import { env } from '@/shared/config/env';

/**
 * Why this file exists:
 * "console.log" scattered through a codebase is unsearchable and
 * unstructured. This gives every part of the app one logging surface that
 * always emits structured, leveled, greppable output — and gives us a
 * single place to later swap in a real log pipeline (Pino + a log
 * aggregator) without touching every call site.
 *
 * Responsibility: format and emit log lines. Nothing else — it does not
 * decide *what* is worth logging, that's the caller's job.
 *
 * Dependencies: env.ts (for LOG_LEVEL).
 * Future usage: api-handler.ts logs every request/error through this;
 * services log significant business events (order created, stock adjusted)
 * through this, not through ad hoc console calls.
 */

type LogLevel = 'debug' | 'info' | 'warn' | 'error';

const LEVEL_WEIGHT: Record<LogLevel, number> = {
  debug: 10,
  info: 20,
  warn: 30,
  error: 40,
};

type LogContext = Record<string, unknown>;

function shouldLog(level: LogLevel): boolean {
  return LEVEL_WEIGHT[level] >= LEVEL_WEIGHT[env.LOG_LEVEL];
}

function emit(level: LogLevel, message: string, context?: LogContext): void {
  if (!shouldLog(level)) return;

  const entry = {
    timestamp: new Date().toISOString(),
    level,
    message,
    ...context,
  };

  // A single JSON.stringify per line keeps every environment (local
  // terminal, Vercel logs, a future log aggregator) able to parse this the
  // same way. Error level goes to stderr so infra can split streams.
  const line = JSON.stringify(entry);
  if (level === 'error') {
    // eslint-disable-next-line no-console
    console.error(line);
  } else {
    // eslint-disable-next-line no-console
    console.log(line);
  }
}

export const logger = {
  debug: (message: string, context?: LogContext) => emit('debug', message, context),
  info: (message: string, context?: LogContext) => emit('info', message, context),
  warn: (message: string, context?: LogContext) => emit('warn', message, context),
  error: (message: string, context?: LogContext) => emit('error', message, context),
};
