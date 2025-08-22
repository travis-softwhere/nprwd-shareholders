'use client'

import { useState, useTransition } from "react"
import { Button } from "@/components/ui/button"
import { toast } from "@/components/ui/use-toast"
import { useRouter } from "next/navigation"
import SignaturePad from "./SignaturePad"
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

export default function ManualCheckInButton({shareholderId, isFullyCheckedIn, shareholderName}: {shareholderId: string, isFullyCheckedIn: boolean, shareholderName?: string}) {
    const [isPending, startTransition] = useTransition()
    const [showAlreadyCheckedInDialog, setShowAlreadyCheckedInDialog] = useState(false)
    const [showSignaturePad, setShowSignaturePad] = useState(false)
    const [showUndoConfirmationDialog, setShowUndoConfirmationDialog] = useState(false)
    const router = useRouter()

    const handleCheckIn = () => {
        setShowSignaturePad(true);
    }

    const handleSignatureComplete = (signatureImage: string, signatureHash: string) => {
        setShowSignaturePad(false);
        startTransition(async () => {
            try {
                const response = await fetch("/api/properties/manual-checkin", {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                    },
                    body: JSON.stringify({
                        shareholderId,
                        action: "checkin",
                        signatureImage,
                        signatureHash
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
        setShowUndoConfirmationDialog(true);
    }

    const handleConfirmUndoCheckIn = () => {
        setShowUndoConfirmationDialog(false);
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

            {/* Undo Check-in Confirmation Dialog */}
            <AlertDialog open={showUndoConfirmationDialog} onOpenChange={setShowUndoConfirmationDialog}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Confirm Undo Check-in</AlertDialogTitle>
                        <AlertDialogDescription>
                            You are trying to undo a check-in after a signature has been captured. Are you sure you want to undo the check-in? This will erase the signature and uncheck in the owner.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction onClick={handleConfirmUndoCheckIn}>
                            Undo Check In
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
            
            {showSignaturePad && (
                <SignaturePad
                    onSignatureComplete={handleSignatureComplete}
                    onCancel={() => setShowSignaturePad(false)}
                    shareholderName={shareholderName}
                />
            )}
        </>
    )
}