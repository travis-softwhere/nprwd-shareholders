"use client"

import { useState, useEffect, useCallback, useRef } from "react"
import { Button } from "@/components/ui/button"
import { Trophy } from "lucide-react"
import { useSession } from "next-auth/react"
import { useRouter } from "next/navigation"
import { AttendanceCard } from "@/components/AttendanceCard"
import { getMeetingStats } from "@/actions/getMeetingStats"
import { useMeeting } from "@/contexts/MeetingContext"
import 'react-spinning-wheel/dist/style.css';

interface Property {
  id: number
  account: string
  checkedIn: boolean
  shareholderId: string
}

interface Shareholder {
  id: string
  name: string
  shareholderId: string
  meetingId: string
  properties: Property[]
}

export default function AwardsPage() {
  const [selectedShareholder, setSelectedShareholder] = useState<Shareholder | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const { data: session } = useSession()
  const router = useRouter()
  const [attendance, setAttendance] = useState({ checkedIn: 0, total: 0 })
  const [attendanceLoading, setAttendanceLoading] = useState(false)
  const [properties, setProperties] = useState<Property[]>([])
  const [shareholders, setShareholders] = useState<Shareholder[]>([])
  const { selectedMeeting } = useMeeting()
  const [winners, setWinners] = useState<Shareholder[]>([])
  const [showWheel, setShowWheel] = useState(false)
  const [spinning, setSpinning] = useState(false)
  const [wheelWinner, setWheelWinner] = useState<Shareholder | null>(null)
  const [winnerIdx, setWinnerIdx] = useState<number | null>(null)
  const wheelRef = useRef<HTMLDivElement>(null)
  const currentRotation = useRef(0);

  const fetchAttendance = useCallback(async () => {
    setAttendanceLoading(true)
    try {
      const { totalShareholders, checkedInCount } = await getMeetingStats()
      setAttendance({ checkedIn: checkedInCount, total: totalShareholders })
    } catch (err) {
      setAttendance({ checkedIn: 0, total: 0 })
      console.error("Error fetching attendance:", err)
    } finally {
      setAttendanceLoading(false)
    }
  }, [])

  const fetchPropertiesAndShareholders = useCallback(async () => {
    try {
      const shareholdersRes = await fetch("/api/shareholders")
      const shareholdersData = await shareholdersRes.json()
      setShareholders(shareholdersData.shareholders || [])
      console.log("Fetched shareholders:", shareholdersData.shareholders)

      const propertiesRes = await fetch("/api/properties?limit=5000")
      const propertiesData = await propertiesRes.json()
      // Log raw data to see what we're getting from the API
      console.log("Raw API response (first property):", propertiesData[0])
      console.log("Raw checked_in values:", propertiesData.map((p: any) => p.checked_in))
      console.log("Raw checkedIn property:", propertiesData.find((p: any) => p.checked_in));
      
      // Map the properties to ensure consistent field names
      const mappedProperties = propertiesData.map((p: any) => ({
        ...p,
        checkedIn: p.checked_in === true || p.checked_in === "true" || p.checkedIn === true || p.checkedIn === "true",
        shareholderId: p.shareholderId || p.shareholder_id || p['shareholderId'] || p['shareholder_id'],
      }))
      setProperties(mappedProperties)
      console.log("Fetched properties (first 5):", mappedProperties.slice(0, 5))
      if (mappedProperties.length > 0) {
        console.log("Property keys:", Object.keys(mappedProperties[0]))
      }
      console.log("All checkedIn properties (full objects):", mappedProperties.filter((p: any) => p.checkedIn));
      console.log("All checkedIn property shareholderIds", mappedProperties.filter((p: Property) => p.checkedIn).map((p: Property) => `[${p.shareholderId}]`));
      console.log("All keys of a checkedIn property:", Object.keys(mappedProperties.filter((p: any) => p.checkedIn)[0] || {}));
    } catch (err) {
      setProperties([])
      setShareholders([])
      console.error("Error fetching properties/shareholders:", err)
    }
  }, [])

  useEffect(() => {
    fetchAttendance()
    fetchPropertiesAndShareholders()
  }, [fetchAttendance, fetchPropertiesAndShareholders])

  const selectRandomShareholder = async () => {
    try {
      setIsLoading(true)
      setError(null)
      if (!selectedMeeting) {
        throw new Error("No meeting selected")
      }
      // Exclude previous winners
      const winnerIds = new Set(winners.map(w => w.shareholderId))
      const meetingShareholderIds = shareholders
        .filter(s => String(s.meetingId).trim() === String(selectedMeeting.id).trim())
        .map(s => String(s.shareholderId).trim())
      const checkedInProperties = properties.filter(
        (p: any) => p.checkedIn && meetingShareholderIds.includes(String(p.shareholderId).trim()) && !winnerIds.has(String(p.shareholderId).trim())
      )
      // Get unique shareholderIds from checked-in properties
      const uniqueShareholderIds = Array.from(new Set(checkedInProperties.map((p: any) => String(p.shareholderId).trim())))
      if (uniqueShareholderIds.length === 0) {
        throw new Error("No checked-in properties found for this meeting")
      }
      // Select a random shareholderId
      const randomIndex = Math.floor(Math.random() * uniqueShareholderIds.length)
      const winningShareholderId = uniqueShareholderIds[randomIndex]
      // Find the shareholder associated with this shareholderId
      const winner = shareholders.find(s => String(s.shareholderId).trim() === winningShareholderId)
      if (!winner) {
        throw new Error("No shareholder found for the winning property")
      }
      setSelectedShareholder(winner)
      setWinners(prev => [winner, ...prev]) // Add to top of list
    } catch (error) {
      setError(error instanceof Error ? error.message : "An error occurred")
      setSelectedShareholder(null)
    } finally {
      setIsLoading(false)
    }
  }

  // Reset winners on refresh
  useEffect(() => {
    setWinners([])
  }, [])

  // Get unique checked-in shareholders eligible for draw
  const eligibleShareholders = Array.from(new Set(properties.filter(
    (p: any) => 
      p.checkedIn &&
      shareholders.some(s => String(s.shareholderId).trim() === String(p.shareholderId).trim()) &&
      !winners.some(w => String(w.shareholderId).trim() === String(p.shareholderId).trim())
  ).map((p: any) => String(p.shareholderId).trim())))
    .map(shareholderId => shareholders.find(s => String(s.shareholderId).trim() === shareholderId))
    .filter(Boolean) as Shareholder[]

  // Wheel spin handler
  const handleSpinWheel = () => {
    if (spinning || eligibleShareholders.length === 0) return;

    // Pick a random winner index from the current eligibleShareholders
    const idx = Math.floor(Math.random() * eligibleShareholders.length);
    setWinnerIdx(idx);
    setWheelWinner(eligibleShareholders[idx]);
    setSpinning(true);

    // Spin the wheel so the pointer lands on the winner
    const totalSpins = 5;
    const anglePerSlice = 360 / eligibleShareholders.length;
    const randomAngle = idx * anglePerSlice + anglePerSlice / 2;
    const rotationDelta = totalSpins * 360 + (360 - randomAngle);
    currentRotation.current += rotationDelta;
    if (wheelRef.current) {
      wheelRef.current.style.transition = 'transform 4s ease-out';
      wheelRef.current.style.transform = `rotate(${currentRotation.current}deg)`;
    }

    // After the spin, remove the winner from eligibleShareholders
    setTimeout(() => {
      setSpinning(false);
      // Add winner to winners array and set checkedIn: false for that winner
      setWinners(prev => [eligibleShareholders[idx], ...prev]);
      setProperties(prevProps => prevProps.map(p =>
        String(p.shareholderId).trim() === String(eligibleShareholders[idx].shareholderId).trim()
          ? { ...p, checkedIn: false }
          : p
      ));
    }, 4000);
  };

  // Reset wheel when modal closes
  const handleCloseWheel = () => {
    setShowWheel(false)
    setWheelWinner(null)
    if (wheelRef.current) {
      wheelRef.current.style.transition = ''
      wheelRef.current.style.transform = 'rotate(0deg)'
    }
  }

  if (!session) {
    router.push("/auth/signin")
    return null
  }

  // Example data
  const data = eligibleShareholders.length > 0
    ? eligibleShareholders.map(s => ({ option: s.name }))
    : [{ option: "No eligible shareholders" }];

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="max-w-2xl mx-auto text-center">
        <h1 className="text-4xl font-bold mb-8">2025 Meeting Awards</h1>

        <div className="flex justify-center items-center gap-8 mb-8">
          {/* <img 
            src="/NPRWDLogo.png" 
            alt="NPRWD Logo" 
            className="h-16 object-contain"
          /> */}
          <a href='https://soft-where.com' target="_blank">
            <div className="flex flex-col items-center bg-[#1a2550] px-6 py-2 rounded-xl gap-1">
              <img 
                src="/soft-where-logo.png" 
                alt="SOFT-WHERE Logo" 
                className="h-20 object-contain bg-transparent"
              />
              <span className="text-white text-xs">Powered by SOFT-WHERE, LLC - Minot, ND</span>
            </div>
          </a>
        </div>
        
        <div className="flex flex-row gap-8 items-center justify-center">
          {/* <AttendanceCard
            checkedIn={attendance.checkedIn}
            total={attendance.total}
            loading={attendanceLoading}
            onRefresh={fetchAttendance}
          /> */}

          <button
            onClick={() => setShowWheel(true)}
            disabled={isLoading}
            className={`
              flex flex-col items-center justify-center
              w-32 h-32
              bg-black text-white
              rounded-full
              shadow-lg
              transition
              hover:bg-gray-800
              disabled:opacity-50
              focus:outline-none
              focus:ring-2 focus:ring-offset-2 focus:ring-black
              text-center
              text-base
            `}
            style={{ minWidth: '8rem', minHeight: '8rem' }}
          >
            <Trophy className="h-10 w-10 mb-2" />
            {isLoading ? "Selecting..." : (
              <>
                <span className="block font-semibold">Draw</span>
                <span className="block text-xs">Random Doorprize Winner</span>
              </>
            )}
          </button>
        </div>

        {/* Checked-in Shareholders List
        <div className="max-w-xl mx-auto mt-8">
          <h3 className="text-lg font-bold mb-2 text-left">Checked-In Shareholders</h3>
          <div className="bg-white rounded-lg shadow border divide-y divide-gray-200 max-h-64 overflow-y-auto">
            {Array.from(new Set(properties.filter(
              (p: any) => p.checkedIn && shareholders.some(s => String(s.shareholderId).trim() === String(p.shareholderId).trim())
            ).map((p: any) => String(p.shareholderId).trim())))
              .map(shareholderId => {
                const shareholder = shareholders.find(s => String(s.shareholderId).trim() === shareholderId)
                return shareholder ? (
                  <div key={shareholder.shareholderId} className="py-2 px-4 flex flex-col text-left">
                    <span className="font-semibold">{shareholder.name}</span>
                    <span className="text-xs text-gray-500">Benefit Unit Owner ID: {shareholder.shareholderId}</span>
                  </div>
                ) : null
              })
            }
          </div>
        </div> */}

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-8">
            <p className="font-medium">{error}</p>
            <p className="text-sm mt-1">
              {error === "No shareholders with checked-in properties found" 
                ? "Please ensure properties have been checked in before selecting a winner."
                : "Please try again later."}
            </p>
          </div>
        )}

        {selectedShareholder && (
          <div className="bg-white p-6 rounded-lg shadow-lg mb-8">
            <h2 className="text-2xl font-semibold mb-4">Winner Selected!</h2>
            <p className="text-xl mb-2">Shareholder ID: {selectedShareholder.shareholderId}</p>
            <p className="text-xl">Name: {selectedShareholder.name}</p>
          </div>
        )}
        {winners.length > 0 && (
          <div className="max-w-md mx-auto mt-6">
            <h3 className="text-lg font-bold mb-2">Winners List</h3>
            <ul className="bg-white rounded-lg shadow divide-y divide-gray-200">
              {winners.map((winner, idx) => (
                <li key={winner.shareholderId} className="py-2 px-4 flex flex-col text-left">
                  <span className="font-semibold">{winner.name}</span>
                  <span className="text-xs text-gray-500">Shareholder ID: {winner.shareholderId}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Spinning Wheel Modal */}
        {showWheel && eligibleShareholders.length > 0 && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-60">
            <div className="bg-white rounded-lg shadow-lg p-6 relative flex flex-col items-center">
              <button onClick={handleCloseWheel} className="absolute top-2 right-2 text-gray-500 hover:text-black text-xl">×</button>
              <div className="mb-4 font-bold text-lg">Spin the Wheel!</div>
              <div className="relative flex flex-col items-center">
                {/* SVG Triangle Pointer */}
                <svg width="20" height="20" viewBox="0 0 100 100" className="absolute -top-5 left-1/2 -translate-x-1/2 z-10">
                  <polygon points="50,0 0,100 100,100" fill="#1ca9e1" />
                </svg>
                {/* Wheel */}
                <div className="w-72 h-72 rounded-full border-4 border-[#1ca9e1] flex items-center justify-center relative overflow-hidden" ref={wheelRef} style={{ background: '#fff' }}>
                  <svg width="100%" height="100%" viewBox="0 0 300 300" className="absolute top-0 left-0">
                    {eligibleShareholders.map((s, i) => {
                      const angle = 360 / eligibleShareholders.length;
                      const startAngle = i * angle;
                      const endAngle = (i + 1) * angle;
                      const largeArc = angle > 180 ? 1 : 0;
                      const r = 150;
                      const x1 = 150 + r * Math.cos((Math.PI * (startAngle - 90)) / 180);
                      const y1 = 150 + r * Math.sin((Math.PI * (startAngle - 90)) / 180);
                      const x2 = 150 + r * Math.cos((Math.PI * (endAngle - 90)) / 180);
                      const y2 = 150 + r * Math.sin((Math.PI * (endAngle - 90)) / 180);
                      return (
                        <path
                          key={s.shareholderId}
                          d={`M150,150 L${x1},${y1} A${r},${r} 0 ${largeArc},1 ${x2},${y2} Z`}
                          fill={i % 2 === 0 ? '#1ca9e1' : '#fff'}
                          stroke="#1ca9e1"
                        />
                      );
                    })}
                  </svg>
                  {/* Names on segments */}
                  <svg width="100%" height="100%" viewBox="0 0 300 300" className="absolute top-0 left-0">
                    {eligibleShareholders.map((s, i) => {
                        const sliceAngle = 360 / eligibleShareholders.length;
                        const angle = (i + 0.5) * sliceAngle;
                        const rad = (angle - 90) * (Math.PI / 180);

                        const rStart = 75; // slightly in from the edge
                        const rEnd = 100;   // not too close to center
                        const xStart = 150 + rStart * Math.cos(rad);
                        const yStart = 150 + rStart * Math.sin(rad);
                        const xEnd = 150 + rEnd * Math.cos(rad);
                        const yEnd = 150 + rEnd * Math.sin(rad);
                        const rotation = angle + 90;

                        return (
                          <text
                            key={s.shareholderId}
                            x={(xStart + xEnd) / 2}
                            y={(yStart + yEnd) / 2}
                            fill={i % 2 === 0 ? '#fff' : '#1ca9e1'}
                            textAnchor="middle"
                            dominantBaseline="middle"
                            fontSize="10"
                            transform={`rotate(${rotation}, ${(xStart + xEnd) / 2}, ${(yStart + yEnd) / 2})`}
                          >
                            {s.name.length > 15 ? s.name.slice(0, 15) + '…' : s.name}
                          </text>                          
                        );
                    })}
                  </svg>

                </div>
                <button
                  className="mt-8 px-6 py-2 bg-[#1ca9e1] text-white font-bold rounded disabled:opacity-50"
                  onClick={handleSpinWheel}
                  disabled={spinning}
                >
                  {spinning ? 'Spinning...' : 'Spin'}
                </button>
                {wheelWinner && !spinning && (
                  <div className="mt-6 text-center">
                    <div className="text-lg font-bold text-[#1ca9e1]">Winner:</div>
                    <div className="text-xl font-bold">{wheelWinner.name}</div>
                    <div className="text-xs text-gray-500">Benefit Unit Owner ID: {wheelWinner.shareholderId}</div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
