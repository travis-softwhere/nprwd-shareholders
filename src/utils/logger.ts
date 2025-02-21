// Use the web Performance API instead of Node's perf_hooks
const perf =
    typeof performance !== "undefined"
        ? performance
        : {
            now: () => Date.now(),
        }

// Log levels for better filtering
export enum LogLevel {
    DEBUG = "DEBUG",
    INFO = "INFO",
    WARN = "WARN",
    ERROR = "ERROR",
}

interface LogEntry {
    timestamp: string
    level: LogLevel
    category: string
    message: string
    metadata?: Record<string, any>
}

// Performance tracking using web Performance API
const performanceMarkers = new Map<string, number>()

export function startTimer(markerId: string) {
    performanceMarkers.set(markerId, perf.now())
}

export function endTimer(markerId: string): number {
    const start = performanceMarkers.get(markerId)
    if (!start) return 0
    const duration = perf.now() - start
    performanceMarkers.delete(markerId)
    return duration
}

// Memory usage tracking (server-side only)
function getMemoryUsage() {
    if (typeof window !== "undefined") return null

    try {
        const used = process.memoryUsage()
        return {
            heapTotal: Math.round(used.heapTotal / 1024 / 1024),
            heapUsed: Math.round(used.heapUsed / 1024 / 1024),
            external: Math.round(used.external / 1024 / 1024),
            rss: Math.round(used.rss / 1024 / 1024),
        }
    } catch {
        return null
    }
}

export async function logToFile(
    category: string,
    message: string,
    level: LogLevel = LogLevel.INFO,
    metadata?: Record<string, any>,
) {
    const timestamp = new Date().toISOString()
    const memoryUsage = getMemoryUsage()

    const entry: LogEntry = {
        timestamp,
        level,
        category,
        message,
        metadata: {
            ...metadata,
            ...(memoryUsage ? { memory: memoryUsage } : {}),
        },
    }

    // In development, always log to console
    if (process.env.NODE_ENV === "development") {
        console.log(`[${timestamp}] ${level} - ${category}: ${message}`)
        if (metadata) {
            console.log("Metadata:", metadata)
        }
    }

    // Only attempt file operations on server side
    if (typeof window === "undefined") {
        try {
            // Dynamic import of node modules to avoid browser issues
            const fs = await import("fs/promises")
            const path = await import("path")

            const logDirectory = path.join(process.cwd(), "logs")

            // Ensure log directory exists
            try {
                await fs.mkdir(logDirectory, { recursive: true })
            } catch (error) {
                // Ignore error if directory already exists
                if ((error as any).code !== "EEXIST") {
                    throw error
                }
            }

            const logEntry = JSON.stringify(entry, null, 2) + "\n"
            const filePath = path.join(logDirectory, `${category}.log`)

            await fs.writeFile(filePath, logEntry, { flag: "a" })
        } catch (error) {
            // Fallback to console.error if file operations fail
            console.error("Error writing to log file:", error instanceof Error ? error.message : String(error))
        }
    }
}

// Database operation logging
export async function logDbOperation(
    operation: string,
    details: {
        table: string
        action: string
        recordCount?: number
        duration?: number
        error?: Error
    },
) {
    const level = details.error ? LogLevel.ERROR : LogLevel.INFO
    await logToFile("database", `${operation} - ${details.table} - ${details.action}`, level, {
        ...details,
        error: details.error ? details.error.message : undefined,
    })
}