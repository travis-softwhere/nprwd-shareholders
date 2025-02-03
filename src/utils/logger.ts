import fs from "fs/promises"
import path from "path"

export async function logToFile(logName: string, message: string) {
    const now = new Date()
    const timestamp = now.toISOString()
    const logDir = path.join(process.cwd(), "logs")
    const logFile = path.join(logDir, `${logName}-${now.toISOString().split("T")[0]}.log`)

    try {
        // Create logs directory if it doesn't exist
        await fs.mkdir(logDir, { recursive: true })

        // Append log with timestamp
        await fs.appendFile(logFile, `${timestamp} - ${message}\n`)
    } catch (error) {
        console.error(`Failed to write to log file ${logFile}:`, error)
    }
}