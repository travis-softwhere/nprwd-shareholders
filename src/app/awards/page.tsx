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

/** Above this count, the wheel uses numbered slices + a name list instead of labels on slices. */
const WHEEL_NAMES_ON_SLICE_MAX = 16

function sliceFillColor(index: number, total: number): string {
  const hue = Math.round((index * 360) / Math.max(total, 1))
  return `hsl(${hue} 68% 45%)`
}

function sliceLabelText(index: number, total: number, showNames: boolean, name: string): string {
  if (!showNames) return String(index + 1)
  const maxLen = total <= 6 ? 20 : total <= 10 ? 14 : total <= 14 ? 10 : 8
  const trimmed = name.trim()
  return trimmed.length > maxLen ? `${trimmed.slice(0, maxLen)}…` : trimmed
}

function sliceFontSize(total: number, showNames: boolean): number {
  if (!showNames) {
    if (total > 80) return 6
    if (total > 40) return 7
    return 9
  }
  if (total <= 6) return 12
  if (total <= 10) return 10
  if (total <= 14) return 8
  return 7
}

function wheelDimensions(count: number): { sizeClass: string; labelRadius: number } {
  if (count <= 10) {
    return { sizeClass: "w-[min(92vw,24rem)] h-[min(92vw,24rem)]", labelRadius: 102 }
  }
  if (count <= WHEEL_NAMES_ON_SLICE_MAX) {
    return { sizeClass: "w-[min(92vw,21rem)] h-[min(92vw,21rem)]", labelRadius: 98 }
  }
  return { sizeClass: "w-[min(92vw,18rem)] h-[min(92vw,18rem)]", labelRadius: 95 }
}

const SPIN_DURATION_MS = 4500
const WINNER_FLASH_MS = 1400

function parseWheelRotationDegrees(transform: string): number {
  if (!transform || transform === "none") return 0
  const match = transform.match(/matrix\(([^)]+)\)/)
  if (!match) return 0
  const values = match[1].split(",").map((v) => Number.parseFloat(v.trim()))
  if (values.length < 2) return 0
  let deg = (Math.atan2(values[1], values[0]) * 180) / Math.PI
  if (deg < 0) deg += 360
  return deg
}

/** Which slice is under the fixed top pointer for a given wheel rotation (degrees CW). */
function sliceIndexAtPointer(rotationDeg: number, count: number): number {
  if (count <= 0) return 0
  const sliceAngle = 360 / count
  const normalized = ((rotationDeg % 360) + 360) % 360
  const pointerAngle = (360 - normalized) % 360
  let idx = Math.floor(pointerAngle / sliceAngle)
  if (idx >= count) idx = count - 1
  return idx
}

