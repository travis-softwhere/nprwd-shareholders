import { getShareholderProperties } from "../../../utils/csvParser"
import Link from "next/link"

export default async function ShareholderPage({ params }: { params: Promise<{ id: string }> }) {
    const resolvedParams = await params
    const shareholderId = resolvedParams.id
    const properties = await getShareholderProperties(shareholderId)

    if (!properties || properties.length === 0) {
        return <p>Shareholder not found</p>
    }

    const shareholder = properties[0] // Assuming the first property has all the shareholder info

    return (
        <div className="p-6 max-w-4xl mx-auto">
            <Link href="/" className="text-blue-500 hover:underline mb-4 inline-block">
                &larr; Back to List
            </Link>
            <h1 className="text-2xl font-bold mb-4">{shareholder.ownerName}</h1>
            <div className="grid grid-cols-2 gap-4 mb-6">
                <div>
                    <p>
                        <span className="font-semibold">Account:</span> {shareholder.account}
                    </p>
                    <p>
                        <span className="font-semibold">Customer Name:</span> {shareholder.customerName}
                    </p>
                    <p>
                        <span className="font-semibold">Total Properties:</span> {shareholder.numOf}
                    </p>
                </div>
                <div>
                    <p>
                        <span className="font-semibold">Mailing Address:</span> {shareholder.ownerMailingAddress}
                    </p>
                    <p>
                        <span className="font-semibold">City/State/Zip:</span> {shareholder.ownerCityStateZip}
                    </p>
                </div>
            </div>
            <h2 className="text-xl font-semibold mb-2">Properties:</h2>
            <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                        <tr>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                Service Address
                            </th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                Resident Name
                            </th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                Resident Address
                            </th>
                        </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                        {properties.map((property, index) => (
                            <tr key={index}>
                                <td className="px-6 py-4 whitespace-nowrap">{property.serviceAddress}</td>
                                <td className="px-6 py-4 whitespace-nowrap">{property.residentName}</td>
                                <td className="px-6 py-4 whitespace-nowrap">
                                    {property.residentMailingAddress}, {property.residentCityStateZip}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    )
}