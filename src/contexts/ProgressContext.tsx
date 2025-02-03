"use client"

import type React from "react"
import { createContext, useContext, useState } from "react"

interface ProgressContextType {
    progress: number
    setProgress: (progress: number) => void
    processedRecords: number
    setProcessedRecords: (records: number) => void
    totalRecords: number
    setTotalRecords: (total: number) => void
    isProcessing: boolean
    setIsProcessing: (isProcessing: boolean) => void
}

const ProgressContext = createContext<ProgressContextType | undefined>(undefined)

export function ProgressProvider({ children }: { children: React.ReactNode }) {
    const [progress, setProgress] = useState(0)
    const [processedRecords, setProcessedRecords] = useState(0)
    const [totalRecords, setTotalRecords] = useState(0)
    const [isProcessing, setIsProcessing] = useState(false)

    return (
        <ProgressContext.Provider
            value={{
                progress,
                setProgress,
                processedRecords,
                setProcessedRecords,
                totalRecords,
                setTotalRecords,
                isProcessing,
                setIsProcessing,
            }}
        >
            {children}
        </ProgressContext.Provider>
    )
}

export function useProgress() {
    const context = useContext(ProgressContext)
    if (context === undefined) {
        throw new Error("useProgress must be used within a ProgressProvider")
    }
    return context
}