'use client'

import { usePathname, useRouter } from 'next/navigation'
import { useState } from 'react'
import { Globe } from 'lucide-react'

interface LanguageSwitcherProps {
  currentLocale: string
}

export function LanguageSwitcher({ currentLocale }: LanguageSwitcherProps) {
  const [isOpen, setIsOpen] = useState(false)
  const router = useRouter()
  const pathname = usePathname()

  const languages = [
    { code: 'en', name: 'English', nativeName: 'English' },
    { code: 'zh', name: 'Chinese', nativeName: '中文' }
  ]

  const switchLanguage = (locale: string) => {
    // Remove current locale from pathname and add new one
    const segments = pathname.split('/')
    const currentPath = segments.slice(2).join('/') || ''
    const newPath = `/${locale}/${currentPath}`
    router.push(newPath)
    setIsOpen(false)
  }

  const currentLanguage = languages.find(lang => lang.code === currentLocale) || languages[0]

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center space-x-2 px-3 py-2 text-sm text-gray-600 hover:text-gray-900 transition-colors rounded-lg hover:bg-gray-100"
      >
        <Globe className="w-4 h-4" />
        <span>{currentLanguage.nativeName}</span>
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-2 w-48 bg-white rounded-lg shadow-lg border border-gray-200 py-1 z-50">
          {languages.map((language) => (
            <button
              key={language.code}
              onClick={() => switchLanguage(language.code)}
              className={`w-full text-left px-4 py-2 text-sm hover:bg-gray-50 transition-colors ${
                currentLocale === language.code ? 'text-blue-600 font-medium' : 'text-gray-700'
              }`}
            >
              <div className="flex justify-between items-center">
                <span>{language.nativeName}</span>
                <span className="text-xs text-gray-500">{language.name}</span>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}