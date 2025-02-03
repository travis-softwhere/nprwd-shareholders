import { getProperties } from "@/utils/csvParser"
import Dashboard from "@/components/Dashboard"

export default async function Home() {
  const { properties, totalProperties } = await getProperties(1, Number.MAX_SAFE_INTEGER)
  const checkedInCount = properties.filter((p) => p.checkedIn).length

  return (
    <main className="flex min-h-screen flex-col items-center p-8">
      <div className="w-full max-w-7xl">
        <Dashboard
          totalShareholders={totalProperties}
          checkedInCount={checkedInCount}
          nextMeetingDate="2024-06-15"
          mailersStatus={false}
        />
      </div>
    </main>
  )
}