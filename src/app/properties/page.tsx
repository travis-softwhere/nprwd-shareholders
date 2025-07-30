import { PropertyManagement } from "@/components/PropertyManagement"

export default function PropertiesPage() {
  return (
    <div className="container mx-auto py-6">
      <div className="mb-6">
        <h1 className="text-3xl font-bold">Property Management</h1>
        <p className="text-muted-foreground">
          Manage properties, shareholders, and property transfers
        </p>
      </div>
      <PropertyManagement />
    </div>
  )
}
