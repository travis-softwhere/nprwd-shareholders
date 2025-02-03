import { getProperties } from "@/utils/csvParser"
import ShareholderList from "@/components/ShareholderList"

export default async function ShareholdersPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>
}) {
  const resolvedSearchParams = await searchParams

  const page = resolvedSearchParams.page ? Number.parseInt(resolvedSearchParams.page as string, 10) : 1
  const itemsPerPage = resolvedSearchParams.itemsPerPage
    ? Number.parseInt(resolvedSearchParams.itemsPerPage as string, 10)
    : 25

  const { properties, totalProperties } = await getProperties(page, itemsPerPage)

  return (
    <main className="flex min-h-screen flex-col items-center p-8">
      <div className="w-full max-w-7xl">
        <ShareholderList
          properties={properties}
          totalProperties={totalProperties}
          currentPage={page}
          itemsPerPage={itemsPerPage}
        />
      </div>
    </main>
  )
}