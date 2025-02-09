import { getShareholdersList } from "@/actions/getShareholdersList"
import ShareholderList from "@/components/ShareholderList"
import type { Property } from "@/types/Property"

export default async function ShareholdersPage({
  searchParams,
}: {
  searchParams: { [key: string]: string | string[] | undefined }
}) {
  // Safely parse search params with fallbacks
  const pageParam = searchParams?.page
  const itemsPerPageParam = searchParams?.itemsPerPage

  const page = typeof pageParam === "string" ? Math.max(1, Number.parseInt(pageParam, 10)) : 1
  const itemsPerPage = typeof itemsPerPageParam === "string" ? Math.max(10, Number.parseInt(itemsPerPageParam, 10)) : 25

  try {
    const { shareholders, totalShareholders } = await getShareholdersList(page, itemsPerPage)

    // Convert shareholders to Property type with null checks
    const properties: Property[] =
      shareholders?.map((shareholder) => ({
        id: shareholder.id,
        account: shareholder.shareholderId,
        numOf: shareholder.totalProperties?.toString() || "0",
        customerName: shareholder.name || "",
        customerMailingAddress: "",
        cityStateZip: "",
        ownerName: shareholder.name || "",
        ownerMailingAddress: "",
        ownerCityStateZip: "",
        residentName: "",
        residentMailingAddress: "",
        residentCityStateZip: "",
        serviceAddress: "",
        checkedIn: shareholder.checkedInProperties > 0,
        shareholderId: shareholder.shareholderId,
        createdAt: new Date(),
      })) || []

    return (
      <main className="flex min-h-screen flex-col items-center p-8">
        <div className="w-full max-w-7xl">
          <ShareholderList
            properties={properties}
            totalProperties={totalShareholders}
            currentPage={page}
            itemsPerPage={itemsPerPage}
          />
        </div>
      </main>
    )
  } catch (error) {
    console.error("Error fetching shareholders:", error)
    return (
      <main className="flex min-h-screen flex-col items-center p-8">
        <div className="w-full max-w-7xl">
          <div className="text-center p-4">
            <h2 className="text-xl font-semibold text-gray-700">Error loading shareholders</h2>
            <p className="text-gray-500">Please try again later</p>
          </div>
        </div>
      </main>
    )
  }
}

