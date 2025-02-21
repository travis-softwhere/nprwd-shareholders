export interface Meeting {
    id: string
    year: number
    date: string // Changed from Date to string
    totalShareholders: number
    checkedIn: number
    dataSource: "excel" | "database"
    hasInitialData: boolean
    mailersGenerated: boolean
    mailerGenerationDate: string | null // Changed from Date to string | null
    createdAt: string // Changed from Date to string
}
