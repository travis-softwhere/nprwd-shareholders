import { getShareholderDetails } from "@/actions/getShareholderDetails"
import Link from "next/link"
import { notFound } from "next/navigation"

export default async function ShareholderPage({ params }: { params: { id: string } }) {
    const shareholderId = params.id
    const { shareholder, properties } = await getShareholderDetails(shareholderId)

    if (!shareholder) {
        notFound()
    }

    return (
        <div className="p-6 max-w-4xl mx-auto">
            <Link href="/shareholders" className="text-blue-500 hover:underline mb-4 inline-block">
                &larr; Back to List
            </Link>
            <h1 className="text-2xl font-bold mb-4">{shareholder.name}</h1>
            <div className="grid grid-cols-2 gap-4 mb-6">
                <div>
                    <p>
                        <span className="font-semibold">Shareholder ID:</span> {shareholder.shareholderId}
                    </p>
                    <p>
                        <span className="font-semibold">Total Properties:</span> {properties.length}
                    </p>
                </div>
            </div>
            <h2 className="text-xl font-semibold mb-2">Properties:</h2>
            <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                        <tr>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                Account
                            </th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                Service Address
                            </th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                Resident Name
                            </th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                Checked In
                            </th>
                        </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                        {properties.map((property) => (
                            <tr key={property.id}>
                                <td className="px-6 py-4 whitespace-nowrap font-mono">{property.account}</td>
                                <td className="px-6 py-4 whitespace-nowrap">{property.serviceAddress}</td>
                                <td className="px-6 py-4 whitespace-nowrap">{property.residentName}</td>
                                <td className="px-6 py-4 whitespace-nowrap">
                                    {property.checkedIn ? (
                                        <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-green-100 text-green-800">
                                            Yes
                                        </span>
                                    ) : (
                                        <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-gray-100 text-gray-800">
                                            No
                                        </span>
                                    )}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    )
}