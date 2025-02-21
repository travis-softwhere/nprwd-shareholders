"use client"

import type React from "react"
import { createContext, useContext, useState, useCallback, useEffect } from "react"
import { getMeetings } from "@/actions/getMeetings"

export interface Meeting {
    id: string
    year: number
    date: string
    totalShareholders: number
    checkedIn: number
    dataSource: "excel" | "database"
    hasInitialData: boolean
    mailersGenerated: boolean
    mailerGenerationDate: string | null
    createdAt: string
}

interface MeetingContextType {
    selectedMeeting: Meeting | null
    setSelectedMeeting: (meeting: Meeting | null) => void
    isDataLoaded: boolean
    setIsDataLoaded: (loaded: boolean) => void
    refreshMeetings: () => Promise<void>
    meetings: Meeting[]
    setMeetings: React.Dispatch<React.SetStateAction<Meeting[]>>
}

const MeetingContext = createContext<MeetingContextType | undefined>(undefined)

export function MeetingProvider({ children }: { children: React.ReactNode }) {
    const [selectedMeeting, setSelectedMeeting] = useState<Meeting | null>(null)
    const [isDataLoaded, setIsDataLoaded] = useState(false)
    const [meetings, setMeetings] = useState<Meeting[]>([])

    const refreshMeetings = useCallback(async () => {
        try {
            const fetchedMeetings = await getMeetings()
            setMeetings(fetchedMeetings)
            const hasData = fetchedMeetings.some((meeting) => meeting.totalShareholders > 0)
            setIsDataLoaded(hasData)
            setSelectedMeeting((prevSelected) =>
                prevSelected && !fetchedMeetings.find((m) => m.id === prevSelected.id) ? null : prevSelected,
            )
        } catch (error) {
            console.error("Error refreshing meetings:", error)
        }
    }, [])

    useEffect(() => {
        refreshMeetings()
    }, [refreshMeetings])

    return (
        <MeetingContext.Provider
            value={{
                selectedMeeting,
                setSelectedMeeting,
                isDataLoaded,
                setIsDataLoaded,
                refreshMeetings,
                meetings,
                setMeetings,
            }}
        >
            {children}
        </MeetingContext.Provider>
    )
}

export function useMeeting() {
    const context = useContext(MeetingContext)
    if (context === undefined) {
        throw new Error("useMeeting must be used within a MeetingProvider")
    }
    return context
}