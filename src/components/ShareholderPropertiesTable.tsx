"use client"

import { useState, useTransition } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { toast } from "@/components/ui/use-toast"
import { cn } from "@/lib/utils"
import { formatPropertyForApi } from "@/lib/formatPropertyForApi"
import { benefitUnitOwnerHasSignature } from "@/lib/benefitUnitOwnerCheckIn"
import { saveShareholderSignature } from "@/actions/saveShareholderSignature"
import SignaturePad from "@/components/SignaturePad"
import type { properties } from "@/lib/db/schema"

type ShareholderProperty = typeof properties.$inferSelect & {
  benefitUnitOwnerLabel: string
}

type ShareholderPropertiesTableProps = {
  properties: ShareholderProperty[]
  shareholderId: string
  shareholderName: string
  shareholderSignatureImage: string | null
  shareholderSignatureHash: string | null
  designeeName?: string | null
  mailingAddress?: string | null
  cityStateZip?: string | null
}

export default function ShareholderPropertiesTable({
  properties: initialProperties,
  shareholderId,
  shareholderName,
  shareholderSignatureImage,
  shareholderSignatureHash,
  designeeName,
  mailingAddress,
  cityStateZip,
}: ShareholderPropertiesTableProps) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [properties, setProperties] = useState(initialProperties)
  const [pendingCheckInProperty, setPendingCheckInProperty] = useState<ShareholderProperty | null>(
    null,
  )
  const [showSignaturePad, setShowSignaturePad] = useState(false)
  const [togglingPropertyId, setTogglingPropertyId] = useState<number | null>(null)

  const hasShareholderSignature = benefitUnitOwnerHasSignature({
    signatureImage: shareholderSignatureImage,
    signatureHash: shareholderSignatureHash,
  })

  const propertyHref = (propertyId: number) => `/properties?propertyId=${propertyId}`

  const propertyForApi = (property: ShareholderProperty, checkedIn: boolean) => {
    const { benefitUnitOwnerLabel: _label, ...rest } = property
    return formatPropertyForApi({ ...rest, checkedIn })
  }

  const updatePropertyCheckIn = async (
    property: ShareholderProperty,
    checkedIn: boolean,
  ): Promise<boolean> => {
    const response = await fetch(`/api/properties/${property.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(propertyForApi(property, checkedIn)),
    })

    if (!response.ok) {
      const data = await response.json().catch(() => ({}))
      throw new Error(
        typeof data.error === "string" ? data.error : "Failed to update check-in status",
      )
    }

    const updated = await response.json()
    setProperties((prev) => prev.map((p) => (p.id === updated.id ? { ...p, ...updated } : p)))
    return true
  }

  const handleCheckOut = (property: ShareholderProperty) => {
    setTogglingPropertyId(property.id)
    startTransition(async () => {
      try {
        await updatePropertyCheckIn(property, false)
        toast({
          title: "Checked out",
          description: property.serviceAddress || property.account,
        })
        router.refresh()
      } catch (error) {
        toast({
          title: "Error",
          description: error instanceof Error ? error.message : "Failed to check out",
          variant: "destructive",
        })
      } finally {
        setTogglingPropertyId(null)
      }
    })
  }

  const handleCheckInClick = (property: ShareholderProperty) => {
    if (hasShareholderSignature) {
      setTogglingPropertyId(property.id)
      startTransition(async () => {
        try {
          await updatePropertyCheckIn(property, true)
          toast({
            title: "Checked in",
            description: property.serviceAddress || property.account,
          })
          router.refresh()
        } catch (error) {
          toast({
            title: "Error",
            description: error instanceof Error ? error.message : "Failed to check in",
            variant: "destructive",
          })
        } finally {
          setTogglingPropertyId(null)
        }
      })
      return
    }

    setPendingCheckInProperty(property)
    setShowSignaturePad(true)
  }

  const handleSignatureComplete = async (signatureImage: string, signatureHash: string) => {
    if (!pendingCheckInProperty) return

    const property = pendingCheckInProperty

    const sigResult = await saveShareholderSignature(shareholderId, signatureImage, signatureHash)
    if (!sigResult.success) {
      throw new Error(sigResult.message || "Failed to save signature")
    }

    await updatePropertyCheckIn(property, true)

    setShowSignaturePad(false)
    setPendingCheckInProperty(null)

    toast({
      title: "Checked in",
      description: property.serviceAddress || property.account,
    })
    router.refresh()
  }

  const handleStatusToggle = (property: ShareholderProperty) => {
    if (togglingPropertyId === property.id || isPending) return
    if (property.checkedIn) {
      handleCheckOut(property)
    } else {
      handleCheckInClick(property)
    }
  }

  return (
    <>
      <div className="rounded-md border overflow-x-auto">
        <Table className="min-w-[400px]">
          <TableHeader>
            <TableRow>
              <TableHead>Service Address</TableHead>
              <TableHead>Benefit Unit Owner</TableHead>
              <TableHead>Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {properties.map((property) => {
              const isToggling = togglingPropertyId === property.id
              return (
                <TableRow key={property.id} className="group">
                  <TableCell className="p-0">
                    <Link
                      href={propertyHref(property.id)}
                      className="block w-full px-4 py-2 text-left hover:bg-muted/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset"
                    >
                      {property.serviceAddress}
                    </Link>
                  </TableCell>
                  <TableCell className="p-0">
                    <Link
                      href={propertyHref(property.id)}
                      className="block w-full px-4 py-2 text-left hover:bg-muted/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset"
                    >
                      {property.benefitUnitOwnerLabel}
                    </Link>
                  </TableCell>
                  <TableCell className="align-middle">
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className={cn(
                        "h-auto px-2 py-1",
                        property.checkedIn && "hover:bg-green-100",
                      )}
                      disabled={isToggling || isPending}
                      onClick={() => handleStatusToggle(property)}
                      title={
                        property.checkedIn
                          ? "Click to check out this property"
                          : "Click to check in this property"
                      }
                    >
                      <Badge
                        variant={property.checkedIn ? "success" : "secondary"}
                        className={cn(
                          "cursor-pointer",
                          property.checkedIn && "hover:opacity-90",
                        )}
                      >
                        {isToggling
                          ? "Updating…"
                          : property.checkedIn
                            ? "Checked In"
                            : "Not Checked In"}
                      </Badge>
                    </Button>
                  </TableCell>
                </TableRow>
              )
            })}
          </TableBody>
        </Table>
      </div>

      {showSignaturePad && pendingCheckInProperty ? (
        <SignaturePad
          shareholderId={shareholderId}
          shareholderName={shareholderName}
          designeeName={designeeName}
          mailingAddress={mailingAddress}
          cityStateZip={cityStateZip}
          propertyServiceAddress={pendingCheckInProperty.serviceAddress}
          onSignatureComplete={handleSignatureComplete}
          onCancel={() => {
            setShowSignaturePad(false)
            setPendingCheckInProperty(null)
          }}
        />
      ) : null}
    </>
  )
}
