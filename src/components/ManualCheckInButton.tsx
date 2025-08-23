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
    const [reason, setReason] = useState("")
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

    const handleSubmitUndoRequest = () => {
        setShowUndoConfirmationDialog(false);
        startTransition(async () => {
            try {
                const response = await fetch("/api/undo-requests", {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                    },
                    body: JSON.stringify({
                        shareholderId,
                        shareholderName: shareholderName || "Unknown",
                        reason: reason || null
                    })
                });

                const data = await response.json();

                if (!response.ok) {
                    throw new Error(data.error || "Failed to submit undo request");
                }

                toast({ 
                    title: "Success", 
                    description: "Undo request submitted successfully. An admin will review your request." 
                });
                setReason("");
                router.refresh();
            } catch (error) {
                toast({ 
                    title: "Error", 
                    description: error instanceof Error ? error.message : "Failed to submit undo request", 
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
                    {isPending ? "Submitting..." : "Undo Check In"}
                </Button>
            )}

            {/* Undo Check-in Request Dialog */}
            <AlertDialog open={showUndoConfirmationDialog} onOpenChange={setShowUndoConfirmationDialog}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Request Undo Check-in</AlertDialogTitle>
                        <AlertDialogDescription>
                            You are requesting to undo a check-in after a signature has been captured. 
                            This request will be sent to an administrator for approval.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <div className="py-4">
                        <label htmlFor="reason" className="block text-sm font-medium text-gray-700 mb-2">
                            Reason for undo request (optional):
                        </label>
                        <textarea
                            id="reason"
                            value={reason}
                            onChange={(e) => setReason(e.target.value)}
                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                            placeholder="Please provide a reason for the undo request..."
                            rows={3}
                        />
                    </div>
                    <AlertDialogFooter>
                        <AlertDialogCancel onClick={() => setReason("")}>Cancel</AlertDialogCancel>
                        <AlertDialogAction onClick={handleSubmitUndoRequest}>
                            Send to Admin
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