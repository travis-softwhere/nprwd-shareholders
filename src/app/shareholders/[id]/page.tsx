// [id]/page.tsx

import { getShareholderDetails } from "@/actions/getShareholderDetails"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { notFound } from "next/navigation"
import Link from "next/link"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import ManualCheckInButton from "@/components/ManualCheckInButton"
import ShareholderPropertiesTable from "@/components/ShareholderPropertiesTable"
import SetDesigneeForm from "@/components/SetDesigneeForm"
import EditableName from "@/components/EditableName"
import React from 'react';
import ShareholderCommentBox from '@/components/ShareholderCommentBox';
import { ShareholderBarcodeId } from "@/components/ShareholderBarcodeId"

// Update to use Promise type for params, matching Next.js expectations
export default async function ShareholderPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  // Await the params promise
  const resolvedParams = await params;
  const { id: shareholderId } = resolvedParams;

  try {
    const session = await getServerSession(authOptions)
    const { shareholder, properties } = await getShareholderDetails(shareholderId)
    if (!shareholder) {
      notFound()
    }

    const checkedInCount = properties.filter((p) => p.checkedIn).length

    const propertiesWithLabels = properties.map((property) => ({
      ...property,
      benefitUnitOwnerLabel: property.ownerName?.trim() || shareholder.name,
    }))

    return (
      <div className="container mx-auto p-2 sm:p-6 max-w-full sm:max-w-3xl">
        <h1 className="text-2xl sm:text-4xl font-bold mb-4 sm:mb-8">Benefit Unit Owner Details</h1>
        <Link
          href="/"
          className="text-primary hover:underline mb-2 sm:mb-4 inline-flex items-center"
        >
          ← Back to benefit unit owners
        </Link>

        <Card className="mt-2 sm:mt-4">
          <CardContent className="p-2 sm:p-6">
            <EditableName 
              initialName={shareholder.name}
              shareholderId={shareholder.shareholderId}
            />
            {(shareholder.ownerMailingAddress?.trim() || shareholder.ownerCityStateZip?.trim()) ? (
              <div className="mt-2 text-sm text-muted-foreground">
                <span className="font-medium text-foreground">Mailing address: </span>
                {shareholder.ownerMailingAddress?.trim()}
                {shareholder.ownerMailingAddress?.trim() && shareholder.ownerCityStateZip?.trim()
                  ? ", "
                  : null}
                {shareholder.ownerCityStateZip?.trim()}
              </div>
            ) : null}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
              <div>
                <ShareholderBarcodeId
                  storedShareholderId={shareholder.shareholderId}
                  meetingId={String(shareholder.meetingId)}
                  showFixAction={session?.user?.isAdmin === true}
                />
                <div className="text-sm text-muted-foreground">
                  <span className="bg-yellow-200 font-medium text-foreground">
                    Was new since mailers:
                  </span>{" "}
                  <span className="bg-yellow-200">{shareholder.isNew ? 'Yes' : 'No'}</span>
                </div>
                <div className="text-sm text-muted-foreground">
                  <span className="font-medium text-foreground">
                    Total Properties:
                  </span>{" "}
                  {properties.length}
                </div>
                <div className="text-sm text-muted-foreground">
                  <span className="font-medium text-foreground">
                    Check-in Status:
                  </span>{" "}
                  <Badge
                    variant={
                      checkedInCount === properties.length
                        ? "success"
                        : "secondary"
                    }
                  >
                    {checkedInCount} / {properties.length} Checked In
                  </Badge>
                  <ManualCheckInButton
                  shareholderId={shareholder.shareholderId}
                  meetingId={shareholder.meetingId}
                  isFullyCheckedIn={checkedInCount === properties.length}
                  shareholderName={shareholder.name}
                  designeeName={shareholder.designee}
                  mailingAddress={shareholder.ownerMailingAddress}
                  cityStateZip={shareholder.ownerCityStateZip}
                  totalProperties={properties.length}
                  checkedInProperties={checkedInCount}
                  />

                  <SetDesigneeForm shareholderId={shareholder.shareholderId} />
                </div>
              </div>
              {/* Comment Box Below Properties */}
              <ShareholderCommentBox shareholderId={shareholder.shareholderId} />
            </div>

            <h2 className="text-lg sm:text-xl font-semibold mb-2 sm:mb-4">Properties</h2>
            <p className="mb-3 text-xs text-muted-foreground">
              Signatures are stored on each property. Use Check In on a row to sign for one property,
              or Check In Remaining to sign for all unchecked properties at once. Click a row to open
              that property on the Properties page.
            </p>
            <ShareholderPropertiesTable
              properties={propertiesWithLabels}
              shareholderId={shareholder.shareholderId}
              meetingId={String(shareholder.meetingId)}
              shareholderName={shareholder.name}
              designeeName={shareholder.designee}
              mailingAddress={shareholder.ownerMailingAddress}
              cityStateZip={shareholder.ownerCityStateZip}
              checkedInProperties={checkedInCount}
            />

          </CardContent>
        </Card>
      </div>
    )
  } catch (error) {
    // Let Next.js error boundary handle this
    throw error
  }
}
