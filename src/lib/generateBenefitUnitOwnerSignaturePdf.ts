import { jsPDF } from "jspdf"
import { groupPropertiesBySignature } from "@/lib/groupPropertiesBySignature"
import { formatCheckInDateTime } from "@/lib/formatCheckInTime"

export type SignaturePdfProperty = {
  id: number
  account?: string | null
  serviceAddress?: string | null
  checkedIn?: boolean | null
  signatureImage?: string | null
  signatureHash?: string | null
  checkedInAt?: Date | string | null
}

export type SignatureListOwner = {
  shareholderId: string
  name: string
  ownerMailingAddress?: string | null
  ownerCityStateZip?: string | null
  designee?: string | null
  properties: SignaturePdfProperty[]
}

export type MeetingSignatureListPdfInput = {
  meetingId: string
  meetingYear?: number | string | null
  meetingDate?: Date | string | null
  owners: SignatureListOwner[]
}

const PAGE_HEIGHT = 279.4
const PAGE_WIDTH = 215.9
const MARGIN = 10
const CONTENT_WIDTH = PAGE_WIDTH - MARGIN * 2
const SIG_W = 38
const SIG_H = 11
const TEXT_X = MARGIN + SIG_W + 3
const TEXT_W = PAGE_WIDTH - TEXT_X - MARGIN
const LINE = 3.6
const BLOCK_GAP = 2
const SIG_PAD = 1

/** Helvetica in jsPDF mis-renders some Unicode (e.g. >=, middle dot) as per-character gaps. */
function pdfAscii(text: string): string {
  return text
    .replace(/\u2265/g, ">=")
    .replace(/[\u2013\u2014]/g, "-")
    .replace(/\u00b7/g, " | ")
    .replace(/\u2014/g, "-")
}

function signatureImageFormat(dataUrl: string): "PNG" | "JPEG" {
  return dataUrl.startsWith("data:image/jpeg") || dataUrl.startsWith("data:image/jpg")
    ? "JPEG"
    : "PNG"
}

function drawSignatureFrame(doc: jsPDF, x: number, y: number, w: number, h: number) {
  doc.setDrawColor(100)
  doc.setFillColor(250, 250, 250)
  doc.setLineWidth(0.25)
  doc.rect(x, y, w, h, "FD")
}

function formatPropertyLine(property: SignaturePdfProperty): string {
  const addr = property.serviceAddress?.trim() || "-"
  const acct = property.account?.trim()
  return acct ? `${addr} (${acct})` : addr
}

function formatPropertiesCompact(properties: SignaturePdfProperty[]): string {
  return properties.map(formatPropertyLine).join("; ")
}

