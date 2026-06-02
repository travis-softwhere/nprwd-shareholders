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
} from "@/components/ui/alert-dialog"

export default function ManualCheckInButton({
    shareholderId,
    meetingId,
    isFullyCheckedIn,
    shareholderName,
    designeeName,
    mailingAddress,
    cityStateZip,
    totalProperties = 0,
    checkedInProperties = 0,
}: {
    shareholderId: string
    meetingId: string
    isFullyCheckedIn: boolean
    shareholderName?: string
    designeeName?: string | null
    mailingAddress?: string | null
    cityStateZip?: string | null
    totalProperties?: number
    checkedInProperties?: number
}) {
    const [isPending, startTransition] = useTransition()
    const [showAlreadyCheckedInDialog, setShowAlreadyCheckedInDialog] = useState(false)
    const [showSignaturePad, setShowSignaturePad] = useState(false)
    const [signaturePadKey, setSignaturePadKey] = useState(0)
    const router = useRouter()

    const remainingCount = Math.max(0, totalProperties - checkedInProperties)
    const hasCheckedIn = checkedInProperties > 0
    const canCheckInMore = remainingCount > 0

    const handleCheckIn = () => {
        setSignaturePadKey((k) => k + 1)
        setShowSignaturePad(true)
    }

    const handleSignatureComplete = async (signatureImage: string, signatureHash: string) => {
        try {
            const response = await fetch("/api/properties/manual-checkin", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    shareholderId,
                    meetingId,
                    action: "checkin",
                    signatureImage,
                    signatureHash
                })
            });

            const data = await response.json();

            if (!response.ok && data.alreadyCheckedIn) {
                setShowSignaturePad(false);
                setShowAlreadyCheckedInDialog(true);
                return;
            }
            if (!response.ok) {
                throw new Error(data.error || "Failed to check in");
            }

            setShowSignaturePad(false);
            toast({ title: "Success", description: data.message });
            router.refresh();
        } catch (error) {
            const message = error instanceof Error ? error.message : "Failed to check in";
            toast({
                title: "Error",
                description: message,
                variant: "destructive"
            });
            throw error instanceof Error ? error : new Error(message);
        }
    }

    const handleProceedAnyway = () => {
        setShowAlreadyCheckedInDialog(false);
    }

    const handleUndoAllCheckIn = () => {
        startTransition(async () => {
            try {
                const response = await fetch("/api/properties/manual-checkin", {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                    },
                    body: JSON.stringify({
                        shareholderId,
                        meetingId,
                        action: "undo",
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
            <div className="mt-2 ml-4 flex flex-wrap items-center gap-2">
                {canCheckInMore ? (
                    <Button
                        onClick={handleCheckIn}
                        disabled={isPending}
                        size="sm"
                        variant="default"
                    >
                        {isPending
                            ? "Working…"
                            : remainingCount < totalProperties
                              ? `Check In All Remaining (${remainingCount})`
                              : "Check In All"}
                    </Button>
                ) : null}

                {hasCheckedIn ? (
                    <Button
                        onClick={handleUndoAllCheckIn}
                        disabled={isPending}
                        size="sm"
                        variant="outline"
                    >
                        {isPending
                            ? "Undoing…"
                            : isFullyCheckedIn
                              ? "Undo Check In All"
                              : `Undo Check In All (${checkedInProperties})`}
                    </Button>
                ) : null}
            </div>

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

            {showSignaturePad && (
                <SignaturePad
                    key={signaturePadKey}
                    onSignatureComplete={handleSignatureComplete}
                    onCancel={() => setShowSignaturePad(false)}
                    shareholderId={shareholderId}
                    shareholderName={shareholderName}
                    designeeName={designeeName}
                    mailingAddress={mailingAddress}
                    cityStateZip={cityStateZip}
                    totalProperties={totalProperties}
                    checkedInProperties={checkedInProperties}
                />
            )}
        </>
    )
}
