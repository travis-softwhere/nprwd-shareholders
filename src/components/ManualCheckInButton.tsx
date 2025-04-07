'use client'

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { checkInShareholders } from "@/actions/checkInShareholders"
import { useTransition, useEffect } from "react"
import { toast } from "@/components/ui/use-toast"

export default function ManualCheckInButton({shareholderId, isFullyCheckedIn}: {shareholderId: string, isFullyCheckedIn: boolean}) {
    const [isPending, startTransition] = useTransition()
    
    const handleCheckIn = () => {
        startTransition(async () => {
            const result = await checkInShareholders(shareholderId)

            if (result.success) {
                toast({
                    title: "Success",
                    description: result.message,
                    variant: "default",
                })
            } else {
                toast({
                    title: "Error",
                    description: result.message,
                    variant: "destructive",
                })
            }
        })
    }

    // don't show button if already checked in
    if (isFullyCheckedIn) {
        return null;
    }

    return (
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