export default function AuthLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Logo/Branding */}
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-white mb-2">
            Self Wealth Tracker
          </h1>
          <p className="text-slate-400">
            Invest with clarity. Own your decisions.
          </p>
        </div>
        
        {/* Auth Card */}
        <div className="bg-white rounded-2xl shadow-xl p-8">
          {children}
        </div>
        
        {/* Footer */}
        <p className="text-center text-slate-500 text-sm mt-6">
          Buffett-style investing for the modern investor
        </p>
      </div>
    </div>
  )
}
