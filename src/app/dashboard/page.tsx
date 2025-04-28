import { getMeetingStats } from "@/actions/getMeetingStats";
import Dashboard from "@/components/Dashboard";

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