import { getMeetingStats } from "@/actions/getMeetingStats"
import Dashboard from "@/components/Dashboard"
import { redirect } from "next/navigation"
import { getServerSession } from "next-auth/next"
import { authOptions } from "@/lib/auth"
import { getMeetings } from "@/actions/getMeetings"

export default async function Home() {
  // Double-check authentication at the page level for extra security
  const session = await getServerSession(authOptions)
  
  // If not authenticated, redirect to login
  if (!session) {
    redirect("/auth/signin")
  }
  
  // Check if there are any meetings
  const meetings = await getMeetings()
  const hasMeetingData = meetings && meetings.length > 0
  
  // If admin user and no meeting data, redirect to admin page to create meeting
  if (session.user?.isAdmin && !hasMeetingData) {
    redirect("/admin")
  }
  
  // Load stats for the dashboard
  const { totalShareholders, checkedInCount, nextMeeting } = await getMeetingStats()

  return (
    <main className="flex flex-1 justify-center items-center p-8">
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