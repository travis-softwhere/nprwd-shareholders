import { parse } from "csv-parse/sync"
import { normalizeBenefitUnitOwnerColumnName } from "@/lib/benefitUnitOwnerCsvImport"

export type BenefitUnitOwnerCsvValidateResult =
    | {
          ok: true
          /** Rows after removing blank lines (matches server import filter). */
          filteredRowCount: number
          rawRowCount: number
      }
    | {
          ok: false
          error: string
          filteredRowCount: number
          rawRowCount: number
      }

function validateParsedRecords(records: Record<string, unknown>[]): BenefitUnitOwnerCsvValidateResult {
    const filtered = records.filter((record) =>
        Object.values(record).some((value) => typeof value === "string" && value.trim() !== ""),
    )

    if (filtered.length === 0) {
        return {
            ok: false,
            error: "No data rows found. Add at least one row with values, or remove blank lines.",
            filteredRowCount: 0,
            rawRowCount: records.length,
        }
    }

    const missingAccountRows = filtered.filter((row) => !String(row["account"] ?? "").trim()).length
    if (missingAccountRows > 0) {
        return {
            ok: false,
            error: `${missingAccountRows} row(s) are missing a non-empty "account" value. Each row must include an account (map your column to "account" or use the template header).`,
            filteredRowCount: filtered.length,
            rawRowCount: records.length,
        }
    }

    return {
        ok: true,
        filteredRowCount: filtered.length,
        rawRowCount: records.length,
    }
}

/** Parse and validate CSV text the same way the import pipeline expects (header normalization + row filter). */
export function validateBenefitUnitOwnerCsvContent(content: string): BenefitUnitOwnerCsvValidateResult {
    const stripped = content.replace(/^\uFEFF/, "")

    let records: Record<string, unknown>[]
    try {
        records = parse(stripped, {
            columns: (headers: string[]) => headers.map((h) => normalizeBenefitUnitOwnerColumnName(h)),
            skip_empty_lines: true,
            trim: true,
        }) as Record<string, unknown>[]
    } catch (e) {
        return {
            ok: false,
            error: `Could not parse CSV: ${e instanceof Error ? e.message : String(e)}`,
            filteredRowCount: 0,
            rawRowCount: 0,
        }
    }

    return validateParsedRecords(records)
}

export async function validateBenefitUnitOwnerCsvFile(file: File): Promise<BenefitUnitOwnerCsvValidateResult> {
    const text = await file.text()
    return validateBenefitUnitOwnerCsvContent(text)
}
