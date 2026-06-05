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
  Calculator,
  Globe,
  Target,
  Activity,  
} from 'lucide-react'

import { useState, useEffect } from 'react'

const navigation = [
  // Core (Top Priority)
  { name: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
  { name: 'Portfolio', href: '/portfolio', icon: Briefcase },
  { name: 'CGT Tracker', href: '/cgt', icon: Calculator },
  { name: 'Activity', href: '/activity', icon: Activity },
  { name: 'Performance', href: '/performance', icon: TrendingUp },
  
  // Analysis & Tools
  { name: 'Watchlist', href: '/watchlist', icon: Eye },
  { name: 'AI Universe', href: '/universe', icon: Globe },
  { name: 'Search', href: '/search', icon: Search },
  { name: 'Momentum', href: '/momentum', icon: TrendingUp },
  
  // Simulators
  { name: 'Trade Simulator', href: '/trade-simulator', icon: Target },
  { name: 'CGT Simulator', href: '/cgt-simulator', icon: Calculator },
  
  // Research & Risk
  { name: 'Assessor', href: '/assessor', icon: Zap },
  { name: 'Journal', href: '/journal', icon: BookOpen },
  { name: 'Health', href: '/health', icon: Heart },
  { name: 'Risk', href: '/risk', icon: AlertTriangle },
  
  // Settings (one entry - costs is a sub-page)
  { name: 'Settings', href: '/settings/costs', icon: Settings },
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
      <div className="h-14 flex items-center justify-between px-4 border-b border-gray-800/50">
        <Link href="/dashboard" className="flex items-center gap-2">
          <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
            <span className="text-white font-bold text-sm">SW</span>
          </div>
          <span className="font-semibold text-white text-sm">Self Wealth</span>
        </Link>
        {/* Mobile close button */}
        <button 
          onClick={() => setMobileMenuOpen(false)}
          className="md:hidden p-1 text-gray-500 hover:text-gray-400"
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
                  ? 'bg-blue-500/100/15 text-blue-400'
                  : 'text-gray-400 hover:bg-white/5 hover:text-white'
              }`}
            >
              <item.icon className={`w-4 h-4 ${isActive ? 'text-blue-400' : 'text-gray-500'}`} />
              {item.name}
            </Link>
          )
        })}
      </nav>

      {/* User Menu */}
      <div className="p-3 border-t border-gray-800">
        <div className="relative">
          <button
            onClick={() => setShowUserMenu(!showUserMenu)}
            className="w-full flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-white/5 transition-colors"
          >
            <div className="w-7 h-7 bg-gray-700 rounded-full flex items-center justify-center">
              <User className="w-3.5 h-3.5 text-gray-400" />
            </div>
            <div className="flex-1 text-left min-w-0">
              <p className="text-xs font-medium text-white truncate">
                {userEmail || 'User'}
              </p>
            </div>
            <ChevronDown className={`w-4 h-4 text-gray-500 transition-transform ${showUserMenu ? 'rotate-180' : ''}`} />
          </button>

          {showUserMenu && (
            <>
              <div className="fixed inset-0 z-10" onClick={() => setShowUserMenu(false)} />
              <div className="absolute bottom-full left-0 right-0 mb-1 bg-[#1c1c28] rounded-lg shadow-lg border border-gray-800 py-1 z-20">
                <Link
                  href="/settings"
                  className="flex items-center gap-2 px-3 py-2 text-sm text-gray-300 hover:bg-white/5"
                  onClick={() => setShowUserMenu(false)}
                >
                  <Settings className="w-4 h-4" />
                  Settings
                </Link>
                <button
                  onClick={handleSignOut}
                  className="w-full flex items-center gap-2 px-3 py-2 text-sm text-red-400 hover:bg-red-500/100/10"
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
      <header className="md:hidden fixed top-0 left-0 right-0 z-40 bg-[#131722] border-b border-gray-800 h-14">
        <div className="flex items-center justify-between px-4 h-full">
          <button
            onClick={() => setMobileMenuOpen(true)}
            className="p-2 -ml-2 text-gray-400 hover:bg-white/10 rounded-lg"
          >
            <Menu className="w-5 h-5" />
          </button>
          <Link href="/dashboard" className="flex items-center gap-2">
            <div className="w-7 h-7 bg-blue-600 rounded-lg flex items-center justify-center">
              <span className="text-white font-bold text-xs">SW</span>
            </div>
            <span className="font-semibold text-white text-sm">Self Wealth</span>
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
      <aside className={`md:hidden fixed inset-y-0 left-0 z-50 w-64 bg-[#131722] transform transition-transform duration-200 ease-in-out ${
        mobileMenuOpen ? 'translate-x-0' : '-translate-x-full'
      }`}>
        <SidebarContent />
      </aside>

      {/* Desktop Sidebar */}
      <aside className="hidden md:block fixed left-0 top-0 z-40 h-screen w-56 bg-[#131722] border-r border-gray-800">
        <SidebarContent />
      </aside>
    </>
  )
}
