"use client"

import { useState, useEffect, useCallback, useRef, useMemo } from "react"
import Image from "next/image"
import Link from "next/link"
import { Trophy } from "lucide-react"
import { useSession } from "next-auth/react"
import { redirect } from "next/navigation"
import { getMeetingStats } from "@/actions/getMeetingStats"
import { useMeeting } from "@/contexts/MeetingContext"
import { formatMeetingLabel, shareholderMatchesMeetingFilter } from "@/lib/meetingDisplay"
import { LoadingScreen } from "@/components/ui/loading-screen"
import { AttendanceCard } from "@/components/AttendanceCard"

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
  const [error, setError] = useState<string | null>(null)
  const { data: session, status } = useSession()
  const [attendance, setAttendance] = useState({ checkedIn: 0, total: 0 })
  const [attendanceLoading, setAttendanceLoading] = useState(false)
  const [properties, setProperties] = useState<Property[]>([])
  const [shareholders, setShareholders] = useState<Shareholder[]>([])
  const { selectedMeeting, meetings, isLoading: meetingLoading } = useMeeting()
  const [winners, setWinners] = useState<Shareholder[]>([])
  const [showWheel, setShowWheel] = useState(false)
  const [spinning, setSpinning] = useState(false)
  const [wheelWinner, setWheelWinner] = useState<Shareholder | null>(null)
  const wheelRef = useRef<HTMLDivElement>(null)
  const currentRotation = useRef(0)

  useEffect(() => {
    if (status === "unauthenticated") {
      redirect("/login")
    }
  }, [status])

  const fetchAttendance = useCallback(async () => {
    setAttendanceLoading(true)
    try {
      if (!selectedMeeting?.id) {
        setAttendance({ checkedIn: 0, total: 0 })
        return
      }
      const { totalProperties, checkedInCount } = await getMeetingStats(selectedMeeting.id)
      setAttendance({ checkedIn: checkedInCount, total: totalProperties })
    } catch (err) {
      setAttendance({ checkedIn: 0, total: 0 })
      console.error("Error fetching attendance:", err)
    } finally {
      setAttendanceLoading(false)
    }
  }, [selectedMeeting?.id])

  const fetchPropertiesAndShareholders = useCallback(async () => {
    try {
      if (!selectedMeeting?.id) {
        setShareholders([])
        setProperties([])
        return
      }
      const mid = encodeURIComponent(selectedMeeting.id)
      const shareholdersRes = await fetch(`/api/shareholders?meetingId=${mid}`)
      const shareholdersData = await shareholdersRes.json()
      setShareholders(shareholdersData.shareholders || [])

      const propertiesRes = await fetch(`/api/properties?limit=5000&meetingId=${mid}`)
      const propertiesJson = await propertiesRes.json()
      const propertiesData = Array.isArray(propertiesJson)
        ? propertiesJson
        : propertiesJson.properties || []

      const mappedProperties = propertiesData.map((p: Record<string, unknown>) => ({
        ...p,
        checkedIn:
          p.checked_in === true ||
          p.checked_in === "true" ||
          p.checkedIn === true ||
          p.checkedIn === "true",
        shareholderId:
          p.shareholderId ||
          p.shareholder_id ||
          p["shareholderId"] ||
          p["shareholder_id"],
      })) as Property[]
      setProperties(mappedProperties)
    } catch (err) {
      setProperties([])
      setShareholders([])
      console.error("Error fetching properties/shareholders:", err)
    }
  }, [selectedMeeting?.id])

  useEffect(() => {
    fetchAttendance()
    fetchPropertiesAndShareholders()
  }, [fetchAttendance, fetchPropertiesAndShareholders])

  // Reset draw state when the active meeting changes
  useEffect(() => {
    setWinners([])
    setSelectedShareholder(null)
    setShowWheel(false)
    setWheelWinner(null)
    setError(null)
    currentRotation.current = 0
    if (wheelRef.current) {
      wheelRef.current.style.transition = ""
      wheelRef.current.style.transform = "rotate(0deg)"
    }
  }, [selectedMeeting?.id])

  const meetingShareholders = useMemo(() => {
    if (!selectedMeeting?.id) return []
    return shareholders.filter((s) =>
      shareholderMatchesMeetingFilter(s.meetingId, String(selectedMeeting.id), meetings),
    )
  }, [shareholders, selectedMeeting?.id, meetings])

  const meetingShareholderIds = useMemo(
    () => new Set(meetingShareholders.map((s) => String(s.shareholderId).trim())),
    [meetingShareholders],
  )

  const eligibleShareholders = useMemo(() => {
    const winnerIds = new Set(winners.map((w) => String(w.shareholderId).trim()))
    const eligibleIds = Array.from(
      new Set(
        properties
          .filter(
            (p) =>
              p.checkedIn &&
              meetingShareholderIds.has(String(p.shareholderId).trim()) &&
              !winnerIds.has(String(p.shareholderId).trim()),
          )
          .map((p) => String(p.shareholderId).trim()),
      ),
    )
    return eligibleIds
      .map((shareholderId) =>
        meetingShareholders.find((s) => String(s.shareholderId).trim() === shareholderId),
      )
      .filter(Boolean) as Shareholder[]
  }, [properties, meetingShareholders, meetingShareholderIds, winners])

  const handleSpinWheel = () => {
    if (spinning || eligibleShareholders.length === 0) return

    const idx = Math.floor(Math.random() * eligibleShareholders.length)
    const winner = eligibleShareholders[idx]
    setWheelWinner(winner)
    setSpinning(true)

    const totalSpins = 5
    const anglePerSlice = 360 / eligibleShareholders.length
    const randomAngle = idx * anglePerSlice + anglePerSlice / 2
    const rotationDelta = totalSpins * 360 + (360 - randomAngle)
    currentRotation.current += rotationDelta
    if (wheelRef.current) {
      wheelRef.current.style.transition = "transform 4s ease-out"
      wheelRef.current.style.transform = `rotate(${currentRotation.current}deg)`
    }

    setTimeout(() => {
      setSpinning(false)
      setWinners((prev) => [winner, ...prev])
      setSelectedShareholder(winner)
      setProperties((prevProps) =>
        prevProps.map((p) =>
          String(p.shareholderId).trim() === String(winner.shareholderId).trim()
            ? { ...p, checkedIn: false }
            : p,
        ),
      )
    }, 4000)
  }

  const handleCloseWheel = () => {
    setShowWheel(false)
    setWheelWinner(null)
    if (wheelRef.current) {
      wheelRef.current.style.transition = ""
      wheelRef.current.style.transform = "rotate(0deg)"
    }
  }

  const openWheel = () => {
    if (!selectedMeeting) {
      setError("Select the active annual meeting before running a door prize draw.")
      return
    }
    if (eligibleShareholders.length === 0) {
      setError("No checked-in benefit unit owners are eligible for this meeting.")
      return
    }
    setError(null)
    setShowWheel(true)
  }

  if (status === "loading" || meetingLoading) {
    return <LoadingScreen message="Loading awards…" />
  }

  if (!session) {
    return null
  }

  const meetingTitle = selectedMeeting
    ? `${formatMeetingLabel(selectedMeeting)} Awards`
    : "Meeting Awards"

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="max-w-2xl mx-auto text-center">
        <h1 className="text-4xl font-bold mb-2">{meetingTitle}</h1>
        <p className="text-muted-foreground mb-8">
          {selectedMeeting ? (
            <>
              Door prizes for the{" "}
              <span className="font-medium text-foreground">
                {selectedMeeting.year} Annual Meeting
              </span>
              <span className="font-mono text-xs"> (ID {selectedMeeting.id})</span>
            </>
          ) : (
            "Select the active annual meeting in the navigation bar to load checked-in benefit unit owners."
          )}
        </p>

        <div className="flex justify-center items-center mb-8">
          <Link
            href="https://soft-where.com"
            target="_blank"
            rel="noopener noreferrer"
            className="flex flex-col items-center gap-2"
          >
            <Image
              src="/soft-where-logo.png"
              alt="SOFT-WHERE Digital Design"
              width={320}
              height={140}
              className="h-auto w-72 max-w-full object-contain"
              priority
            />
            <span className="text-muted-foreground text-xs">
              Powered by SOFT-WHERE, LLC — Minot, ND
            </span>
          </Link>
        </div>

        {!selectedMeeting ? (
          <p className="text-sm text-amber-700 mb-8">
            Choose the active meeting using the meeting selector in the app header (same as
            check-in and properties).
          </p>
        ) : null}

        <div className="flex flex-row gap-8 items-center justify-center mb-8">
          <AttendanceCard
            checkedIn={attendance.checkedIn}
            total={attendance.total}
            loading={attendanceLoading}
            onRefresh={fetchAttendance}
          />

          <button
            type="button"
            onClick={openWheel}
            disabled={!selectedMeeting || eligibleShareholders.length === 0}
            className="flex flex-col items-center justify-center w-32 h-32 bg-black text-white rounded-full shadow-lg transition hover:bg-gray-800 disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-black text-center text-base"
            style={{ minWidth: "8rem", minHeight: "8rem" }}
          >
            <Trophy className="h-10 w-10 mb-2" />
            <span className="block font-semibold">Draw</span>
            <span className="block text-xs">Random Doorprize Winner</span>
          </button>
        </div>

        {selectedMeeting && eligibleShareholders.length > 0 ? (
          <p className="text-sm text-muted-foreground mb-6">
            {eligibleShareholders.length} checked-in benefit unit owner
            {eligibleShareholders.length === 1 ? "" : "s"} eligible for this meeting
          </p>
        ) : null}

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-8">
            <p className="font-medium">{error}</p>
            <p className="text-sm mt-1">
              {error.includes("checked-in")
                ? "Please ensure properties have been checked in for this meeting before drawing."
                : "Please try again later."}
            </p>
          </div>
        )}

        {selectedShareholder && (
          <div className="bg-white p-6 rounded-lg shadow-lg mb-8">
            <h2 className="text-2xl font-semibold mb-4">Winner Selected!</h2>
            <p className="text-xl mb-2">Benefit Unit Owner ID: {selectedShareholder.shareholderId}</p>
            <p className="text-xl">Name: {selectedShareholder.name}</p>
          </div>
        )}

        {winners.length > 0 && (
          <div className="max-w-md mx-auto mt-6">
            <h3 className="text-lg font-bold mb-2">Winners List</h3>
            <ul className="bg-white rounded-lg shadow divide-y divide-gray-200">
              {winners.map((winner) => (
                <li key={winner.shareholderId} className="py-2 px-4 flex flex-col text-left">
                  <span className="font-semibold">{winner.name}</span>
                  <span className="text-xs text-gray-500">
                    Benefit Unit Owner ID: {winner.shareholderId}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {showWheel && selectedMeeting && eligibleShareholders.length > 0 && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-60">
            <div className="bg-white rounded-lg shadow-lg p-6 relative flex flex-col items-center max-w-[95vw]">
              <button
                type="button"
                onClick={handleCloseWheel}
                className="absolute top-2 right-2 text-gray-500 hover:text-black text-xl"
                aria-label="Close"
              >
                ×
              </button>
              <div className="mb-4 font-bold text-lg">
                {selectedMeeting.year} Meeting — Spin the Wheel!
              </div>
              <div className="relative flex flex-col items-center">
                <svg
                  width="20"
                  height="20"
                  viewBox="0 0 100 100"
                  className="absolute -top-5 left-1/2 -translate-x-1/2 z-10"
                  aria-hidden
                >
                  <polygon points="50,0 0,100 100,100" fill="#1ca9e1" />
                </svg>
                <div
                  className="w-72 h-72 rounded-full border-4 border-[#1ca9e1] flex items-center justify-center relative overflow-hidden"
                  ref={wheelRef}
                  style={{ background: "#fff" }}
                >
                  <svg width="100%" height="100%" viewBox="0 0 300 300" className="absolute top-0 left-0">
                    {eligibleShareholders.map((s, i) => {
                      const angle = 360 / eligibleShareholders.length
                      const startAngle = i * angle
                      const endAngle = (i + 1) * angle
                      const largeArc = angle > 180 ? 1 : 0
                      const r = 150
                      const x1 = 150 + r * Math.cos((Math.PI * (startAngle - 90)) / 180)
                      const y1 = 150 + r * Math.sin((Math.PI * (startAngle - 90)) / 180)
                      const x2 = 150 + r * Math.cos((Math.PI * (endAngle - 90)) / 180)
                      const y2 = 150 + r * Math.sin((Math.PI * (endAngle - 90)) / 180)
                      return (
                        <path
                          key={s.shareholderId}
                          d={`M150,150 L${x1},${y1} A${r},${r} 0 ${largeArc},1 ${x2},${y2} Z`}
                          fill={i % 2 === 0 ? "#1ca9e1" : "#fff"}
                          stroke="#1ca9e1"
                        />
                      )
                    })}
                  </svg>
                  <svg width="100%" height="100%" viewBox="0 0 300 300" className="absolute top-0 left-0">
                    {eligibleShareholders.map((s, i) => {
                      const sliceAngle = 360 / eligibleShareholders.length
                      const angle = (i + 0.5) * sliceAngle
                      const rad = (angle - 90) * (Math.PI / 180)
                      const rStart = 75
                      const rEnd = 100
                      const xStart = 150 + rStart * Math.cos(rad)
                      const yStart = 150 + rStart * Math.sin(rad)
                      const xEnd = 150 + rEnd * Math.cos(rad)
                      const yEnd = 150 + rEnd * Math.sin(rad)
                      const rotation = angle + 90
                      const cx = (xStart + xEnd) / 2
                      const cy = (yStart + yEnd) / 2
                      return (
                        <text
                          key={`${s.shareholderId}-label`}
                          x={cx}
                          y={cy}
                          fill={i % 2 === 0 ? "#fff" : "#1ca9e1"}
                          textAnchor="middle"
                          dominantBaseline="middle"
                          fontSize="10"
                          transform={`rotate(${rotation}, ${cx}, ${cy})`}
                        >
                          {s.name.length > 15 ? `${s.name.slice(0, 15)}…` : s.name}
                        </text>
                      )
                    })}
                  </svg>
                </div>
                <button
                  type="button"
                  className="mt-8 px-6 py-2 bg-[#1ca9e1] text-white font-bold rounded disabled:opacity-50"
                  onClick={handleSpinWheel}
                  disabled={spinning}
                >
                  {spinning ? "Spinning..." : "Spin"}
                </button>
                {wheelWinner && !spinning && (
                  <div className="mt-6 text-center">
                    <div className="text-lg font-bold text-[#1ca9e1]">Winner:</div>
                    <div className="text-xl font-bold">{wheelWinner.name}</div>
                    <div className="text-xs text-gray-500">
                      Benefit Unit Owner ID: {wheelWinner.shareholderId}
                    </div>
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
