"use client"

import { useState, useEffect, useCallback } from "react"
import { Upload, Check, Trash2 } from "lucide-react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { useMeeting } from "@/contexts/MeetingContext"
import { cn } from "@/lib/utils"
import { UploadProgress } from "@/components/UploadProgress"
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
    const [selectedMeetingId, setSelectedMeetingId] = useState<string | null>(null)
    const [uploadProgress, setUploadProgress] = useState(0)
    const [isUploading, setIsUploading] = useState(false)
    const [uploadError, setUploadError] = useState<string | null>(null)
    const [currentStep, setCurrentStep] = useState<string>("")

    useEffect(() => {
        console.log("AdminPage rendered", {
            meetings: meetings.length,
            selectedMeetingId,
            isUploading,
            uploadProgress,
            currentStep,
            uploadError,
        })
    }, [meetings, selectedMeetingId, isUploading, uploadProgress, currentStep, uploadError])

    const refreshMeetings = useCallback(async () => {
        try {
            console.log("Fetching meetings...")
            const allMeetings = await getMeetings()
            console.log("Meetings fetched:", allMeetings)
            setMeetings(allMeetings)
        } catch (error) {
            console.error("Error fetching meetings:", error)
        }
    }, [setMeetings])

    useEffect(() => {
        refreshMeetings()
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

    const handleUpload = useCallback(
        async (formData: FormData) => {
            console.log("handleUpload called", { meetingId: formData.get("meetingId") })
            console.log("Starting file upload process")
            setIsUploading(true)
            setUploadProgress(0)
            setUploadError(null)
            setCurrentStep("Preparing file for upload...")

            try {
                console.log("Sending upload request to server")
                const response = await fetch("/api/upload", {
                    method: "POST",
                    body: formData,
                })

                if (!response.ok) {
                    throw new Error(`Upload failed with status ${response.status}`)
                }

                if (!response.body) {
                    throw new Error("No response body received")
                }

                const reader = response.body.getReader()
                const decoder = new TextDecoder()
                let buffer = ""

                while (true) {
                    const { done, value } = await reader.read()

                    if (done) {
                        console.log("Upload stream completed")
                        break
                    }

                    buffer += decoder.decode(value, { stream: true })
                    const lines = buffer.split("\n\n")
                    buffer = lines.pop() || ""

                    for (const line of lines) {
                        if (line.startsWith("data: ")) {
                            try {
                                const data = JSON.parse(line.slice(6))
                                console.log("Received progress update:", data)

                                if (data.type === "progress") {
                                    setUploadProgress(data.progress)
                                    setCurrentStep(data.step)
                                } else if (data.type === "complete") {
                                    console.log("File processed successfully:", data)
                                    setCurrentStep("Upload completed successfully!")
                                    setUploadProgress(100)
                                    setIsDataLoaded(true)
                                    await refreshMeetings()
                                    await new Promise((resolve) => setTimeout(resolve, 2000))
                                    setIsUploading(false)
                                    setCurrentStep("")
                                    setUploadProgress(0)
                                } else if (data.type === "error") {
                                    console.error("Error during upload:", data.error)
                                    throw new Error(data.error)
                                }
                            } catch (e) {
                                console.error("Error parsing progress update:", e)
                                throw new Error("Failed to parse server response")
                            }
                        }
                    }
                }
            } catch (error) {
                console.error("Upload failed:", error)
                setUploadError(error instanceof Error ? error.message : String(error))
                setCurrentStep("Upload failed")
                setIsUploading(false)
            }
        },
        [setIsDataLoaded, refreshMeetings],
    )

    const handleDelete = async (meetingId: string) => {
        console.log("handleDelete called", { meetingId })
        console.log("Deleting meeting:", meetingId)
        const formData = new FormData()
        formData.append("id", meetingId)

        const result = await deleteMeeting(formData)
        if (result.success) {
            console.log("Meeting deleted successfully")
            setSelectedMeetingId(null)
            const updatedMeetings = meetings.filter((m) => m.id !== meetingId)
            setMeetings(updatedMeetings)
        } else {
            console.error("Failed to delete meeting:", result.error)
            alert(result.error)
        }
    }

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
                        <div className="space-y-4">
                            <div className="flex items-center justify-center w-full">
                                <label
                                    htmlFor="file-upload"
                                    className={cn(
                                        "flex flex-col items-center justify-center w-full h-32 border-2 border-dashed rounded-lg transition-colors",
                                        selectedMeeting && !isUploading
                                            ? "cursor-pointer border-gray-300 bg-gray-50 hover:bg-gray-100 hover:border-gray-400"
                                            : "cursor-not-allowed border-gray-200 bg-gray-100",
                                    )}
                                >
                                    <div className="flex flex-col items-center justify-center pt-5 pb-6">
                                        <Upload className={cn("w-8 h-8 mb-2", isUploading ? "text-gray-400" : "text-gray-500")} />
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
                                        disabled={!selectedMeeting || isUploading}
                                        onChange={(e) => {
                                            const file = e.target.files?.[0]
                                            if (file && selectedMeeting) {
                                                console.log("File selected:", file.name, "Size:", file.size, "bytes")
                                                const formData = new FormData()
                                                formData.append("file", file)
                                                formData.append("meetingId", selectedMeeting.id)
                                                handleUpload(formData)
                                            }
                                        }}
                                    />
                                </label>
                            </div>

                            <UploadProgress
                                isUploading={isUploading}
                                progress={uploadProgress}
                                currentStep={currentStep}
                                error={uploadError}
                            />
                        </div>
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
                                console.log("New meeting created:", meeting)
                                setMeetings((prev) => [...prev, meeting])
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
                                            if (!isUploading) {
                                                console.log("Selected meeting:", meeting)
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