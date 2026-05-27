/** Shape sent to PUT /api/properties/[id] (matches PropertyManagement). */
export function formatPropertyForApi(
  property: {
    id?: number
    account?: string | null
    shareholderId: string
    numOf?: string | null
    customerName?: string | null
    customerMailingAddress?: string | null
    cityStateZip?: string | null
    ownerName?: string | null
    ownerMailingAddress?: string | null
    ownerCityStateZip?: string | null
    residentName?: string | null
    residentMailingAddress?: string | null
    residentCityStateZip?: string | null
    serviceAddress?: string | null
    checkedIn?: boolean | null
  },
) {
  let formattedAccount = property.account || ""
  if (formattedAccount && !formattedAccount.includes("-")) {
    formattedAccount = formattedAccount.padStart(10, "0") + "-00"
  }

  return {
    account: formattedAccount,
    shareholderId: property.shareholderId,
    numOf: property.numOf?.trim() || "",
    customerName: property.customerName?.trim().toUpperCase() || "",
    customerMailingAddress: property.customerMailingAddress?.trim() || "",
    cityStateZip: property.cityStateZip?.trim() || "",
    ownerName: property.ownerName?.trim().toUpperCase() || "",
    ownerMailingAddress: property.ownerMailingAddress?.trim() || "",
    ownerCityStateZip: property.ownerCityStateZip?.trim() || "",
    residentName: property.residentName?.trim().toUpperCase() || "",
    residentMailingAddress: property.residentMailingAddress?.trim() || "",
    residentCityStateZip: property.residentCityStateZip?.trim() || "",
    serviceAddress: property.serviceAddress?.trim() || "",
    checkedIn: !!property.checkedIn,
    ...(property.id ? { id: property.id } : {}),
  }
}
