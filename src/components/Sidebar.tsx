'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { 
  LayoutDashboard, 
  Briefcase, 
  Eye, 
  Search, 
  Shield, 
  BookOpen,
  Settings,
  Activity
} from 'lucide-react'

const navigation = [
  { name: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
  { name: 'Portfolio', href: '/portfolio', icon: Briefcase },
  { name: 'Health', href: '/health', icon: Activity },
  { name: 'Watchlist', href: '/watchlist', icon: Eye },
  { name: 'Assessor', href: '/assessor', icon: Search },
  { name: 'Risk', href: '/risk', icon: Shield },
  { name: 'Research', href: '/research', icon: BookOpen },
  { name: 'Settings', href: '/settings', icon: Settings },
]

export default function Sidebar() {
  const pathname = usePathname()

  return (
    <aside className="w-64 bg-white border-r border-slate-200 min-h-screen p-4">
      {/* Logo */}
      <div className="mb-8">
        <h1 className="text-xl font-bold text-slate-900">Self Wealth</h1>
        <p className="text-xs text-slate-500">Tracker</p>
      </div>

      {/* Navigation */}
      <nav className="space-y-1">
        {navigation.map((item) => {
          const isActive = pathname === item.href || pathname?.startsWith(item.href + '/')
          return (
            <Link
              key={item.name}
              href={item.href}
              className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                isActive
                  ? 'bg-primary-50 text-primary-700'
                  : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
              }`}
            >
              <item.icon className={`w-5 h-5 ${isActive ? 'text-primary-600' : 'text-slate-400'}`} />
              {item.name}
            </Link>
          )
        })}
      </nav>
    </aside>
  )
}
