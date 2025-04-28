"use client"

import type React from "react"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog"
import { createMeeting } from "@/actions/manageMeetings"
import { useMeeting, type Meeting } from "@/contexts/MeetingContext"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"

interface CreateMeetingFormProps {
    onSuccess?: (meeting: Meeting) => void
}

export function CreateMeetingForm({ onSuccess }: CreateMeetingFormProps) {
    const [open, setOpen] = useState(false)
    const [year, setYear] = useState(new Date().getFullYear().toString())
    const [date, setDate] = useState(new Date().toISOString().slice(0, 16))
    const [dataSource, setDataSource] = useState<"excel" | "database">("excel")
    const { refreshMeetings } = useMeeting()

    const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault()
        const formData = new FormData(e.currentTarget)
        formData.append("dataSource", dataSource)
        const result = await createMeeting(formData)
        if (result.success && result.meeting) {
            setOpen(false)
            refreshMeetings()
            location.reload()
            if (onSuccess) {
                onSuccess(result.meeting)
            }
            // Reset form
            setYear(new Date().getFullYear().toString())
            setDate(new Date().toISOString().slice(0, 16))
            setDataSource("excel")
        } else {
            alert(result.error)
        }
    }

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                <Button className="w-full">Create New Meeting</Button>
            </DialogTrigger>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Create Meeting</DialogTitle>
                    <DialogDescription>Fill in the details to create a new meeting.</DialogDescription>
                </DialogHeader>
                <form onSubmit={handleSubmit} className="space-y-4">
                    <div className="space-y-2">
                        <label htmlFor="year" className="text-sm font-medium">
                            Year
                        </label>
                        <Input
                            id="year"
                            name="year"
                            type="number"
                            min={2000}
                            max={2100}
                            required
                            value={year}
                            onChange={(e) => setYear(e.target.value)}
                        />
                    </div>
                    <div className="space-y-2">
                        <label htmlFor="date" className="text-sm font-medium">
                            Date
                        </label>
                        <Input
                            id="date"
                            name="date"
                            type="datetime-local"
                            required
                            value={date}
                            onChange={(e) => setDate(e.target.value)}
                        />
                    </div>
                    <div className="space-y-2">
                        <label htmlFor="dataSource" className="text-sm font-medium">
                            Data Source
                        </label>
                        <Select value={dataSource} onValueChange={(value: "excel" | "database") => setDataSource(value)}>
                            <SelectTrigger>
                                <SelectValue placeholder="Select data source" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="excel">Excel</SelectItem>
                                <SelectItem value="database">Database</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                    <div className="flex justify-end gap-2">
                        <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                            Cancel
                        </Button>
                        <Button type="submit">Create Meeting</Button>
                    </div>
                </form>
            </DialogContent>
        </Dialog>
    )
}