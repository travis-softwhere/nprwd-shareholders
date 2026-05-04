import { buildBenefitUnitOwnerTemplateCsvHeaderLine } from "@/lib/benefitUnitOwnerCsvImport"

export const BENEFIT_UNIT_OWNER_CSV_TEMPLATE_FILENAME = "benefit-unit-owners-import-template.csv"

/** Downloads a UTF-8 CSV with header row only (Excel-friendly BOM). */
export function triggerBenefitUnitOwnerCsvTemplateDownload(): void {
    const line = buildBenefitUnitOwnerTemplateCsvHeaderLine()
    const bom = "\uFEFF"
    const blob = new Blob([bom + line], { type: "text/csv;charset=utf-8" })
    const url = URL.createObjectURL(blob)
    try {
        const a = document.createElement("a")
        a.href = url
        a.download = BENEFIT_UNIT_OWNER_CSV_TEMPLATE_FILENAME
        a.rel = "noopener"
        document.body.appendChild(a)
        a.click()
        document.body.removeChild(a)
    } finally {
        URL.revokeObjectURL(url)
    }
}
