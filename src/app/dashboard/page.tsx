import { getMeetingStats } from "@/actions/getMeetingStats";
import Dashboard from "@/components/Dashboard";

// Force dynamic rendering to avoid database calls during build
export const dynamic = 'force-dynamic'

export default async function DashboardPage() {
  const { totalShareholders, checkedInCount, nextMeeting } = await getMeetingStats();

  return (
    <main className="flex-1 p-8">
      <div className="flex justify-center w-full max-w-7xl">
        <Dashboard
          // Removed props no longer accepted by the simplified Dashboard component
        />
      </div>
    </main>
  );
} 