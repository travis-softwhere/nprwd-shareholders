// app/shareholders/[id]/page.tsx
import { getShareholderDetails } from "@/actions/getShareholderDetails";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { PrintMailersButton } from "@/components/PrintMailersButton";

interface ShareholderPageProps {
  params: { id: string };
}

export default async function ShareholderPage({ params }: ShareholderPageProps) {
  // Check authentication
  const session = await getServerSession(authOptions);
  if (!session) {
    redirect("/auth/signin?callbackUrl=/shareholders");
  }

  const shareholderId = params.id;

  try {
    // getShareholderDetails should return an object with { shareholder, properties }
    const { shareholder, properties } = await getShareholderDetails(shareholderId);
    if (!shareholder) {
      return notFound();
    }

    // Extract meeting_id from the shareholder record.
    // Adjust the property name if your Drizzle schema maps it differently.
    const meetingId = shareholder.meetingId;


    console.log("Shareholder details - meeting_id:", meetingId);

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
                  <span className="font-medium text-foreground">Meeting ID:</span> {meetingId || "N/A"}
                </div>
                <div className="text-sm text-muted-foreground">
                  <span className="font-medium text-foreground">Total Properties:</span> {properties.length}
                </div>
                <div className="text-sm text-muted-foreground">
                  <span className="font-medium text-foreground">Check-in Status:</span>{" "}
                  <Badge variant={properties.filter((p) => p.checkedIn).length === properties.length ? "success" : "secondary"}>
                    {properties.filter((p) => p.checkedIn).length} / {properties.length} Checked In
                  </Badge>
                </div>
              </div>
            </div>

            {/* Only render the PrintMailersButton if meetingId exists */}
            {meetingId ? (
              <div className="mb-6">
                <PrintMailersButton meetingId={meetingId} />
              </div>
            ) : (
              <div className="text-sm text-muted-foreground mb-6">No meeting ID found for this shareholder.</div>
            )}

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
    );
  } catch (error) {
    console.error("Error in ShareholderPage:", error);
    throw error;
  }
}
