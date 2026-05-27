/**
 * Same pattern as CSV import (`/api/upload`): `${meetingId}-${numericSuffix}` keeps shareholder_id unique across meetings.
 */
export function makeMeetingScopedShareholderId(meetingId: string): string {
  const n = Math.floor(Math.random() * (999999 - 100000 + 1) + 100000);
  return `${meetingId}-${n}`;
}

/** True when the stored id is `{meetingId}-…` (app-generated or CSV upload for that meeting). */
export function isMeetingScopedShareholderId(
  shareholderId: string,
  meetingId: string,
): boolean {
  const id = shareholderId.trim();
  if (!id || !meetingId) return false;
  return id.startsWith(`${meetingId}-`);
}

/** Suffix after `{meetingId}-` when already scoped; otherwise the full stored id. */
function shareholderIdSuffix(storedId: string, meetingId: string): string {
  const id = storedId.trim();
  const prefix = `${meetingId}-`;
  if (id.startsWith(prefix)) {
    return id.slice(prefix.length);
  }
  const other = id.match(/^(\d+)-(.+)$/);
  if (other) {
    return other[2];
  }
  return id;
}

/**
 * Canonical barcode / DB id: `{meetingId}-{suffix}` for the owner’s meeting.
 * Use before insert and when fixing legacy rows.
 */
export function canonicalShareholderId(
  storedId: string,
  meetingId: string,
): string {
  const mid = String(meetingId).trim();
  const id = storedId?.trim() ?? "";
  if (!id || !mid) return id;
  if (isMeetingScopedShareholderId(id, mid)) {
    return id;
  }
  const suffix = shareholderIdSuffix(id, mid);
  return `${mid}-${suffix}`;
}

/** Stored id is not yet `{meetingId}-…` for this owner’s meeting. */
export function needsShareholderIdMeetingScope(
  storedId: string,
  meetingId: string,
): boolean {
  const id = storedId?.trim() ?? "";
  const mid = String(meetingId).trim();
  if (!id || !mid) return false;
  return !isMeetingScopedShareholderId(id, mid);
}

/**
 * Barcode / list UI: always `{meetingId}-{shareholderId}` when meeting is known.
 */
export function displayShareholderId(
  shareholderId: string,
  meetingId?: string | null,
): string {
  const id = shareholderId?.trim() ?? "";
  if (!id) return "—";
  if (!meetingId) return id;
  return canonicalShareholderId(id, meetingId);
}

/** Candidate stored ids to match a scanned or typed barcode for a meeting. */
export function shareholderIdLookupCandidates(
  barcodeOrId: string,
  meetingId?: string | null,
): string[] {
  const trimmed = barcodeOrId.trim();
  if (!trimmed) return [];
  const out = new Set<string>([trimmed]);
  if (!meetingId) return Array.from(out);
  const mid = String(meetingId).trim();
  out.add(canonicalShareholderId(trimmed, mid));
  if (trimmed.startsWith(`${mid}-`)) {
    out.add(trimmed.slice(mid.length + 1));
  }
  const scoped = trimmed.match(/^(\d+)-(.+)$/);
  if (scoped && scoped[1] === mid) {
    out.add(scoped[2]);
  }
  return Array.from(out);
}
