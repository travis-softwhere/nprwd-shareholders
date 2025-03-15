// No logging for any environment

// Log levels enum - keeping for type compatibility with existing code
export enum LogLevel {
    DEBUG = "DEBUG",
    INFO = "INFO",
    WARN = "WARN",
    ERROR = "ERROR",
}

// Empty interface for type compatibility
interface LogEntry {
    timestamp: string
    level: LogLevel
    category: string
    message: string
    metadata?: Record<string, any>
}

// No-op performance tracking
export function startTimer(markerId: string) {
    // No-op implementation
    return;
}

export function endTimer(markerId: string): number {
    // No-op implementation
    return 0;
}

// Empty console methods - no logging in any environment
export const safeConsole = {
    log: (_message: string, ..._args: any[]) => {},
    error: (_message: string, ..._args: any[]) => {},
    warn: (_message: string, ..._args: any[]) => {},
    info: (_message: string, ..._args: any[]) => {},
    debug: (_message: string, ..._args: any[]) => {}
};

// No-op file logging
export async function logToFile(
    _category: string,
    _message: string,
    _level: LogLevel = LogLevel.INFO,
    _metadata?: Record<string, any>,
) {
    // No-op implementation
    return;
}

// No-op database logging
export async function logDbOperation(
    _operation: string,
    _details: {
        table: string
        action: string
        recordCount?: number
        duration?: number
        error?: Error
    },
) {
    // No-op implementation
    return;
}