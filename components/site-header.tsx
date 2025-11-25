'use client'

import Link from 'next/link'
import { Video, LayoutDashboard, Plus, LogIn, Home } from 'lucide-react'
import { LanguageSwitcher } from '@/components/language-switcher'
import { Button } from '@/components/ui/button'
import { usePathname } from 'next/navigation'

export function SiteHeader({ lang }: { lang: string }) {
  const pathname = usePathname()
  
  const isActive = (path: string) => pathname?.endsWith(path)

  return (
    <header className="sticky top-0 z-50 w-full border-b border-white/20 bg-white/70 backdrop-blur-md supports-[backdrop-filter]:bg-white/60">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
        <div className="flex items-center gap-6">
          <Link href={`/${lang}`} className="flex items-center gap-2 transition-opacity hover:opacity-80">
            <div className="bg-gradient-to-br from-blue-600 to-indigo-600 p-2 rounded-lg text-white">
              <Video className="w-5 h-5" />
            </div>
            <span className="font-bold text-xl bg-clip-text text-transparent bg-gradient-to-r from-gray-900 to-gray-600">
              P2P Meeting
            </span>
          </Link>
          
          <nav className="hidden md:flex items-center gap-1">
            <Link href={`/${lang}`}>
              <Button variant={isActive(`/${lang}`) ? "secondary" : "ghost"} size="sm" className="gap-2">
                <Home className="w-4 h-4" />
                Home
              </Button>
            </Link>
            <Link href={`/${lang}/dashboard`}>
              <Button variant={isActive('/dashboard') ? "secondary" : "ghost"} size="sm" className="gap-2">
                <LayoutDashboard className="w-4 h-4" />
                Dashboard
              </Button>
            </Link>
          </nav>
        </div>

        <div className="flex items-center gap-3">
          <div className="hidden sm:flex gap-2 mr-2 border-r border-gray-200 pr-4">
             <Link href={`/${lang}/join`}>
              <Button variant="ghost" size="sm" className="gap-2">
                <LogIn className="w-4 h-4" />
                Join
              </Button>
            </Link>
             <Link href={`/${lang}/create`}>
              <Button size="sm" className="gap-2 bg-blue-600 hover:bg-blue-700 text-white shadow-md shadow-blue-500/20">
                <Plus className="w-4 h-4" />
                New Room
              </Button>
            </Link>
          </div>
          <LanguageSwitcher currentLocale={lang} />
        </div>
      </div>
    </header>
  )
}