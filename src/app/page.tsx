import { getMeetingStats } from "@/actions/getMeetingStats"
import Dashboard from "@/components/Dashboard"
import { redirect } from "next/navigation"
import { auth } from "@/lib/auth"

export default async function Home() {
  // Get the session
  const session = await auth()
  
  // If no session, redirect to auth page directly
  if (!session) {
    redirect("/auth/signin")
    return null; // This line will never execute but helps TypeScript understand the control flow
  }
  
  // Only fetch data and render dashboard if authenticated
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