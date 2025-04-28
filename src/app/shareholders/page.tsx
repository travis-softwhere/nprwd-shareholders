import { Suspense } from "react"
import ShareholdersList from "@/components/ShareholderList"
import { Card, CardContent } from "@/components/ui/card"
import { getShareholdersList } from "@/actions/getShareholdersList"


interface ShareholdersPageProps {
  searchParams: Promise<{
    page?: string
    itemsPerPage?: string
  }>
}

export default async function ShareholdersPage({ searchParams }: ShareholdersPageProps) {
  const resolvedParams = await searchParams;
  const { page: pageParam, itemsPerPage: itemsPerPageParam } = resolvedParams;

  const page = pageParam && !isNaN(Number(pageParam)) ? Math.max(1, Number.parseInt(pageParam, 10)) : 1
  const itemsPerPage =
    itemsPerPageParam && !isNaN(Number(itemsPerPageParam)) ? Math.max(10, Number.parseInt(itemsPerPageParam, 10)) : 25

  const { shareholders, totalShareholders } = await getShareholdersList(page, itemsPerPage)

  return (
    <div className="w-full">
      <div className="max-w-6xl mx-auto bg-white px-3 sm:px-6 lg:px-8 py-4 sm:py-6 mb-16 md:mb-6 shadow-sm rounded-lg">
        {/*<h1 className="text-xl sm:text-2xl font-bold text-gray-900 mb-2 md:mb-4">Benefit Unit Owners</h1>*/}
        
        <Card className="border-0 shadow-none">
          <CardContent className="p-0">
            <ShareholdersList
              initialShareholders={shareholders}
              totalShareholders={totalShareholders}
              currentPage={page}
              itemsPerPage={itemsPerPage}
            />
          </CardContent>
        </Card>
      </div>
    </div>
  )
}