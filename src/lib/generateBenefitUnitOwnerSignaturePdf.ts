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
const SIG_W = 40
const SIG_H = 14
const SIG_COL_GAP = 4
const TEXT_X = MARGIN + SIG_W + SIG_COL_GAP
const TEXT_W = PAGE_WIDTH - TEXT_X - MARGIN
const LINE = 3.8
const BLOCK_GAP = 3
const OWNER_BLOCK_GAP = 4
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

function formatPropertyDetailLine(property: SignaturePdfProperty): string {
  const base = formatPropertyLine(property)
  const timeLabel = property.checkedInAt ? formatCheckInDateTime(property.checkedInAt) : ""
  return pdfAscii(timeLabel ? `${base} | ${timeLabel}` : base)
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

  let meetingTotalProperties = 0
  let meetingCheckedInProperties = 0
  for (const owner of input.owners) {
    for (const property of owner.properties) {
      meetingTotalProperties += 1
      if (property.checkedIn) meetingCheckedInProperties += 1
    }
  }

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

  const ownerAttendanceLine = pdfAscii(
    `Attendance: ${meetingCheckedInOwners} of ${meetingTotalOwners} benefit unit owners with at least one property checked in`,
  )
  for (const line of doc.splitTextToSize(ownerAttendanceLine, CONTENT_WIDTH) as string[]) {
    doc.text(line, MARGIN, y)
    y += LINE
  }

  const propertyAttendanceLine = pdfAscii(
    `Properties checked in: ${meetingCheckedInProperties} / ${meetingTotalProperties}`,
  )
  for (const line of doc.splitTextToSize(propertyAttendanceLine, CONTENT_WIDTH) as string[]) {
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

    const drawOwnerHeader = () => {
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
      y += OWNER_BLOCK_GAP
    }

    const drawSignatureWithProperties = (
      signatureImage: string | null,
      properties: SignaturePdfProperty[],
      label?: string,
    ) => {
      const checkedProps = properties
        .filter((p) => Boolean(p.checkedIn))
        .sort((a, b) =>
          (a.account ?? "").localeCompare(b.account ?? "", undefined, { numeric: true }),
        )
      if (!checkedProps.length) return

      const textX = signatureImage ? TEXT_X : MARGIN
      const textW = signatureImage ? TEXT_W : CONTENT_WIDTH

      const labelLines = label
        ? (doc.splitTextToSize(pdfAscii(label), textW) as string[])
        : []
      const propertyLineSets = checkedProps.map((property) => {
        const line = formatPropertyDetailLine(property)
        return doc.splitTextToSize(line, textW) as string[]
      })
      const propertyLineCount = propertyLineSets.reduce((sum, lines) => sum + lines.length, 0)
      const textBlockHeight =
        labelLines.length * LINE + Math.max(LINE, propertyLineCount * LINE)
      const sigBlockHeight = signatureImage ? Math.max(SIG_H, textBlockHeight) : 0
      const blockHeight = Math.max(sigBlockHeight, textBlockHeight) + BLOCK_GAP

      ensureSpace(blockHeight)

      const sigY = y

      if (signatureImage) {
        drawSignatureFrame(doc, MARGIN, sigY, SIG_W, sigBlockHeight)
        try {
          const innerW = SIG_W - SIG_PAD * 2
          const innerH = sigBlockHeight - SIG_PAD * 2
          doc.addImage(
            signatureImage,
            signatureImageFormat(signatureImage),
            MARGIN + SIG_PAD,
            sigY + SIG_PAD,
            innerW,
            innerH,
          )
        } catch {
          doc.setFontSize(7)
          doc.text("(signature)", MARGIN + SIG_PAD, sigY + sigBlockHeight / 2)
        }
      }

      doc.setFont("helvetica", "normal")
      doc.setFontSize(7)
      let textY = sigY + LINE * 0.85

      if (labelLines.length) {
        doc.setFont("helvetica", "italic")
        for (const line of labelLines) {
          doc.text(line, textX, textY)
          textY += LINE
        }
        doc.setFont("helvetica", "normal")
      }

      for (const lines of propertyLineSets) {
        for (const line of lines) {
          doc.text(line, textX, textY)
          textY += LINE
        }
      }

      y += blockHeight
    }

    const ownerHeaderHeight =
      headerLines.length * LINE +
      mailingLines.length * LINE +
      (designeeLine ? LINE : 0) +
      OWNER_BLOCK_GAP

    ensureSpace(ownerHeaderHeight + SIG_H)
    drawOwnerHeader()

    let drewSignatureBlock = false
    for (const group of signatureGroups) {
      drawSignatureWithProperties(group.signatureImage, group.properties)
      drewSignatureBlock = true
    }

    if (checkedNoSig.length) {
      drawSignatureWithProperties(
        null,
        checkedNoSig,
        "Checked in — no signature on file",
      )
      drewSignatureBlock = true
    }

    if (!drewSignatureBlock) {
      doc.setFont("helvetica", "normal")
      doc.setFontSize(7)
      doc.text(pdfAscii("Checked in — no signature on file"), MARGIN, y)
      y += LINE
    }

    y += 1
  }

  return new Uint8Array(doc.output("arraybuffer"))
}

export function meetingSignatureListPdfFileName(meetingId: string, meetingYear?: number | string | null): string {
  const year = meetingYear != null ? String(meetingYear) : meetingId
  return `signature-list-meeting-${year}-${meetingId}.pdf`
}
