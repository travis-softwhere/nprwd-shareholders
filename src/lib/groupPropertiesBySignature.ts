export type PropertyWithSignatureFields = {
  id: number
  account?: string | null
  serviceAddress?: string | null
  checkedIn?: boolean | null
  signatureHash?: string | null
  signatureImage?: string | null
  checkedInAt?: Date | string | null
}

export type PropertySignatureGroup = {
  signatureHash: string
  signatureImage: string
  checkedInAt: Date | string | null
  properties: PropertyWithSignatureFields[]
}

/** Group checked-in properties that share the same signature hash. */
export function groupPropertiesBySignature(
  properties: PropertyWithSignatureFields[],
): PropertySignatureGroup[] {
  const byHash = new Map<string, PropertyWithSignatureFields[]>()

  for (const property of properties) {
    if (!property.checkedIn) continue
    const hash = property.signatureHash?.trim()
    const image = property.signatureImage?.trim()
    if (!hash || !image) continue

    const list = byHash.get(hash) ?? []
    list.push(property)
    byHash.set(hash, list)
  }

  return Array.from(byHash.entries())
    .map(([signatureHash, grouped]) => ({
      signatureHash,
      signatureImage: grouped[0].signatureImage!.trim(),
      checkedInAt:
        grouped.reduce<Date | string | null>((earliest, property) => {
          const at = property.checkedInAt ?? null
          if (!at) return earliest
          if (!earliest) return at
          return new Date(at).getTime() < new Date(earliest).getTime() ? at : earliest
        }, null),
      properties: grouped.sort((a, b) =>
        (a.account ?? "").localeCompare(b.account ?? "", undefined, { numeric: true }),
      ),
    }))
    .sort((a, b) => {
      const aTime = a.checkedInAt ? new Date(a.checkedInAt).getTime() : 0
      const bTime = b.checkedInAt ? new Date(b.checkedInAt).getTime() : 0
      return aTime - bTime
    })
}

/** Order properties for display: signature groups together, then unchecked. */
export function orderPropertiesForSignatureDisplay(
  properties: PropertyWithSignatureFields[],
): PropertyWithSignatureFields[] {
  const groups = groupPropertiesBySignature(properties)
  const groupedIds = new Set(groups.flatMap((g) => g.properties.map((p) => p.id)))
  const unchecked = properties
    .filter((p) => !groupedIds.has(p.id))
    .sort((a, b) =>
      (a.account ?? "").localeCompare(b.account ?? "", undefined, { numeric: true }),
    )

  return [...groups.flatMap((g) => g.properties), ...unchecked]
}

export function signatureRowSpanForProperty(
  property: PropertyWithSignatureFields,
  ordered: PropertyWithSignatureFields[],
): { showSignature: boolean; rowSpan: number } {
  const hash = property.signatureHash?.trim()
  if (!property.checkedIn || !hash || !property.signatureImage?.trim()) {
    return { showSignature: false, rowSpan: 1 }
  }

  const index = ordered.findIndex((p) => p.id === property.id)
  if (index === -1) return { showSignature: false, rowSpan: 1 }

  const prev = ordered[index - 1]
  if (prev?.signatureHash?.trim() === hash) {
    return { showSignature: false, rowSpan: 0 }
  }

  let rowSpan = 1
  for (let i = index + 1; i < ordered.length; i++) {
    if (ordered[i].signatureHash?.trim() === hash) rowSpan++
    else break
  }

  return { showSignature: true, rowSpan }
}
