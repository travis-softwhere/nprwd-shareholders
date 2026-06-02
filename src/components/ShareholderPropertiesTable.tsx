"use client"

import { useMemo } from "react"
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
import { propertyManagementHref } from "@/lib/propertyPageLink"
import {
  orderPropertiesForSignatureDisplay,
  signatureRowSpanForProperty,
} from "@/lib/groupPropertiesBySignature"
import { formatCheckInDateTime } from "@/lib/formatCheckInTime"
import PropertyCheckInButton from "@/components/PropertyCheckInButton"
import PropertyUndoCheckInButton from "@/components/PropertyUndoCheckInButton"
import type { properties } from "@/lib/db/schema"

type ShareholderProperty = typeof properties.$inferSelect & {
  benefitUnitOwnerLabel: string
}

type ShareholderPropertiesTableProps = {
  properties: ShareholderProperty[]
  shareholderId: string
  meetingId: string
  shareholderName: string
  designeeName?: string | null
  mailingAddress?: string | null
  cityStateZip?: string | null
  checkedInProperties: number
}

export default function ShareholderPropertiesTable({
  properties,
  shareholderId,
  meetingId,
  shareholderName,
  designeeName,
  mailingAddress,
  cityStateZip,
  checkedInProperties,
}: ShareholderPropertiesTableProps) {
  const router = useRouter()

  const orderedProperties = useMemo(() => {
    const order = orderPropertiesForSignatureDisplay(properties).map((p) => p.id)
    const byId = new Map(properties.map((p) => [p.id, p]))
    return order.map((id) => byId.get(id)).filter((p): p is ShareholderProperty => p != null)
  }, [properties])

  return (
    <div className="overflow-x-auto rounded-md border">
      <Table className="min-w-[640px]">
        <TableHeader>
          <TableRow>
            <TableHead className="w-[120px]">Signature</TableHead>
            <TableHead>Service address</TableHead>
            <TableHead>Account</TableHead>
            <TableHead>Benefit unit owner</TableHead>
            <TableHead>Status</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {orderedProperties.map((property) => {
            const href = propertyManagementHref(property)
            const serviceAddress = property.serviceAddress?.trim()
            const account = property.account?.trim()
            const label = serviceAddress || account || `property ${property.id}`
            const { showSignature, rowSpan } = signatureRowSpanForProperty(
              property,
              orderedProperties,
            )

            return (
              <TableRow
                key={property.id}
                className="cursor-pointer hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset"
                onClick={() => router.push(href)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault()
                    router.push(href)
                  }
                }}
                tabIndex={0}
                role="link"
                aria-label={`Open ${label} on Properties page`}
                title="Open on Properties page"
              >
                {showSignature && rowSpan > 0 ? (
                  <TableCell
                    rowSpan={rowSpan}
                    className="align-top border-r bg-muted/20 px-3 py-3"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <div className="flex flex-col items-center gap-2">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={property.signatureImage!}
                        alt="Property check-in signature"
                        className="max-h-20 w-full max-w-[100px] object-contain"
                      />
                      {property.signatureHash ? (
                        <p className="w-full break-all text-center font-mono text-[10px] leading-tight text-muted-foreground">
                          {property.signatureHash.slice(0, 12)}…
                        </p>
                      ) : null}
                      {property.checkedInAt ? (
                        <p className="text-center text-[10px] text-muted-foreground">
                          {formatCheckInDateTime(property.checkedInAt)}
                        </p>
                      ) : null}
                    </div>
                  </TableCell>
                ) : rowSpan === 1 ? (
                  <TableCell className="align-middle px-3 py-3 text-center text-xs text-muted-foreground">
                    —
                  </TableCell>
                ) : null}

                <TableCell className="align-middle px-4 py-3">
                  <span className="break-words text-sm font-medium text-foreground">
                    {serviceAddress || "—"}
                  </span>
                </TableCell>
                <TableCell className="align-middle px-4 py-3">
                  <span className="font-mono text-xs text-muted-foreground">
                    {account || "—"}
                  </span>
                </TableCell>
                <TableCell className="align-middle px-4 py-3">
                  <span className="break-words text-sm text-foreground">
                    {property.benefitUnitOwnerLabel}
                  </span>
                </TableCell>
                <TableCell
                  className="align-middle px-4 py-3"
                  onClick={(e) => e.stopPropagation()}
                >
                  {property.checkedIn ? (
                    <div className="flex flex-col items-start gap-2 sm:flex-row sm:items-center">
                      <Badge variant="success">Checked In</Badge>
                      <PropertyUndoCheckInButton
                        propertyId={property.id}
                        shareholderId={shareholderId}
                        meetingId={meetingId}
                      />
                    </div>
                  ) : (
                    <div className="flex flex-col items-start gap-2 sm:flex-row sm:items-center">
                      <Badge variant="secondary">Not Checked In</Badge>
                      <PropertyCheckInButton
                        propertyId={property.id}
                        shareholderId={shareholderId}
                        meetingId={meetingId}
                        shareholderName={shareholderName}
                        designeeName={designeeName}
                        mailingAddress={mailingAddress}
                        cityStateZip={cityStateZip}
                        serviceAddress={serviceAddress}
                        totalProperties={properties.length}
                        checkedInProperties={checkedInProperties}
                      />
                    </div>
                  )}
                </TableCell>
              </TableRow>
            )
          })}
        </TableBody>
      </Table>
    </div>
  )
}
