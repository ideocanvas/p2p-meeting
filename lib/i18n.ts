// Server-only i18n utilities
import 'server-only'

const dictionaries = {
  en: () => import('../locales/en/common.json').then((module) => module.default),
  zh: () => import('../locales/zh/common.json').then((module) => module.default),
}

export type Locale = keyof typeof dictionaries

export const getDictionary = async (locale: Locale) => {
  return dictionaries[locale]()
}

export const locales: Locale[] = ['en', 'zh']
export const defaultLocale: Locale = 'en'