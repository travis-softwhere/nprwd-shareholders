"use client"

import type React from "react"
import { useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { updateMeeting } from "@/actions/manageMeetings"
import type { Meeting } from "@/types/meeting"
import { Loader2 } from "lucide-react"

function toDatetimeLocalValue(iso: string) {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return new Date().toISOString().slice(0, 16)
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, "0")
  const day = String(d.getDate()).padStart(2, "0")
  const h = String(d.getHours()).padStart(2, "0")
  const min = String(d.getMinutes()).padStart(2, "0")
  return `${y}-${m}-${day}T${h}:${min}`
}

interface EditMeetingDialogProps {
  meeting: Meeting | null
  onClose: () => void
  onSaved: (meeting: Meeting) => void | Promise<void>
}

export function EditMeetingDialog({ meeting, onClose, onSaved }: EditMeetingDialogProps) {
  const [year, setYear] = useState("")
  const [date, setDate] = useState("")
  const [dataSource, setDataSource] = useState<"excel" | "database">("excel")
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!meeting) return
    setYear(String(meeting.year))
    setDate(toDatetimeLocalValue(meeting.date))
    setDataSource(meeting.dataSource)
    setError(null)
  }, [meeting])

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (!meeting) return
    setSaving(true)
    setError(null)
    try {
      const form = new FormData()
      form.append("id", meeting.id)
      form.append("year", year)
      form.append("date", date)
      form.append("dataSource", dataSource)
      const result = await updateMeeting(form)
      if (result.success && result.meeting) {
        await onSaved(result.meeting)
        onClose()
      } else {
        setError(typeof result.error === "string" ? result.error : "Failed to update meeting")
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update meeting")
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog
      open={meeting !== null}
      onOpenChange={(nextOpen) => {
        if (!nextOpen) onClose()
      }}
    >
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Edit meeting</DialogTitle>
          <DialogDescription>
            The list title is built from the year (e.g. &quot;{year || "2026"} Annual Meeting&quot;). Database ID:{" "}
            <span className="font-mono text-foreground">{meeting?.id ?? "—"}</span>.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <p className="text-sm text-destructive" role="alert">
              {error}
            </p>
          )}
          <div className="space-y-2">
            <Label htmlFor="edit-meeting-year">Year (meeting name)</Label>
            <Input
              id="edit-meeting-year"
              name="year"
              type="number"
              min={2000}
              max={2100}
              required
              value={year}
              onChange={(e) => setYear(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">Shown as “{year || "—"} Annual Meeting” in the app.</p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="edit-meeting-date">Date and time</Label>
            <Input
              id="edit-meeting-date"
              name="date"
              type="datetime-local"
              required
              value={date}
              onChange={(e) => setDate(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="edit-meeting-data-source">Data source</Label>
            <Select
              value={dataSource}
              onValueChange={(value: "excel" | "database") => setDataSource(value)}
            >
              <SelectTrigger id="edit-meeting-data-source">
                <SelectValue placeholder="Select data source" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="excel">Excel / CSV</SelectItem>
                <SelectItem value="database">Database</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button type="button" variant="outline" onClick={onClose} disabled={saving}>
              Cancel
            </Button>
            <Button type="submit" disabled={saving || !meeting}>
              {saving ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden />
                  Saving…
                </>
              ) : (
                "Save changes"
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
