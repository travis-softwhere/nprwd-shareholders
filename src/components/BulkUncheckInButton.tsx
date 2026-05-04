import { useState } from "react"
import { Button } from "@/components/ui/button"
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
import { toast } from "sonner"

type Props = {
    meetingId: string
    /** Shown in the confirmation text, e.g. "2025 Annual (ID 3)" */
    meetingLabel: string
    disabled?: boolean
}

export function BulkUncheckInButton({ meetingId, meetingLabel, disabled = false }: Props) {
    const [isLoading, setIsLoading] = useState(false)

    const handleBulkUncheckIn = async () => {
        setIsLoading(true)
        try {
            const response = await fetch("/api/properties/bulk-uncheckin", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ meetingId }),
            })

            const data = await response.json()

            if (!response.ok) {
                throw new Error(data.error || "Failed to uncheck-in properties for this meeting")
            }

            toast.success(
                `Unchecked ${data.updatedCount ?? 0} propert${(data.updatedCount ?? 0) === 1 ? "y" : "ies"}; cleared check-in for ${data.shareholdersCleared ?? 0} benefit unit owner${(data.shareholdersCleared ?? 0) === 1 ? "" : "s"}.`,
            )
        } catch (error) {
            toast.error(error instanceof Error ? error.message : "Failed to uncheck-in")
        } finally {
            setIsLoading(false)
        }
    }

    return (
        <AlertDialog>
            <AlertDialogTrigger asChild>
                <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="shrink-0 border-destructive/50 text-destructive hover:bg-destructive/10"
                    disabled={isLoading || disabled}
                >
                    {isLoading ? "…" : "Uncheck-in all"}
                </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
                <AlertDialogHeader>
                    <AlertDialogTitle>Uncheck-in all for this meeting?</AlertDialogTitle>
                    <AlertDialogDescription className="space-y-2">
                        <span className="block">
                            For <span className="font-medium text-foreground">{meetingLabel}</span>, this sets every
                            benefit unit to not checked in and clears owner signatures and check-in timestamps for
                            benefit unit owners tied to this meeting. Other meetings are not affected.
                        </span>
                    </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction
                        className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                        onClick={handleBulkUncheckIn}
                    >
                        Uncheck-in all
                    </AlertDialogAction>
                </AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>
    )
}
