import Sidebar from '@/components/Sidebar'

export default function AppLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="min-h-screen bg-slate-50">
      <Sidebar />
      {/* Main content area */}
      <main className="md:ml-56 pt-14 md:pt-0 min-h-screen">
        <div className="p-4 sm:p-6 max-w-7xl mx-auto">
          {children}
        </div>
      </main>
    </div>
  )
}
