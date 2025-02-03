"use client"

import { useState, useEffect } from "react"
import { Upload, FileUp, Check, Trash2 } from "lucide-react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { useMeeting } from "@/contexts/MeetingContext"
import { useProgress } from "@/contexts/ProgressContext"
import { cn } from "@/lib/utils"
import { ProgressBar } from "@/components/ProgressBar"
import { getMeetings } from "@/app/actions/getMeetings"
import { deleteMeeting } from "@/app/actions/manageMeetings"
import { CreateMeetingForm } from "@/components/CreateMeetingForm"
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
    AlertDialogTrigger,
} from "@/components/ui/alert-dialog"

export default function AdminPage() {
    const { selectedMeeting, setSelectedMeeting, setIsDataLoaded, meetings, setMeetings } = useMeeting()
    const {
        progress,
        setProgress,
        processedRecords,
        setProcessedRecords,
        totalRecords,
        setTotalRecords,
        isProcessing,
        setIsProcessing,
    } = useProgress()

    const [selectedMeetingId, setSelectedMeetingId] = useState<string | null>(null)
    const [refreshMeetings, setRefreshMeetings] = useState(false)

    useEffect(() => {
        const fetchMeetings = async () => {
            try {
                const allMeetings = await getMeetings()
                setMeetings(allMeetings)
            } catch (error) {
                console.error("Error fetching meetings:", error)
            }
        }
        fetchMeetings()
    }, [refreshMeetings])

    useEffect(() => {
        if (selectedMeetingId) {
            const meeting = meetings.find((m) => m.id === selectedMeetingId)
            if (meeting) {
                setSelectedMeeting(meeting)
            }
        } else {
            setSelectedMeeting(null)
        }
    }, [selectedMeetingId, meetings, setSelectedMeeting])

    const handleUpload = async (formData: FormData) => {
        setIsProcessing(true)
        setProgress(0)
        setProcessedRecords(0)
        setTotalRecords(0)

        try {
            const response = await fetch("/api/upload", {
                method: "POST",
                body: formData,
            })

            if (!response.ok) {
                throw new Error("Upload failed")
            }

            const result = await response.json()

            if (result.success) {
                setIsDataLoaded(true)
                setTotalRecords(result.totalRecords)
                setProcessedRecords(result.totalRecords)
                setProgress(100)
                setRefreshMeetings(!refreshMeetings)
                alert("File uploaded successfully!")
            } else {
                throw new Error(result.error || "Unknown error occurred")
            }
        } catch (error) {
            console.error("Error uploading file:", error)
            alert("Failed to upload file: " + (error instanceof Error ? error.message : String(error)))
        } finally {
            setIsProcessing(false)
        }
    }

    const handlePDFGeneration = async () => {
        try {
            const mailerResponse = await fetch("/api/print-mailers", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({ meetingId: selectedMeeting?.id }),
            })

            if (!mailerResponse.ok) {
                throw new Error(`Failed to generate mailers: ${mailerResponse.statusText}`)
            }

            const blob = await mailerResponse.blob()
            const url = window.URL.createObjectURL(blob)
            const a = document.createElement("a")
            a.href = url
            a.download = `shareholder-mailers-${selectedMeeting?.year}.pdf`
            document.body.appendChild(a)
            a.click()
            window.URL.revokeObjectURL(url)

            setIsDataLoaded(true)
            setIsProcessing(false)
            setRefreshMeetings(!refreshMeetings) //Added to refresh meetings after PDF generation
        } catch (error) {
            console.error("Error generating PDF:", error)
            alert("Failed to generate PDF")
            setIsProcessing(false)
        }
    }

    const handleDelete = async (meetingId: string) => {
        const formData = new FormData()
        formData.append("id", meetingId)

        const result = await deleteMeeting(formData)
        if (result.success) {
            setSelectedMeetingId(null)
            const updatedMeetings = meetings.filter((m) => m.id !== meetingId)
            setMeetings(updatedMeetings)
            setRefreshMeetings(!refreshMeetings) //Added to refresh meetings after deletion
        } else {
            alert(result.error)
        }
    }

    useEffect(() => {
        const eventSource = new EventSource("/api/progress")

        eventSource.onmessage = (event) => {
            const data = JSON.parse(event.data)
            setProgress(data.progress)
            setProcessedRecords(data.processedCount)
            setTotalRecords(data.totalRecords)
        }

        return () => {
            eventSource.close()
        }
    }, [])

    return (
        <div className="container mx-auto p-6">
            <h1 className="text-2xl font-bold mb-6">Admin Dashboard</h1>

            <div className="grid gap-6 md:grid-cols-2">
                <Card>
                    <CardHeader>
                        <CardTitle>Data Management</CardTitle>
                        <CardDescription>Upload shareholder data for the selected meeting</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <form
                            onSubmit={(e) => {
                                e.preventDefault()
                                handleUpload(new FormData(e.target as HTMLFormElement))
                            }}
                        >
                            <div className="flex flex-col items-center gap-4">
                                <div className="flex items-center justify-center w-full">
                                    <label
                                        htmlFor="file-upload"
                                        className={cn(
                                            "flex flex-col items-center justify-center w-full h-32 border-2 border-dashed rounded-lg",
                                            selectedMeeting && !isProcessing
                                                ? "cursor-pointer bg-gray-50 hover:bg-gray-100"
                                                : "cursor-not-allowed bg-gray-100",
                                        )}
                                    >
                                        <div className="flex flex-col items-center justify-center pt-5 pb-6">
                                            <Upload className="w-8 h-8 mb-2 text-gray-500" />
                                            <p className="mb-2 text-sm text-gray-500">
                                                <span className="font-semibold">Click to upload</span> or drag and drop
                                            </p>
                                            <p className="text-xs text-gray-500">Excel or CSV file</p>
                                        </div>
                                        <input
                                            id="file-upload"
                                            name="file"
                                            type="file"
                                            className="hidden"
                                            accept=".xlsx,.xls,.csv"
                                            required
                                            disabled={!selectedMeeting || isProcessing}
                                        />
                                    </label>
                                </div>

                                {isProcessing && (
                                    <div className="w-full">
                                        <ProgressBar progress={progress} processedRecords={processedRecords} totalRecords={totalRecords} />
                                    </div>
                                )}

                                <input type="hidden" name="meetingId" value={selectedMeeting?.id ?? ""} />

                                <Button type="submit" className="w-full" disabled={!selectedMeeting || isProcessing}>
                                    {isProcessing ? (
                                        <>Processing...</>
                                    ) : (
                                        <>
                                            <FileUp className="w-4 h-4 mr-2" />
                                            Upload File
                                        </>
                                    )}
                                </Button>
                            </div>
                        </form>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader>
                        <CardTitle>Shareholder Meetings</CardTitle>
                        <CardDescription>Select a meeting to manage</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <CreateMeetingForm
                            onSuccess={(meeting) => {
                                setMeetings((prev) => [...prev, meeting])
                                setRefreshMeetings(!refreshMeetings)
                            }}
                        />

                        <div className="space-y-4">
                            {meetings.map((meeting) => (
                                <div
                                    key={meeting.id}
                                    className={cn(
                                        "flex w-full items-center justify-between p-4 rounded-lg border transition-colors",
                                        selectedMeetingId === meeting.id ? "border-blue-500 bg-blue-50" : "hover:border-gray-300",
                                    )}
                                >
                                    <button
                                        type="button"
                                        className="flex-1 text-left"
                                        onClick={() => {
                                            if (!isProcessing) {
                                                setSelectedMeetingId(meeting.id)
                                            }
                                        }}
                                    >
                                        <div>
                                            <h3 className="font-semibold">{meeting.year} Annual Meeting</h3>
                                            <p className="text-sm text-gray-500">{new Date(meeting.date).toLocaleDateString()}</p>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <div className="text-right">
                                                <p className="text-sm text-gray-500">
                                                    {meeting.checkedIn} / {meeting.totalShareholders} Checked In
                                                </p>
                                            </div>
                                            {selectedMeetingId === meeting.id && <Check className="h-5 w-5 text-blue-500" />}
                                        </div>
                                    </button>

                                    <AlertDialog>
                                        <AlertDialogTrigger asChild>
                                            <Button
                                                type="button"
                                                variant="ghost"
                                                size="icon"
                                                className="ml-2 text-red-500 hover:text-red-600 hover:bg-red-50"
                                            >
                                                <Trash2 className="h-4 w-4" />
                                            </Button>
                                        </AlertDialogTrigger>
                                        <AlertDialogContent>
                                            <AlertDialogHeader>
                                                <AlertDialogTitle>Delete Meeting</AlertDialogTitle>
                                                <AlertDialogDescription>
                                                    Are you sure you want to delete this meeting? This action cannot be undone. All associated
                                                    shareholder data will be permanently deleted.
                                                </AlertDialogDescription>
                                            </AlertDialogHeader>
                                            <AlertDialogFooter>
                                                <AlertDialogCancel>Cancel</AlertDialogCancel>
                                                <AlertDialogAction
                                                    className="bg-red-500 hover:bg-red-600"
                                                    onClick={() => handleDelete(meeting.id)}
                                                >
                                                    Delete
                                                </AlertDialogAction>
                                            </AlertDialogFooter>
                                        </AlertDialogContent>
                                    </AlertDialog>
                                </div>
                            ))}
                        </div>
                    </CardContent>
                </Card>
            </div>
        </div>
    )
}