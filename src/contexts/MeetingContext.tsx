"use client"

import { createContext, useContext, useState, useCallback } from "react"
import { getMeetings } from "@/app/actions/getMeetings"

export interface Meeting {
    id: string
    year: number
    date: string
    totalShareholders: number
    checkedIn: number
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
            if (selectedMeeting && !fetchedMeetings.find((m) => m.id === selectedMeeting.id)) {
                setSelectedMeeting(null)
            }
            setIsDataLoaded(true)
        } catch (error) {
            console.error("Error refreshing meetings:", error)
        }
    }, [selectedMeeting])

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