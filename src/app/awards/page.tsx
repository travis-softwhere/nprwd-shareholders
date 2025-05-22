"use client"

import { useState, useEffect, useCallback } from "react"
import { Button } from "@/components/ui/button"
import { Trophy } from "lucide-react"
import { useSession } from "next-auth/react"
import { useRouter } from "next/navigation"
import { AttendanceCard } from "@/components/AttendanceCard"
import { getMeetingStats } from "@/actions/getMeetingStats"
import { useMeeting } from "@/contexts/MeetingContext"

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
        checkedIn: p.checked_in,
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
      if (checkedInProperties.length === 0) {
        throw new Error("No checked-in properties found for this meeting")
      }
      // Select a random checked-in property
      const randomIndex = Math.floor(Math.random() * checkedInProperties.length)
      const winningProperty = checkedInProperties[randomIndex]
      // Find the shareholder associated with this property
      const winner = shareholders.find(s => s.shareholderId === winningProperty.shareholderId)
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

  if (!session) {
    router.push("/auth/signin")
    return null
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="max-w-2xl mx-auto text-center">
        <h1 className="text-4xl font-bold mb-8">Shareholder Awards</h1>

        <div className="flex justify-center items-center gap-8 mb-8">
          <img 
            src="/NPRWDLogo.png" 
            alt="NPRWD Logo" 
            className="h-16 object-contain"
          />
          <div className="flex flex-col items-center bg-[#1a2550] px-6 py-2 rounded-xl gap-1">
            <img 
              src="/soft-where-logo.png" 
              alt="SOFT-WHERE Logo" 
              className="h-16 object-contain bg-transparent"
            />
            <span className="text-white text-xs">Powered by SOFT-WHERE, LLC - Minot, ND</span>
          </div>
        </div>
        
        <div className="flex flex-row gap-8 items-center justify-center">
          <AttendanceCard
            checkedIn={attendance.checkedIn}
            total={attendance.total}
            loading={attendanceLoading}
            onRefresh={fetchAttendance}
          />

          <button
            onClick={selectRandomShareholder}
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
      </div>
    </div>
  )
}
