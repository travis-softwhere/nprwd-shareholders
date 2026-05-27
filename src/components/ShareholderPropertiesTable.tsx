import Link from "next/link"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import type { properties } from "@/lib/db/schema"

type ShareholderProperty = typeof properties.$inferSelect & {
  benefitUnitOwnerLabel: string
}

type ShareholderPropertiesTableProps = {
  properties: ShareholderProperty[]
}

export default function ShareholderPropertiesTable({
  properties,
}: ShareholderPropertiesTableProps) {
  const propertyHref = (propertyId: number) => `/properties?propertyId=${propertyId}`

  return (
    <div className="overflow-x-auto rounded-md border">
      <Table className="min-w-[400px]">
        <TableHeader>
          <TableRow>
            <TableHead>Service Address</TableHead>
            <TableHead>Benefit Unit Owner</TableHead>
            <TableHead>Status</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {properties.map((property) => (
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
              <TableCell className="align-middle px-4 py-2">
                <Badge variant={property.checkedIn ? "success" : "secondary"}>
                  {property.checkedIn ? "Checked In" : "Not Checked In"}
                </Badge>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}
