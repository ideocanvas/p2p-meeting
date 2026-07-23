import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

// Up to two uppercase initials from the first letters of each word.
export function getInitials(name: string): string {
  const parts = (name || "").trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return "?"
  const initials = parts.slice(0, 2).map(p => p[0]).join("")
  return initials.toUpperCase()
}

// Deterministic Tailwind gradient classes per name so each participant gets a
// visually distinct avatar color. Returns "from-... to-..." classes.
const AVATAR_GRADIENTS = [
  "from-blue-500 to-indigo-600",
  "from-emerald-500 to-teal-600",
  "from-rose-500 to-pink-600",
  "from-amber-500 to-orange-600",
  "from-violet-500 to-purple-600",
  "from-cyan-500 to-sky-600",
  "from-fuchsia-500 to-pink-600",
  "from-lime-500 to-green-600",
]

export function getAvatarColor(name: string): string {
  const key = (name || "").trim().toLowerCase() || "?"
  let hash = 0
  for (let i = 0; i < key.length; i++) {
    hash = (hash * 31 + key.charCodeAt(i)) >>> 0
  }
  return AVATAR_GRADIENTS[hash % AVATAR_GRADIENTS.length]
}