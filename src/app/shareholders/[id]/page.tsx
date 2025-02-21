import { getShareholderDetails } from "@/actions/getShareholderDetails"
import Link from "next/link"
import { notFound } from "next/navigation"
import { Card, CardContent } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"

interface ShareholderPageProps {
    params: { id: string }
}

export default async function ShareholderPage({ params }: ShareholderPageProps) {
    const shareholderId = (await params).id

    try {
        const { shareholder, properties } = await getShareholderDetails(shareholderId)

        if (!shareholder) {
            notFound()
        }

        const checkedInCount = properties.filter((p) => p.checkedIn).length

        return (
            <div className="container mx-auto p-6">
                <Link href="/shareholders" className="text-primary hover:underline mb-4 inline-flex items-center">
                    ← Back to List
                </Link>

                <Card className="mt-4">
                    <CardContent className="p-6">
                        <h1 className="text-2xl font-bold mb-4">{shareholder.name}</h1>
                        <div className="grid grid-cols-2 gap-4 mb-6">
                            <div>
                                <div className="text-sm text-muted-foreground">
                                    <span className="font-medium text-foreground">Shareholder ID:</span> {shareholder.shareholderId}
                                </div>
                                <div className="text-sm text-muted-foreground">
                                    <span className="font-medium text-foreground">Total Properties:</span> {properties.length}
                                </div>
                                <div className="text-sm text-muted-foreground">
                                    <span className="font-medium text-foreground">Check-in Status:</span>{" "}
                                    <Badge variant={checkedInCount === properties.length ? "success" : "secondary"}>
                                        {checkedInCount} / {properties.length} Checked In
                                    </Badge>
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
                                        <TableHead>Resident Name</TableHead>
                                        <TableHead>Status</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {properties.map((property) => (
                                        <TableRow key={property.id}>
                                            <TableCell className="font-mono">{property.account}</TableCell>
                                            <TableCell>{property.serviceAddress}</TableCell>
                                            <TableCell>{property.residentName}</TableCell>
                                            <TableCell>
                                                <Badge variant={property.checkedIn ? "success" : "secondary"}>
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
        console.error("Error in ShareholderPage:", error)
        throw error
    }
}