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
import CheckInButton from "@/components/CheckInButton"
import ManualCheckInButton from "@/components/ManualCheckInButton"

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

    const checkedInCount = properties.filter((p) => p.checkedIn).length

    return (
      <div className="container mx-auto p-6">
        <Link
          href="/shareholders"
          className="text-primary hover:underline mb-4 inline-flex items-center"
        >
          ← Back to List
        </Link>

        <Card className="mt-4">
          <CardContent className="p-6">
            <h1 className="text-2xl font-bold mb-4">{shareholder.name}</h1>
            <div className="grid grid-cols-2 gap-4 mb-6">
              <div>
                <div className="text-sm text-muted-foreground">
                  <span className="font-medium text-foreground">
                  Benefit Unit Owner ID:
                  </span>{" "}
                  {shareholder.shareholderId}
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
                </div>
              </div>
            </div>

            <h2 className="text-xl font-semibold mb-4">Properties</h2>
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Account</TableHead>
                    <TableHead>Service Address</TableHead>
                    <TableHead>Benefit Unit Owner</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {properties.map((property) => (
                    <TableRow key={property.id}>
                      <TableCell className="font-mono">
                        {property.account}
                      </TableCell>
                      <TableCell>{property.serviceAddress}</TableCell>
                      <TableCell>{property.ownerName}</TableCell>
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
