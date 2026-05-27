/** Reference max PDF size for estimates (~32 MiB); legacy disk UI only. */
export const MAILER_MAX_BATCH_BYTES_DEFAULT = 32 * 1024 * 1024

/**
 * Target maximum serialized size per `mailers-NNN.pdf` output file (~2.5 GiB) so files stay under common
 * 3 GiB tool/upload limits. Actual page count per file is derived from measured bytes per mailer page.
 */
export const MAILER_PDF_MAX_BATCH_BYTES = Math.floor(2.5 * 1024 * 1024 * 1024)

/** Applied to raw estimated mailer output bytes when comparing to free disk space (filesystem overhead). */
export const MAILER_DISK_ESTIMATE_MARGIN = 1.1

/** Kept for any legacy imports. */
export const MAILER_MIN_SHAREHOLDERS_PER_BATCH = 5

/** Kept for any legacy imports. */
export const MAILER_BATCH_SHAREHOLDER_FALLBACK = 12

/** Kept for any legacy imports. */
export const MAILER_BATCH_SIZE = 50
