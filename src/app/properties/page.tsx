"use client"

import { PropertyManagement } from "@/components/PropertyManagement"
import { LoadingScreen } from "@/components/ui/loading-screen"
import { useMeeting } from "@/contexts/MeetingContext"

export default function PropertiesPage() {
    const { selectedMeeting, isLoading } = useMeeting()

    if (isLoading) {
        return <LoadingScreen message="Loading meeting data…" />
    }

    return (
        <div className="container mx-auto py-6">
            <div className="mb-6">
                <h1 className="text-3xl font-bold">Property Management</h1>
                <p className="text-muted-foreground">
                    Manage properties, shareholders, and property transfers
                    {selectedMeeting ? (
                        <>
                            {" "}
                            — {selectedMeeting.year} Annual Meeting
                            <span className="font-mono text-xs"> (ID {selectedMeeting.id})</span>
                        </>
                    ) : (
                        " — no meeting selected"
                    )}
                </p>
            </div>
            {!selectedMeeting ? (
                <p className="text-sm text-amber-700">
                    Select an active annual meeting in Settings to load benefit units for that meeting.
                </p>
            ) : null}
            <PropertyManagement />
        </div>
    )
}
