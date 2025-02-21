import { Suspense } from "react"
import ShareholdersList from "@/components/ShareholderList"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { getShareholdersList } from "@/actions/getShareholdersList"

interface ShareholdersPageProps {
  searchParams: Promise<{
    page?: string
    itemsPerPage?: string
  }>
}

export default async function ShareholdersPage({ searchParams }: ShareholdersPageProps) {
  const { page: pageParam, itemsPerPage: itemsPerPageParam } = await searchParams

  const page = pageParam && !isNaN(Number(pageParam)) ? Math.max(1, Number.parseInt(pageParam, 10)) : 1
  const itemsPerPage =
    itemsPerPageParam && !isNaN(Number(itemsPerPageParam)) ? Math.max(10, Number.parseInt(itemsPerPageParam, 10)) : 25

  const { shareholders, totalShareholders } = await getShareholdersList(page, itemsPerPage)

  return (
    <div className="container mx-auto p-6">
      <Card>
        <CardHeader>
          <CardTitle>Shareholders</CardTitle>
          <CardDescription>View and manage shareholder information</CardDescription>
        </CardHeader>
        <CardContent>
          <Suspense fallback={<ShareholdersListSkeleton />}>
            <ShareholdersList
              initialShareholders={shareholders}
              totalShareholders={totalShareholders}
              currentPage={page}
              itemsPerPage={itemsPerPage}
            />
          </Suspense>
        </CardContent>
      </Card>
    </div>
  )
}

function ShareholdersListSkeleton() {
  return (
    <div className="space-y-4">
      <div className="space-y-2">
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} className="h-12 w-full" />
        ))}
      </div>
    </div>
  )
}