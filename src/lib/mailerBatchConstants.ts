/** Shared mailer batch naming — safe to import from client or server (no Node APIs). */

/** Output filename for batch part index (1-based), e.g. mailers-001.pdf … mailers-042.pdf */
export function mailerBatchPdfFileName(partIndex1Based: number): string {
    return `mailers-${String(partIndex1Based).padStart(3, "0")}.pdf`
}
