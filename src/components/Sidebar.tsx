'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { createClient } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import {
  LayoutDashboard,
  Briefcase,
  Heart,
  Eye,
  Search,
  AlertTriangle,
  TrendingUp,
  BookOpen,
  Settings,
  LogOut,
  ChevronDown,
  User,
  Zap,
  Menu,
  X,
} from 'lucide-react'
import { useState, useEffect } from 'react'

const navigation = [
  { name: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
  { name: 'Portfolio', href: '/portfolio', icon: Briefcase },
  { name: 'Search', href: '/search', icon: Search },
  { name: 'Momentum', href: '/momentum', icon: TrendingUp },
  { name: 'Assessor', href: '/assessor', icon: Zap },
  { name: 'Journal', href: '/journal', icon: BookOpen },
  { name: 'Watchlist', href: '/watchlist', icon: Eye },
  { name: 'Health', href: '/health', icon: Heart },
  { name: 'Risk', href: '/risk', icon: AlertTriangle },
  { name: 'Settings', href: '/settings', icon: Settings },
]

export default function Sidebar() {
  const pathname = usePathname()
  const router = useRouter()
  const [showUserMenu, setShowUserMenu] = useState(false)
  const [userEmail, setUserEmail] = useState<string | null>(null)
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

  useEffect(() => {
    const getUser = async () => {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (user) setUserEmail(user.email || null)
    }
    getUser()
  }, [])

  // Close mobile menu on route change
  useEffect(() => {
    setMobileMenuOpen(false)
  }, [pathname])

  const handleSignOut = async () => {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/login')
  }

  const SidebarContent = () => (
    <div className="flex flex-col h-full">
      {/* Logo */}
      <div className="h-14 flex items-center justify-between px-4 border-b border-slate-200">
        <Link href="/dashboard" className="flex items-center gap-2">
          <div className="w-8 h-8 bg-primary-600 rounded-lg flex items-center justify-center">
            <span className="text-white font-bold text-sm">SW</span>
          </div>
          <span className="font-semibold text-slate-900 text-sm">Self Wealth</span>
        </Link>
        {/* Mobile close button */}
        <button 
          onClick={() => setMobileMenuOpen(false)}
          className="md:hidden p-1 text-slate-400 hover:text-slate-600"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 py-3 space-y-0.5 overflow-y-auto">
        {navigation.map((item) => {
          const isActive = pathname === item.href
          return (
            <Link
              key={item.name}
              href={item.href}
              className={`flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                isActive
                  ? 'bg-primary-50 text-primary-700'
                  : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
              }`}
            >
              <item.icon className={`w-4 h-4 ${isActive ? 'text-primary-600' : 'text-slate-400'}`} />
              {item.name}
            </Link>
          )
        })}
      </nav>

      {/* User Menu */}
      <div className="p-3 border-t border-slate-200">
        <div className="relative">
          <button
            onClick={() => setShowUserMenu(!showUserMenu)}
            className="w-full flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-slate-50 transition-colors"
          >
            <div className="w-7 h-7 bg-slate-200 rounded-full flex items-center justify-center">
              <User className="w-3.5 h-3.5 text-slate-600" />
            </div>
            <div className="flex-1 text-left min-w-0">
              <p className="text-xs font-medium text-slate-900 truncate">
                {userEmail || 'User'}
              </p>
            </div>
            <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform ${showUserMenu ? 'rotate-180' : ''}`} />
          </button>

          {showUserMenu && (
            <>
              <div className="fixed inset-0 z-10" onClick={() => setShowUserMenu(false)} />
              <div className="absolute bottom-full left-0 right-0 mb-1 bg-white rounded-lg shadow-lg border border-slate-200 py-1 z-20">
                <Link
                  href="/settings"
                  className="flex items-center gap-2 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50"
                  onClick={() => setShowUserMenu(false)}
                >
                  <Settings className="w-4 h-4" />
                  Settings
                </Link>
                <button
                  onClick={handleSignOut}
                  className="w-full flex items-center gap-2 px-3 py-2 text-sm text-red-600 hover:bg-red-50"
                >
                  <LogOut className="w-4 h-4" />
                  Sign Out
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )

  return (
    <>
      {/* Mobile Header */}
      <header className="md:hidden fixed top-0 left-0 right-0 z-40 bg-white border-b border-slate-200 h-14">
        <div className="flex items-center justify-between px-4 h-full">
          <button
            onClick={() => setMobileMenuOpen(true)}
            className="p-2 -ml-2 text-slate-600 hover:bg-slate-100 rounded-lg"
          >
            <Menu className="w-5 h-5" />
          </button>
          <Link href="/dashboard" className="flex items-center gap-2">
            <div className="w-7 h-7 bg-primary-600 rounded-lg flex items-center justify-center">
              <span className="text-white font-bold text-xs">SW</span>
            </div>
            <span className="font-semibold text-slate-900 text-sm">Self Wealth</span>
          </Link>
          <div className="w-9" /> {/* Spacer for centering */}
        </div>
      </header>

      {/* Mobile Sidebar Overlay */}
      {mobileMenuOpen && (
        <div 
          className="md:hidden fixed inset-0 z-40 bg-black/50"
          onClick={() => setMobileMenuOpen(false)}
        />
      )}

      {/* Mobile Sidebar */}
      <aside className={`md:hidden fixed inset-y-0 left-0 z-50 w-64 bg-white transform transition-transform duration-200 ease-in-out ${
        mobileMenuOpen ? 'translate-x-0' : '-translate-x-full'
      }`}>
        <SidebarContent />
      </aside>

      {/* Desktop Sidebar */}
      <aside className="hidden md:block fixed left-0 top-0 z-40 h-screen w-56 bg-white border-r border-slate-200">
        <SidebarContent />
      </aside>
    </>
  )
}
