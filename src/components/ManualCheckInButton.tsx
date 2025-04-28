'use client'

import { useTransition } from "react"
import { Button } from "@/components/ui/button"
import { checkInShareholders } from "@/actions/checkInShareholders"
import { undoCheckInShareholders } from "@/actions/undoCheckInShareholders"
import { toast } from "@/components/ui/use-toast"

export default function ManualCheckInButton({shareholderId, isFullyCheckedIn}: {shareholderId: string, isFullyCheckedIn: boolean}) {
    const [isPending, startTransition] = useTransition()

    const handleCheckIn = () => {
        startTransition(async () => {
            const result = await checkInShareholders(shareholderId)
            if (result.success) {
                toast({ title: "Success", description: result.message })
            } else {
                toast({ title: "Error", description: result.message, variant: "destructive" })
            }
        })
    }

    const handleUndoCheckIn = () => {
        startTransition(async () => {
            const result = await undoCheckInShareholders(shareholderId)
            if (result.success) {
                toast({ title: "Success", description: result.message })
            } else {
                toast({ title: "Error", description: result.message, variant: "destructive" })
            }
        })
    }

    return isFullyCheckedIn ? (
        <Button
            onClick={handleUndoCheckIn}
            disabled={isPending}
            size="sm"
            variant="default"
            className="mt-2 ml-4"
        >
            {isPending ? "Undoing..." : "Undo Check In"}
        </Button>
    ) : (
        <Button
            onClick={handleCheckIn}
            disabled={isPending}
            size="sm"
            variant="default"
            className="mt-2 ml-4"
        >
            {isPending ? "Checking in..." : "Check In"}
        </Button>
    )
}