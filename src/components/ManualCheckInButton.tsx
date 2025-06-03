'use client'

import { useState, useTransition } from "react"
import { Button } from "@/components/ui/button"
import { toast } from "@/components/ui/use-toast"
import { useRouter } from "next/navigation"
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

export default function ManualCheckInButton({shareholderId, isFullyCheckedIn}: {shareholderId: string, isFullyCheckedIn: boolean}) {
    const [isPending, startTransition] = useTransition()
    const [showAlreadyCheckedInDialog, setShowAlreadyCheckedInDialog] = useState(false)
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

                if (!response.ok && data.alreadyCheckedIn) {
                    setShowAlreadyCheckedInDialog(true);
                    return;
                }
                if (!response.ok) throw new Error(data.error || "Failed to check in");

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

    const handleProceedAnyway = () => {
        setShowAlreadyCheckedInDialog(false);
        // Actually force the check-in here, e.g. by calling the API with a "force" flag if you want
        // Or just call checkInShareholders directly if you want to override
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

    return (
        <>
            {!isFullyCheckedIn ? (
                <>
                    <Button
                        onClick={handleCheckIn}
                        disabled={isPending}
                        size="sm"
                        variant="default"
                        className="mt-2 ml-4"
                    >
                        {isPending ? "Checking in..." : "Check In"}
                    </Button>
                    <AlertDialog open={showAlreadyCheckedInDialog} onOpenChange={setShowAlreadyCheckedInDialog}>
                        <AlertDialogContent>
                            <AlertDialogHeader>
                                <AlertDialogTitle>Already Checked In</AlertDialogTitle>
                                <AlertDialogDescription>
                                    This Benefit Unit Owner is already checked in and has a ballot! Please verify before proceeding.
                                </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                                <AlertDialogCancel>Cancel</AlertDialogCancel>
                                <AlertDialogAction onClick={handleProceedAnyway}>
                                    Proceed Anyway
                                </AlertDialogAction>
                            </AlertDialogFooter>
                        </AlertDialogContent>
                    </AlertDialog>
                </>
            ) : (
                <Button
                    onClick={handleUndoCheckIn}
                    disabled={isPending}
                    size="sm"
                    variant="default"
                    className="mt-2 ml-4"
                >
                    {isPending ? "Undoing..." : "Undo Check In"}
                </Button>
            )}
        </>
    )
}