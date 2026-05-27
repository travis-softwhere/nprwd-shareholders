import path from "path"

/**
 * Human-facing page number (1-based) **within the source invitation PDF** where the registration /
 * mailing block lives. Generation copies **only this page** per shareholder into mailer PDFs.
 */
export const MAILER_OVERLAY_PAGE_NUMBER = 1

/**
 * pdf-lib page index (0-based) into {@link MAILER_TEMPLATE_FILE_NAME} for the sheet that receives the
 * barcode + address overlay (`Production1.pdf` is a single-page ledger-landscape invitation).
 */
export const MAILER_OVERLAY_PAGE_INDEX = MAILER_OVERLAY_PAGE_NUMBER - 1

/** Generated mailer PDFs contain this many pages per benefit unit owner (overlay sheet only). */
export const MAILER_PAGES_PER_GENERATED_COPY = 1

/** Filename under `docs/` used for invitation mailers (change here when the annual PDF changes). */
export const MAILER_TEMPLATE_FILE_NAME = "Production1.pdf"

export function resolveMailerTemplatePath(): string {
    return path.join(process.cwd(), "docs", MAILER_TEMPLATE_FILE_NAME)
}
