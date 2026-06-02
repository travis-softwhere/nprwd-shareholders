"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { toast } from "@/components/ui/use-toast"
import { useRouter } from "next/navigation"
import SignaturePad from "./SignaturePad"

type PropertyCheckInButtonProps = {
  propertyId: number
  shareholderId: string
  meetingId: string
  shareholderName?: string
  designeeName?: string | null
  mailingAddress?: string | null
  cityStateZip?: string | null
  serviceAddress?: string | null
  totalProperties?: number
  checkedInProperties?: number
  size?: "sm" | "default"
  className?: string
}

export default function PropertyCheckInButton({
  propertyId,
  shareholderId,
  meetingId,
  shareholderName,
  designeeName,
  mailingAddress,
  cityStateZip,
  serviceAddress,
  totalProperties,
  checkedInProperties,
  size = "sm",
  className,
}: PropertyCheckInButtonProps) {
  const [showSignaturePad, setShowSignaturePad] = useState(false)
  const [padKey, setPadKey] = useState(0)
  const router = useRouter()

  const openPad = () => {
    setPadKey((k) => k + 1)
    setShowSignaturePad(true)
  }

  const handleSignatureComplete = async (signatureImage: string, signatureHash: string) => {
    try {
      const response = await fetch("/api/properties/manual-checkin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          shareholderId,
          meetingId,
          action: "checkin",
          propertyIds: [propertyId],
          signatureImage,
          signatureHash,
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || "Failed to check in property")
      }

      setShowSignaturePad(false)
      toast({ title: "Success", description: data.message })
      router.refresh()
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to check in property"
      toast({ title: "Error", description: message, variant: "destructive" })
      throw error instanceof Error ? error : new Error(message)
    }
  }

  return (
    <>
      <Button
        type="button"
        size={size}
        variant="default"
        className={className}
        onClick={(e) => {
          e.stopPropagation()
          openPad()
        }}
      >
        Check in
      </Button>

      {showSignaturePad ? (
        <SignaturePad
          key={padKey}
          onSignatureComplete={handleSignatureComplete}
          onCancel={() => setShowSignaturePad(false)}
          shareholderId={shareholderId}
          shareholderName={shareholderName}
          designeeName={designeeName}
          mailingAddress={mailingAddress}
          cityStateZip={cityStateZip}
          propertyServiceAddress={serviceAddress}
          totalProperties={totalProperties}
          checkedInProperties={checkedInProperties}
        />
      ) : null}
    </>
  )
}