function WheelModal({
  meetingYear,
  eligibleShareholders,
  onComplete,
  onCancel,
}: {
  meetingYear: number
  eligibleShareholders: Shareholder[]
  onComplete: (winner: Shareholder) => void
  onCancel: () => void
}) {
  const count = eligibleShareholders.length
  const showNamesOnSlices = count <= WHEEL_NAMES_ON_SLICE_MAX
  const { sizeClass, labelRadius } = wheelDimensions(count)
  const fontSize = sliceFontSize(count, showNamesOnSlices)

  const wheelRef = useRef<HTMLDivElement>(null)
  const currentRotation = useRef(0)
  const pendingWinnerRef = useRef<Shareholder | null>(null)
  const closeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const spinStartedRef = useRef(false)

  const [spinning, setSpinning] = useState(false)
  const [highlightedIndex, setHighlightedIndex] = useState<number | null>(null)
  const [phase, setPhase] = useState<"starting" | "spinning" | "winner">("starting")

  const startSpin = useCallback(() => {
    if (count === 0 || !wheelRef.current) return

    const idx = Math.floor(Math.random() * count)
    const winner = eligibleShareholders[idx]
    pendingWinnerRef.current = winner
    setHighlightedIndex(idx)
    setSpinning(true)
    setPhase("spinning")

    const anglePerSlice = 360 / count
    const sliceCenter = idx * anglePerSlice + anglePerSlice / 2
    const rotationDelta = 5 * 360 + (360 - sliceCenter)
    currentRotation.current += rotationDelta

    const el = wheelRef.current
    el.style.transition = `transform ${SPIN_DURATION_MS}ms cubic-bezier(0.2, 0.8, 0.2, 1)`
    el.style.transform = `rotate(${currentRotation.current}deg)`
  }, [count, eligibleShareholders])

  useEffect(() => {
    if (spinStartedRef.current) return
    spinStartedRef.current = true
    const frame = requestAnimationFrame(() => {
      requestAnimationFrame(() => startSpin())
    })
    return () => cancelAnimationFrame(frame)
  }, [startSpin])

  useEffect(() => {
    if (!spinning) return

    let raf = 0
    const tick = () => {
      const el = wheelRef.current
      if (el) {
        const deg = parseWheelRotationDegrees(window.getComputedStyle(el).transform)
        setHighlightedIndex(sliceIndexAtPointer(deg, count))
      }
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [spinning, count])

  useEffect(() => {
    return () => {
      if (closeTimerRef.current) clearTimeout(closeTimerRef.current)
    }
  }, [])

  const handleTransitionEnd = (event: React.TransitionEvent<HTMLDivElement>) => {
    if (event.propertyName !== "transform" || !spinning) return

    const winner = pendingWinnerRef.current
    if (!winner) return

    const winnerIdx = eligibleShareholders.findIndex(
      (s) => String(s.shareholderId).trim() === String(winner.shareholderId).trim(),
    )
    setSpinning(false)
    setHighlightedIndex(winnerIdx >= 0 ? winnerIdx : null)
    setPhase("winner")

    closeTimerRef.current = setTimeout(() => {
      onComplete(winner)
    }, WINNER_FLASH_MS)
  }

  const highlighted =
    highlightedIndex != null && highlightedIndex >= 0 && highlightedIndex < count
      ? eligibleShareholders[highlightedIndex]
      : null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="bg-white rounded-xl shadow-xl p-5 sm:p-6 relative flex flex-col max-w-4xl w-full max-h-[95vh] overflow-hidden">
        {!spinning && phase === "starting" ? (
          <button
            type="button"
            onClick={onCancel}
            className="absolute top-3 right-3 text-gray-500 hover:text-black text-2xl leading-none z-10"
            aria-label="Close"
          >
            ×
          </button>
        ) : null}

        <div className="text-center mb-3 pr-8">
          <h2 className="font-bold text-lg">{meetingYear} Meeting — Door Prize Draw</h2>
          <p className="text-sm text-muted-foreground mt-1">
            {count} eligible entr{count === 1 ? "y" : "ies"}
          </p>
        </div>

        <div
          className={`mx-auto mb-4 w-full max-w-lg h-[7.25rem] rounded-xl border-2 px-4 flex flex-col items-center justify-center text-center transition-[border-color,background-color,box-shadow] ${
            phase === "winner"
              ? "border-amber-400 bg-amber-50 shadow-md"
              : spinning
                ? "border-cyan-400 bg-cyan-50 animate-pulse"
                : "border-slate-200 bg-slate-50"
          }`}
          aria-live="polite"
        >
          {highlighted ? (
            <div className="w-full min-w-0">
              <p className="h-4 text-xs font-semibold uppercase tracking-wider text-[#0e7490] leading-4">
                {phase === "winner" ? "Winner" : "Now on the wheel"}
              </p>
              <p
                className="mt-1 h-10 text-2xl sm:text-3xl font-bold text-foreground leading-10 truncate"
                title={highlighted.name}
              >
                {highlighted.name}
              </p>
              <p
                className="mt-1 h-4 text-xs text-muted-foreground leading-4 truncate"
                title={
                  !showNamesOnSlices && highlightedIndex != null
                    ? `Slice #${highlightedIndex + 1} · ID ${highlighted.shareholderId}`
                    : `ID ${highlighted.shareholderId}`
                }
              >
                {!showNamesOnSlices && highlightedIndex != null
                  ? `Slice #${highlightedIndex + 1} · `
                  : null}
                ID {highlighted.shareholderId}
              </p>
            </div>
          ) : (
            <p className="h-10 text-muted-foreground leading-10">Spinning…</p>
          )}
        </div>

        <div className="flex flex-col lg:flex-row gap-5 items-center lg:items-start justify-center min-h-0 flex-1 overflow-hidden">
          <div className="relative flex flex-col items-center shrink-0">
            <svg
              width="24"
              height="24"
              viewBox="0 0 100 100"
              className="absolute -top-3 left-1/2 -translate-x-1/2 z-20 drop-shadow"
              aria-hidden
            >
              <polygon points="50,0 0,100 100,100" fill="#0e7490" stroke="#fff" strokeWidth="4" />
            </svg>
            <div
              className={`${sizeClass} rounded-full border-[5px] border-[#0e7490] shadow-lg relative overflow-hidden`}
              ref={wheelRef}
              onTransitionEnd={handleTransitionEnd}
            >
              <svg width="100%" height="100%" viewBox="0 0 300 300" className="block">
                {eligibleShareholders.map((s, i) => {
                  const sliceAngle = 360 / count
                  const startAngle = i * sliceAngle
                  const endAngle = (i + 1) * sliceAngle
                  const largeArc = sliceAngle > 180 ? 1 : 0
                  const r = 150
                  const toRad = (deg: number) => (Math.PI * (deg - 90)) / 180
                  const x1 = 150 + r * Math.cos(toRad(startAngle))
                  const y1 = 150 + r * Math.sin(toRad(startAngle))
                  const x2 = 150 + r * Math.cos(toRad(endAngle))
                  const y2 = 150 + r * Math.sin(toRad(endAngle))
                  const isHighlighted = highlightedIndex === i
                  return (
                    <path
                      key={s.shareholderId}
                      d={`M150,150 L${x1},${y1} A${r},${r} 0 ${largeArc},1 ${x2},${y2} Z`}
                      fill={sliceFillColor(i, count)}
                      stroke={isHighlighted ? "#fbbf24" : "#fff"}
                      strokeWidth={isHighlighted ? 4 : 1.5}
                      style={isHighlighted ? { filter: "brightness(1.2)" } : undefined}
                    />
                  )
                })}
                {eligibleShareholders.map((s, i) => {
                  const sliceAngle = 360 / count
                  const angle = (i + 0.5) * sliceAngle
                  const rad = (Math.PI * (angle - 90)) / 180
                  const cx = 150 + labelRadius * Math.cos(rad)
                  const cy = 150 + labelRadius * Math.sin(rad)
                  let textRotation = angle + 90
                  if (textRotation > 90 && textRotation < 270) {
                    textRotation += 180
                  }
                  const isHighlighted = highlightedIndex === i
                  return (
                    <text
                      key={`${s.shareholderId}-label`}
                      x={cx}
                      y={cy}
                      fill="#fff"
                      textAnchor="middle"
                      dominantBaseline="middle"
                      fontSize={isHighlighted ? fontSize + 1 : fontSize}
                      fontWeight={isHighlighted ? 800 : showNamesOnSlices ? 600 : 700}
                      transform={`rotate(${textRotation}, ${cx}, ${cy})`}
                      style={{ textShadow: "0 1px 3px rgba(0,0,0,0.65)" }}
                    >
                      {sliceLabelText(i, count, showNamesOnSlices, s.name)}
                    </text>
                  )
                })}
                <circle cx="150" cy="150" r="32" fill="#fff" stroke="#0e7490" strokeWidth="3" />
                <text
                  x="150"
                  y="146"
                  textAnchor="middle"
                  dominantBaseline="middle"
                  fontSize="18"
                  fontWeight="bold"
                  fill="#0e7490"
                >
                  {count}
                </text>
                <text
                  x="150"
                  y="162"
                  textAnchor="middle"
                  dominantBaseline="middle"
                  fontSize="9"
                  fill="#64748b"
                >
                  entries
                </text>
              </svg>
            </div>

            <p className="mt-4 h-5 text-sm text-center leading-5 text-muted-foreground">
              {spinning ? (
                <span>Spinning…</span>
              ) : phase === "winner" ? (
                <span className="font-medium text-amber-700">Recording winner…</span>
              ) : (
                <span aria-hidden="true">&nbsp;</span>
              )}
            </p>
          </div>

          {!showNamesOnSlices ? (
            <div className="w-full lg:flex-1 lg:max-w-md min-h-0 flex flex-col border rounded-lg bg-slate-50 overflow-hidden">
              <p className="shrink-0 px-3 py-2 text-sm font-semibold border-b bg-white">
                Eligible names (slice #)
              </p>
              <ol className="overflow-y-auto flex-1 divide-y divide-slate-200 text-sm max-h-[min(40vh,18rem)] lg:max-h-[min(55vh,22rem)]">
                {eligibleShareholders.map((s, i) => {
                  const isHighlighted = highlightedIndex === i
                  return (
                    <li
                      key={s.shareholderId}
                      className={`flex gap-2 px-3 py-2 transition-colors shadow-[inset_0_0_0_2px] ${
                        isHighlighted
                          ? "bg-cyan-100 font-semibold shadow-cyan-400"
                          : "bg-white shadow-transparent"
                      }`}
                    >
                      <span
                        className="shrink-0 w-7 h-7 rounded-full text-white text-xs font-bold flex items-center justify-center"
                        style={{ backgroundColor: sliceFillColor(i, count) }}
                      >
                        {i + 1}
                      </span>
                      <span className="leading-snug pt-0.5">{s.name}</span>
                    </li>
                  )
                })}
              </ol>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  )
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
    setError(null)
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

  const handleWheelComplete = (winner: Shareholder) => {
    setWinners((prev) => [winner, ...prev])
    setSelectedShareholder(winner)
    setProperties((prevProps) =>
      prevProps.map((p) =>
        String(p.shareholderId).trim() === String(winner.shareholderId).trim()
          ? { ...p, checkedIn: false }
          : p,
      ),
    )
    setShowWheel(false)
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
          <WheelModal
            key={`wheel-${eligibleShareholders.map((s) => s.shareholderId).join(",")}`}
            meetingYear={selectedMeeting.year}
            eligibleShareholders={eligibleShareholders}
            onComplete={handleWheelComplete}
            onCancel={() => setShowWheel(false)}
          />
        )}
      </div>
    </div>
  )
}
