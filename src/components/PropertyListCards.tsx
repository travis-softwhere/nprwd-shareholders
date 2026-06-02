"use client"

import type { Property } from "@/types/Property"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
import { Badge } from "@/components/ui/badge"
import { History } from "lucide-react"
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
import EditablePropertyName from "@/components/EditablePropertyName"
import { cn } from "@/lib/utils"
import { displayShareholderId } from "@/lib/meetingScopedShareholderId"

function DetailField({
  label,
  value,
  className,
}: {
  label: string
  value?: string | null
  className?: string
}) {
  const text = value?.trim()
  return (
    <div className={cn("min-w-0", className)}>
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="break-words text-sm text-foreground">{text || "—"}</p>
    </div>
  )
}

function hasAnyValue(...values: (string | null | undefined)[]) {
  return values.some((v) => Boolean(v?.trim()))
}

type PropertyListCardsProps = {
  properties: Property[]
  meetingId?: string
  highlightedPropertyId: number | null
  onToggleCheckIn: (property: Property) => void
  onEdit: (property: Property) => void
  onViewHistory: (propertyId: number) => void
  onDelete: (propertyId: number) => void
  onOwnerNameUpdate: (propertyId: number, newName: string) => void
}

export function PropertyListCards({
  properties,
  meetingId,
  highlightedPropertyId,
  onToggleCheckIn,
  onEdit,
  onViewHistory,
  onDelete,
  onOwnerNameUpdate,
}: PropertyListCardsProps) {
  if (properties.length === 0) {
    return (
      <p className="py-12 text-center text-muted-foreground">
        No properties match your search or filters.
      </p>
    )
  }

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
      {properties.map((property) => {
        const displayId = displayShareholderId(property.shareholderId, meetingId)
        const storedIdDiffers =
          property.shareholderId &&
          property.shareholderId !== displayShareholderId(property.shareholderId, meetingId)

        return (
          <Card
            key={property.id}
            id={`property-card-${property.id}`}
            className={cn(
              "overflow-hidden transition-shadow",
              highlightedPropertyId === property.id &&
                "ring-2 ring-amber-400 ring-offset-2",
            )}
          >
            <CardContent className="p-4 sm:p-5">
              <div className="mb-4 flex flex-wrap items-start justify-between gap-3 border-b pb-3">
                <div className="min-w-0 flex-1 space-y-3">
                  <div>
                    <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                      Service address
                    </p>
                    <p className="break-words text-base font-semibold text-foreground">
                      {property.serviceAddress?.trim() || "—"}
                    </p>
                  </div>
                  {property.account?.trim() ? (
                    <div>
                      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                        Account
                      </p>
                      <p className="font-mono text-sm text-muted-foreground">
                        {property.account.trim()}
                      </p>
                    </div>
                  ) : null}
                </div>
                <Badge variant={property.checkedIn ? "success" : "secondary"}>
                  {property.checkedIn ? "Checked in" : "Not checked in"}
                </Badge>
              </div>

              <dl className="grid grid-cols-1 gap-x-6 gap-y-3 sm:grid-cols-2">
                <DetailField
                  label="Benefit unit owner ID"
                  value={displayId}
                  className="sm:col-span-2"
                />
                {storedIdDiffers ? (
                  <p className="text-xs text-muted-foreground sm:col-span-2">
                    Stored as {property.shareholderId}
                  </p>
                ) : null}

                <div className="sm:col-span-2">
                  <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    Owner name
                  </p>
                  <EditablePropertyName
                    initialName={property.ownerName}
                    propertyId={property.id}
                    onUpdate={(newName) => onOwnerNameUpdate(property.id, newName)}
                  />
                </div>
                <DetailField label="Owner mailing address" value={property.ownerMailingAddress} />
                <DetailField label="Owner city, state, zip" value={property.ownerCityStateZip} />

                {hasAnyValue(property.customerName, property.customerMailingAddress) ? (
                  <>
                    <div className="border-t pt-2 sm:col-span-2">
                      <p className="text-xs font-semibold text-muted-foreground">Customer</p>
                    </div>
                    <DetailField label="Customer name" value={property.customerName} />
                    <DetailField
                      label="Customer mailing address"
                      value={property.customerMailingAddress}
                    />
                  </>
                ) : null}

                {hasAnyValue(
                  property.residentName,
                  property.residentMailingAddress,
                  property.residentCityStateZip,
                ) ? (
                  <>
                    <div className="border-t pt-2 sm:col-span-2">
                      <p className="text-xs font-semibold text-muted-foreground">Resident</p>
                    </div>
                    <DetailField label="Resident name" value={property.residentName} />
                    <DetailField
                      label="Resident mailing address"
                      value={property.residentMailingAddress}
                    />
                    <DetailField
                      label="Resident city, state, zip"
                      value={property.residentCityStateZip}
                    />
                  </>
                ) : null}

                {property.numOf?.trim() ? (
                  <DetailField label="Num of" value={property.numOf} />
                ) : null}
              </dl>

              <div className="mt-4 flex flex-col gap-3 border-t pt-4 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
                <label className="flex cursor-pointer items-center gap-2">
                  <Checkbox
                    checked={property.checkedIn}
                    onCheckedChange={() => onToggleCheckIn(property)}
                  />
                  <span
                    className={cn(
                      "text-sm font-medium",
                      property.checkedIn ? "text-green-700" : "text-muted-foreground",
                    )}
                  >
                    {property.checkedIn ? "Checked in" : "Check in this property"}
                  </span>
                </label>

                <div className="flex flex-wrap gap-2">
                  <Button variant="outline" size="sm" onClick={() => onEdit(property)}>
                    Edit
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => onViewHistory(property.id)}
                    aria-label="Transfer history"
                  >
                    <History className="h-4 w-4" />
                    <span className="sr-only sm:not-sr-only sm:ml-1">History</span>
                  </Button>
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button variant="outline" size="sm">
                        Delete
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Delete property</AlertDialogTitle>
                        <AlertDialogDescription>
                          Are you sure you want to delete this property? This action cannot be
                          undone.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction onClick={() => onDelete(property.id)}>
                          Delete
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
              </div>
            </CardContent>
          </Card>
        )
      })}
    </div>
  )
}
