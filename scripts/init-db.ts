import { initDatabase } from "../src/lib/db/init-db"

async function main() {
    try {
        await initDatabase()
        console.log("Database initialization completed successfully")
    } catch (error) {
        console.error("Database initialization failed:", error)
        process.exit(1)
    }
}

main()