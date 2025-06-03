// [id]/page.tsx

import { getShareholderDetails } from "@/actions/getShareholderDetails"
import { notFound } from "next/navigation"
import Link from "next/link"
import { Card, CardContent } from "@/components/ui/card"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import ManualCheckInButton from "@/components/ManualCheckInButton"
import SetDesigneeForm from "@/components/SetDesigneeForm"
import EditableName from "@/components/EditableName"
import React from 'react';
import ShareholderCommentBox from '@/components/ShareholderCommentBox';
import { db } from "@/lib/db"
import { shareholders } from "@/lib/db/schema"
import { eq } from "drizzle-orm"

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
    const { shareholder, properties } = await getShareholderDetails(shareholderId)
    if (!shareholder) {
      notFound()
    }

    // Fetch all shareholders for the properties
    const propertyShareholderIds = properties.map(p => p.shareholderId)
    const propertyShareholders = await db
      .select()
      .from(shareholders)
      .where(eq(shareholders.shareholderId, propertyShareholderIds[0]))

    const checkedInCount = properties.filter((p) => p.checkedIn).length

    return (
      <div className="container mx-auto p-2 sm:p-6 max-w-full sm:max-w-3xl">
        <h1 className="text-2xl sm:text-4xl font-bold mb-4 sm:mb-8">Benefit Unit Owner Details</h1>
        <Link
          href="/shareholders"
          className="text-primary hover:underline mb-2 sm:mb-4 inline-flex items-center"
        >
          ← Back to List
        </Link>

        <Card className="mt-2 sm:mt-4">
          <CardContent className="p-2 sm:p-6">
            <EditableName 
              initialName={shareholder.name}
              shareholderId={shareholder.shareholderId}
            />
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
              <div>
                <div className="text-sm text-muted-foreground">
                  <span className="font-medium text-foreground">
                  Benefit Unit Owner ID:
                  </span>{" "}
                  {shareholder.shareholderId}
                </div>
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
                  isFullyCheckedIn={checkedInCount === properties.length}
                  />

                  <SetDesigneeForm shareholderId={shareholder.shareholderId} />
                </div>
              </div>
              {/* Comment Box Below Properties */}
              <ShareholderCommentBox shareholderId={shareholder.shareholderId} />
            </div>

            <h2 className="text-lg sm:text-xl font-semibold mb-2 sm:mb-4">Properties</h2>
            <div className="rounded-md border overflow-x-auto">
              <Table className="min-w-[400px]">
                <TableHeader>
                  <TableRow>
                    {/* <TableHead>Account</TableHead> */}
                    <TableHead>Service Address</TableHead>
                    <TableHead>Benefit Unit Owner</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {properties.map((property) => (
                    <TableRow key={property.id}>
                      {/* <TableCell className="font-mono">
                        {property.account}
                      </TableCell> */}
                      <TableCell>{property.serviceAddress}</TableCell>
                      <TableCell>{propertyShareholders[0]?.name || 'Unknown'}</TableCell>
                      <TableCell>
                        <Badge
                          variant={
                            property.checkedIn ? "success" : "secondary"
                          }
                        >
                          {property.checkedIn ? "Checked In" : "Not Checked In"}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

          </CardContent>
        </Card>
      </div>
    )
  } catch (error) {
    // Let Next.js error boundary handle this
    throw error
  }
}
