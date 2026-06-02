/** Build Properties page URL — search by service address (primary), optional highlight by id. */
export function propertyManagementHref(
  property: { id: number; serviceAddress?: string | null; account?: string | null },
): string {
  const serviceAddress = property.serviceAddress?.trim()
  const params = new URLSearchParams()

  if (serviceAddress) {
    params.set("search", serviceAddress)
  } else if (property.account?.trim()) {
    params.set("search", property.account.trim())
  }

  params.set("propertyId", String(property.id))

  return `/properties?${params.toString()}`
}
