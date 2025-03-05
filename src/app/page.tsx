import { getMeetingStats } from "@/actions/getMeetingStats"
import Dashboard from "@/components/Dashboard"

export default async function Home() {
  const { totalShareholders, checkedInCount, nextMeeting } = await getMeetingStats()

  return (
    <main className="flex-1 p-8">
      <div className="w-full max-w-7xl">
        <Dashboard
          totalShareholders={totalShareholders}
          checkedInCount={checkedInCount}
          nextMeetingDate={nextMeeting ? nextMeeting.date.toISOString().split("T")[0] : "Not scheduled"}
          mailersStatus={false}
        />
      </div>
    </main>
  )
}