/** Single PDF for the whole meeting — compact rows, one block per owner/signature group. */
export function buildMeetingSignatureListPdfBytes(input: MeetingSignatureListPdfInput): Uint8Array {
  const doc = new jsPDF({ unit: "mm", format: "letter" })
  let y = MARGIN

  const ownersWithCheckIn = input.owners.filter((owner) =>
    owner.properties.some((p) => Boolean(p.checkedIn)),
  )

  const meetingTotalOwners = input.owners.length
  const meetingCheckedInOwners = ownersWithCheckIn.length

  const ensureSpace = (neededMm: number) => {
    if (y + neededMm > PAGE_HEIGHT - MARGIN) {
      doc.addPage()
      y = MARGIN
    }
  }

  const meetingLabel = input.meetingYear
    ? `${input.meetingYear} Annual Meeting`
    : "Benefit Unit Owner Meeting"

  doc.setFont("helvetica", "bold")
  doc.setFontSize(11)
  doc.text(pdfAscii("NPRWD - Signature attendance list"), MARGIN, y)
  y += 5

  doc.setFont("helvetica", "normal")
  doc.setFontSize(8)
  doc.text(meetingLabel, MARGIN, y)
  y += LINE

  if (input.meetingDate) {
    doc.text(
      `Meeting date: ${new Date(input.meetingDate).toLocaleDateString("en-US", { dateStyle: "medium" })}`,
      MARGIN,
      y,
    )
    y += LINE
  }

  const attendanceLine = pdfAscii(
    `Attendance: ${meetingCheckedInOwners} of ${meetingTotalOwners} benefit unit owners with at least one property checked in`,
  )
  const attendanceLines = doc.splitTextToSize(attendanceLine, CONTENT_WIDTH) as string[]
  for (const line of attendanceLines) {
    doc.text(line, MARGIN, y)
    y += LINE
  }
  y += BLOCK_GAP

  doc.setDrawColor(180)
  doc.line(MARGIN, y, PAGE_WIDTH - MARGIN, y)
  y += BLOCK_GAP + 1

  for (const owner of ownersWithCheckIn) {
    const checkedInProps = owner.properties.filter((p) => Boolean(p.checkedIn))
    const checkedInCount = checkedInProps.length
    const totalProperties = owner.properties.length

    const signatureGroups = groupPropertiesBySignature(owner.properties)
    const groupedIds = new Set(signatureGroups.flatMap((g) => g.properties.map((p) => p.id)))
    const checkedNoSig = checkedInProps.filter((p) => !groupedIds.has(p.id))

    const mailing = [owner.ownerMailingAddress?.trim(), owner.ownerCityStateZip?.trim()]
      .filter(Boolean)
      .join(", ")

    const ownerHeader = pdfAscii(
      `${owner.name.trim() || "Owner"} | ${owner.shareholderId} | ${checkedInCount}/${totalProperties} props`,
    )
    const headerLines = doc.splitTextToSize(ownerHeader, CONTENT_WIDTH) as string[]
    const mailingLines = mailing
      ? (doc.splitTextToSize(pdfAscii(mailing), CONTENT_WIDTH) as string[])
      : []
    const designeeLine = owner.designee?.trim()
      ? pdfAscii(`Designee: ${owner.designee.trim()}`)
      : null

    const headerHeight =
      headerLines.length * LINE +
      mailingLines.length * LINE +
      (designeeLine ? LINE : 0) +
      BLOCK_GAP

    if (signatureGroups.length === 0 && checkedNoSig.length === 0) {
      ensureSpace(headerHeight + LINE)
      doc.setFont("helvetica", "bold")
      doc.setFontSize(8)
      for (const line of headerLines) {
        doc.text(line, MARGIN, y)
        y += LINE
      }
      doc.setFont("helvetica", "normal")
      doc.setFontSize(7)
      for (const line of mailingLines) {
        doc.text(line, MARGIN, y)
        y += LINE
      }
      if (designeeLine) {
        doc.text(designeeLine, MARGIN, y)
        y += LINE
      }
      doc.text(pdfAscii("Checked in - no signature on file"), MARGIN, y)
      y += LINE + BLOCK_GAP
      continue
    }

    for (const group of signatureGroups) {
      const propText = formatPropertiesCompact(group.properties)
      const timeLabel = group.checkedInAt
        ? formatCheckInDateTime(group.checkedInAt)
        : ""
      const detailText = pdfAscii(timeLabel ? `${propText} | ${timeLabel}` : propText)
      const detailLines = doc.splitTextToSize(detailText, TEXT_W) as string[]
      const blockHeight = Math.max(SIG_H, headerHeight + detailLines.length * LINE) + BLOCK_GAP

      ensureSpace(blockHeight)

      const blockTop = y

      doc.setFont("helvetica", "bold")
      doc.setFontSize(8)
      let hy = blockTop
      for (const line of headerLines) {
        doc.text(line, MARGIN, hy)
        hy += LINE
      }
      doc.setFont("helvetica", "normal")
      doc.setFontSize(7)
      for (const line of mailingLines) {
        doc.text(line, MARGIN, hy)
        hy += LINE
      }
      if (designeeLine) {
        doc.text(designeeLine, MARGIN, hy)
        hy += LINE
      }

      const sigX = MARGIN
      const sigY = blockTop + headerHeight
      drawSignatureFrame(doc, sigX, sigY, SIG_W, SIG_H)
      try {
        const innerW = SIG_W - SIG_PAD * 2
        const innerH = SIG_H - SIG_PAD * 2
        doc.addImage(
          group.signatureImage,
          signatureImageFormat(group.signatureImage),
          sigX + SIG_PAD,
          sigY + SIG_PAD,
          innerW,
          innerH,
        )
      } catch {
        doc.setFontSize(7)
        doc.text("(signature)", sigX + SIG_PAD, sigY + SIG_H / 2)
      }

      let ty = blockTop + headerHeight
      for (const line of detailLines) {
        doc.text(line, TEXT_X, ty + 2.5)
        ty += LINE
      }

      y = blockTop + blockHeight
    }

    if (checkedNoSig.length) {
      const propText = formatPropertiesCompact(checkedNoSig)
      const lines = doc.splitTextToSize(`No signature on file: ${propText}`, CONTENT_WIDTH) as string[]
      ensureSpace(lines.length * LINE + BLOCK_GAP)
      doc.setFont("helvetica", "normal")
      doc.setFontSize(7)
      for (const line of lines) {
        doc.text(line, MARGIN, y)
        y += LINE
      }
      y += BLOCK_GAP
    }

    y += 1
  }

  return new Uint8Array(doc.output("arraybuffer"))
}

export function meetingSignatureListPdfFileName(meetingId: string, meetingYear?: number | string | null): string {
  const year = meetingYear != null ? String(meetingYear) : meetingId
  return `signature-list-meeting-${year}-${meetingId}.pdf`
}
