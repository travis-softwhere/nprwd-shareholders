import { Suspense } from "react"
import ShareholdersList from "@/components/ShareholderList"
import { Card, CardContent } from "@/components/ui/card"

export default function ShareholdersPage() {
  return (
    <div className="w-full">
      <div className="max-w-6xl mx-auto bg-white px-3 sm:px-6 lg:px-8 py-4 sm:py-6 mb-16 md:mb-6 shadow-sm rounded-lg">
        <Card className="border-0 shadow-none">
          <CardContent className="p-0">
            <ShareholdersList />
          </CardContent>
        </Card>
      </div>
    </div>
  )
}