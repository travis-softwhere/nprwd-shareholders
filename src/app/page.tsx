import Dashboard from "@/components/Dashboard"

export default async function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center p-8">
      <div className="w-full max-w-7xl">
        <Dashboard />
      </div>
    </main>
  )
}

