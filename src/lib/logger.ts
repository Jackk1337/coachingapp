import { randomUUID } from 'crypto';

/**
 * Structured logger for security events and request tracking
 */
export class Logger {
  private requestId: string;

  constructor(requestId?: string) {
    this.requestId = requestId || randomUUID();
  }

  /**
   * Get the current request ID
   */
  getRequestId(): string {
    return this.requestId;
  }

  /**
   * Log an info message
   */
  info(message: string, metadata?: Record<string, unknown>): void {
    console.log(JSON.stringify({
      level: 'info',
      requestId: this.requestId,
      message,
      timestamp: new Date().toISOString(),
      ...metadata,
    }));
  }

  /**
   * Log an error message
   */
  error(message: string, error?: Error | unknown, metadata?: Record<string, unknown>): void {
    const errorDetails = error instanceof Error 
      ? { 
          name: error.name,
          message: error.message,
          stack: error.stack,
        }
      : { error: String(error) };

    console.error(JSON.stringify({
      level: 'error',
      requestId: this.requestId,
      message,
      timestamp: new Date().toISOString(),
      ...errorDetails,
      ...metadata,
    }));
  }

  /**
   * Log a warning message
   */
  warn(message: string, metadata?: Record<string, unknown>): void {
    console.warn(JSON.stringify({
      level: 'warn',
      requestId: this.requestId,
      message,
      timestamp: new Date().toISOString(),
      ...metadata,
    }));
  }

  /**
   * Log security-related events
   */
  security(event: string, metadata?: Record<string, unknown>): void {
    console.warn(JSON.stringify({
      level: 'security',
      requestId: this.requestId,
      event,
      timestamp: new Date().toISOString(),
      ...metadata,
    }));
  }
}





