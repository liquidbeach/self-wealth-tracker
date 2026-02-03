'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { createClient } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import {
  LayoutDashboard,
  Briefcase,
  Activity,
  Eye,
  Shield,
  Search,
  TrendingUp,
  Settings,
  LogOut,
} from 'lucide-react'

const navItems = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/portfolio', label: 'Portfolio', icon: Briefcase },
  { href: '/health', label: 'Health', icon: Activity },
  { href: '/watchlist', label: 'Watchlist', icon: Eye },
  { href: '/assessor', label: 'Assessor', icon: Search },
  { href: '/risk', label: 'Risk', icon: Shield },
  { href: '/momentum', label: 'Momentum', icon: TrendingUp },
  { href: '/settings', label: 'Settings', icon: Settings },
]

export default function Sidebar() {
  const pathname = usePathname()
  const router = useRouter()

  const handleLogout = async () => {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/login')
  }

  return (
    <aside className="w-64 bg-white border-r border-slate-200 min-h-screen flex flex-col">
      {/* Logo */}
      <div className="p-6 border-b border-slate-200">
        <h1 className="text-xl font-bold text-slate-900">Self Wealth</h1>
        <p className="text-xs text-slate-500">Tracker</p>
      </div>

      {/* Navigation */}
      <nav className="flex-1 p-4">
        <ul className="space-y-1">
          {navItems.map((item) => {
            const isActive = pathname === item.href
            const Icon = item.icon
            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                    isActive
                      ? 'bg-primary-50 text-primary-700'
                      : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                  }`}
                >
                  <Icon className="w-5 h-5" />
                  {item.label}
                  {item.label === 'Momentum' && (
                    <span className="ml-auto text-xs bg-green-100 text-green-700 px-1.5 py-0.5 rounded">
                      NEW
                    </span>
                  )}
                </Link>
              </li>
            )
          })}
        </ul>
      </nav>

      {/* Logout */}
      <div className="p-4 border-t border-slate-200">
        <button
          onClick={handleLogout}
          className="flex items-center gap-3 px-3 py-2 w-full rounded-lg text-sm font-medium text-slate-600 hover:bg-slate-50 hover:text-slate-900 transition-colors"
        >
          <LogOut className="w-5 h-5" />
          Sign Out
        </button>
      </div>
    </aside>
  )
}
