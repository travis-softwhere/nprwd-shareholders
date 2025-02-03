import { getShareholderIds, getShareholderProperties, type Property } from "../../utils/csvParser"

export default async function PrintMailersPage() {
    const shareholderIds = await getShareholderIds()
    const shareholderProperties: Property[][] = await Promise.all(
        shareholderIds.map((id: string) => getShareholderProperties(id)),
    )

    return (
        <div className="container mx-auto p-4">
            <h1 className="text-2xl font-bold mb-4">Print Mailers</h1>
            <ul className="space-y-2">
                {shareholderIds.map((id: string, index: number) => (
                    <li key={id} className="border p-2 rounded">
                        <strong>Account: {id}</strong>
                        {shareholderProperties[index] && shareholderProperties[index].length > 0 && (
                            <span className="ml-2">- Owner: {shareholderProperties[index][0].ownerName}</span>
                        )}
                    </li>
                ))}
            </ul>
            {shareholderProperties.length > 0 && (
                <div className="mt-8">
                    <h2 className="text-xl font-semibold mb-2">Detailed Properties:</h2>
                    <pre className="bg-gray-100 p-4 rounded overflow-x-auto">
                        {JSON.stringify(shareholderProperties, null, 2)}
                    </pre>
                </div>
            )}
        </div>
    )
}