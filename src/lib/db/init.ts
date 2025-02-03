import { runMigration } from "./migrate"

export async function initDatabase() {
    console.log("Initializing database...")
    const result = await runMigration()
    if (result.success) {
        console.log("Database initialized successfully")
    } else {
        console.error("Failed to initialize database:", result.error)
    }
}