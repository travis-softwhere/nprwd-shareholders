// app/meeting/[id]/page.tsx
import { getMeetingById } from "@/actions/getMeetings"; // assuming this action exists or needs to be created
import { PrintMailersButton } from "@/components/PrintMailersButton";
import Link from "next/link";
import { notFound } from "next/navigation";

// Update to use Promise type for params, matching Next.js expectations
export default async function MeetingPage({ 
  params 
}: { 
  params: Promise<{ id: string }> 
}) {
  // Await the params promise
  const resolvedParams = await params;
  const { id } = resolvedParams;

  // Fetch meeting data on the server
  const meeting = await getMeetingById(id);

  // If no meeting is found, show a not found page
  if (!meeting) {
    notFound();
  }

  return (
    <div className="container mx-auto p-6">
      <Link
        href="/dashboard"
        className="text-primary hover:underline mb-4 inline-flex items-center"
      >
        ← Back to Dashboard
      </Link>
      
      <div className="mt-6">
        <h1 className="text-2xl font-bold">Meeting on {meeting.date}</h1>
        <p className="mt-2 text-gray-600">
          Total Shareholders: {meeting.totalShareholders || 0}
        </p>
        <p className="mt-1 text-gray-600">
          Checked In: {meeting.checkedIn || 0}
        </p>
      </div>
      
      <div className="mt-6">
        <PrintMailersButton 
          meetingId={meeting.id} 
          onComplete={() => {}} 
          disabled={false}
        />
      </div>
    </div>
  );
}
