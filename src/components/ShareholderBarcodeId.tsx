"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { scopeShareholderIdToMeeting } from "@/actions/scopeShareholderIdToMeeting"
import {
    displayShareholderId,
    needsShareholderIdMeetingScope,
} from "@/lib/meetingScopedShareholderId"
import { useToast } from "@/components/ui/use-toast"
import { Loader2 } from "lucide-react"

type Props = {
    storedShareholderId: string
    meetingId: string
    label?: string
    showFixAction?: boolean
}

export function ShareholderBarcodeId({
    storedShareholderId,
    meetingId,
    label = "Benefit Unit Owner Barcode ID",
    showFixAction = true,
}: Props) {
    const router = useRouter()
    const { toast } = useToast()
    const [pending, startTransition] = useTransition()
    const displayId = displayShareholderId(storedShareholderId, meetingId)
    const needsFix = needsShareholderIdMeetingScope(storedShareholderId, meetingId)

    const handleFix = () => {
        startTransition(async () => {
            const result = await scopeShareholderIdToMeeting(storedShareholderId)
            if (!result.success) {
                toast({
                    title: "Could not update ID",
                    description: result.message,
                    variant: "destructive",
                })
                return
            }
            if (result.unchanged) {
                toast({
                    title: "Already correct",
                    description: `This owner is already stored as ${result.shareholderId}.`,
                })
                return
            }
            toast({
                title: "Barcode ID updated",
                description: `Updated to ${result.shareholderId} for meeting ${meetingId}.`,
            })
            router.replace(`/shareholders/${encodeURIComponent(result.shareholderId)}`)
            router.refresh()
        })
    }

    return (
        <div className="text-sm text-muted-foreground">
            <span className="font-medium text-foreground">{label}:</span>{" "}
            <span className="font-mono">{displayId}</span>
            {needsFix && storedShareholderId !== displayId ? (
                <span className="block text-xs mt-1">
                    Stored as <span className="font-mono">{storedShareholderId}</span> — barcodes and check-in
                    expect <span className="font-mono">{displayId}</span>.
                </span>
            ) : null}
            {showFixAction && needsFix ? (
                <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="mt-2"
                    disabled={pending}
                    onClick={handleFix}
                >
                    {pending ? (
                        <>
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            Updating…
                        </>
                    ) : (
                        `Fix ID to ${displayId}`
                    )}
                </Button>
            ) : null}
        </div>
    )
}
