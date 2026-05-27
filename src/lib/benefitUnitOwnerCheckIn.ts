/** Minimal shareholder row fields for check-in UI / API decisions. */
export type CheckInShareholderSnapshot = {
    checkedIn?: boolean | null
    signatureImage?: string | null
    signatureHash?: string | null
}

export type CheckInPropertySnapshot = {
    checkedIn?: boolean | null
}

/** True when the owner has a stored signature on file. */
export function benefitUnitOwnerHasSignature(shareholder: CheckInShareholderSnapshot): boolean {
    return Boolean(shareholder.signatureImage?.trim() && shareholder.signatureHash?.trim())
}

/** Checked in on the shareholder row and/or every property row. */
export function benefitUnitOwnerIsCheckedIn(
    shareholder: CheckInShareholderSnapshot,
    properties: CheckInPropertySnapshot[],
): boolean {
    if (shareholder.checkedIn) return true
    if (properties.length === 0) return false
    return properties.every((p) => Boolean(p.checkedIn))
}

/**
 * Completed check-in: checked in (shareholder or all properties) and signature captured.
 * Dashboard should skip the pad and go straight to the shareholder detail page.
 */
export function benefitUnitOwnerHasCompletedCheckIn(
    shareholder: CheckInShareholderSnapshot,
    properties: CheckInPropertySnapshot[],
): boolean {
    return benefitUnitOwnerIsCheckedIn(shareholder, properties) && benefitUnitOwnerHasSignature(shareholder)
}
