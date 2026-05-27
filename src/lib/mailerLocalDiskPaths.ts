import path from "path"

/** On-disk mailer output for local dev (not committed): `mailers/{meetingId}/mailers-001.pdf`, … */
export function resolveLocalMailersMeetingDir(meetingId: string): string {
    const safe = meetingId.trim()
    return path.resolve(path.join(process.cwd(), "mailers", safe))
}
