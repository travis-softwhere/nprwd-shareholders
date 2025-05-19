'use client'

import { useTransition } from "react"
import { Button } from "@/components/ui/button"
import { toast } from "@/components/ui/use-toast"
import { useRouter } from "next/navigation"

export default function ManualCheckInButton({shareholderId, isFullyCheckedIn}: {shareholderId: string, isFullyCheckedIn: boolean}) {
    const [isPending, startTransition] = useTransition()
    const router = useRouter()

    const handleCheckIn = () => {
        startTransition(async () => {
            try {
                const response = await fetch("/api/properties/manual-checkin", {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                    },
                    body: JSON.stringify({
                        shareholderId,
                        action: "checkin"
                    })
                });

                const data = await response.json();

                if (!response.ok) {
                    throw new Error(data.error || "Failed to check in");
                }

                toast({ title: "Success", description: data.message });
                router.refresh();
            } catch (error) {
                toast({ 
                    title: "Error", 
                    description: error instanceof Error ? error.message : "Failed to check in", 
                    variant: "destructive" 
                });
            }
        })
    }

    const handleUndoCheckIn = () => {
        startTransition(async () => {
            try {
                const response = await fetch("/api/properties/manual-checkin", {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                    },
                    body: JSON.stringify({
                        shareholderId,
                        action: "undo"
                    })
                });

                const data = await response.json();

                if (!response.ok) {
                    throw new Error(data.error || "Failed to undo check in");
                }

                toast({ title: "Success", description: data.message });
                router.refresh();
            } catch (error) {
                toast({ 
                    title: "Error", 
                    description: error instanceof Error ? error.message : "Failed to undo check in", 
                    variant: "destructive" 
                });
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