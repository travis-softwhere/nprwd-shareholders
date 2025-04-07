import { initDatabase } from "../src/lib/db/init-db"

async function main() {
    try {
        await initDatabase()
        process.exit(0) // Success
    } catch (error) {
        process.exit(1) // Error
    }
}

main()