"use client"

import { useTransition } from "react"
import { Button } from "@/components/ui/button"
import { toast } from "@/components/ui/use-toast"
import { useRouter } from "next/navigation"

type PropertyUndoCheckInButtonProps = {
  propertyId: number
  shareholderId: string
  meetingId: string
  size?: "sm" | "default"
  className?: string
}

export default function PropertyUndoCheckInButton({
  propertyId,
  shareholderId,
  meetingId,
  size = "sm",
  className,
}: PropertyUndoCheckInButtonProps) {
  const [isPending, startTransition] = useTransition()
  const router = useRouter()

  const handleUndo = () => {
    startTransition(async () => {
      try {
        const response = await fetch("/api/properties/manual-checkin", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            shareholderId,
            meetingId,
            action: "undo",
            propertyIds: [propertyId],
          }),
        })

        const data = await response.json()

        if (!response.ok) {
          throw new Error(data.error || "Failed to undo check-in")
        }

        toast({ title: "Success", description: data.message })
        router.refresh()
      } catch (error) {
        toast({
          title: "Error",
          description: error instanceof Error ? error.message : "Failed to undo check-in",
          variant: "destructive",
        })
      }
    })
  }

  return (
    <Button
      type="button"
      size={size}
      variant="outline"
      className={className}
      disabled={isPending}
      onClick={(e) => {
        e.stopPropagation()
        handleUndo()
      }}
    >
      {isPending ? "Undoing…" : "Undo check-in"}
    </Button>
  )
}
