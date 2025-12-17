'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase'
import { User, LogOut, Settings, ChevronDown } from 'lucide-react'
import type { User as UserType } from '@/types/database'

interface HeaderProps {
  user: UserType | null
  email: string
}

export default function Header({ user, email }: HeaderProps) {
  const router = useRouter()
  const [showMenu, setShowMenu] = useState(false)

  const handleLogout = async () => {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/login')
    router.refresh()
  }

  const displayName = user?.display_name || email.split('@')[0]

  return (
    <header className="bg-white border-b border-slate-200 px-6 py-4">
      <div className="flex items-center justify-between">
        {/* Page title - will be dynamic later */}
        <div>
          <h2 className="text-xl font-semibold text-slate-900">
            {/* This can be made dynamic with context */}
          </h2>
        </div>

        {/* User menu */}
        <div className="relative">
          <button
            onClick={() => setShowMenu(!showMenu)}
            className="flex items-center gap-3 hover:bg-slate-50 rounded-lg px-3 py-2 transition-colors"
          >
            <div className="w-8 h-8 bg-primary-100 rounded-full flex items-center justify-center">
              <User className="w-4 h-4 text-primary-600" />
            </div>
            <span className="text-sm font-medium text-slate-700">
              {displayName}
            </span>
            <ChevronDown className="w-4 h-4 text-slate-400" />
          </button>

          {/* Dropdown menu */}
          {showMenu && (
            <>
              {/* Backdrop */}
              <div 
                className="fixed inset-0 z-10" 
                onClick={() => setShowMenu(false)}
              />
              
              {/* Menu */}
              <div className="absolute right-0 mt-2 w-48 bg-white rounded-lg shadow-lg border border-slate-200 py-1 z-20">
                <div className="px-4 py-2 border-b border-slate-100">
                  <p className="text-sm font-medium text-slate-900">{displayName}</p>
                  <p className="text-xs text-slate-500 truncate">{email}</p>
                </div>
                
                <button
                  onClick={() => {
                    setShowMenu(false)
                    router.push('/settings')
                  }}
                  className="w-full flex items-center gap-2 px-4 py-2 text-sm text-slate-700 hover:bg-slate-50"
                >
                  <Settings className="w-4 h-4" />
                  Settings
                </button>
                
                <button
                  onClick={handleLogout}
                  className="w-full flex items-center gap-2 px-4 py-2 text-sm text-red-600 hover:bg-red-50"
                >
                  <LogOut className="w-4 h-4" />
                  Sign out
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </header>
  )
}
