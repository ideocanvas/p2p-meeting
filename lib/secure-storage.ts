// Secure storage helper with encryption for passwords
import { LocalRoomData } from './types'

// Storage keys
const ROOMS_KEY = 'meeting_rooms'

// Get encryption key from environment or generate one
const getBaseEncryptionKey = (): string => {
  // In production, this should be replaced with a proper environment variable
  // For now, using a hardcoded key for simplicity
  // TODO: Replace with process.env.NEXT_PUBLIC_ENCRYPTION_KEY in production
  return 'meeting-app-secure-key-2024-default'
}

// Simple encryption using XOR with a key
class SecureStorage {
  private encryptionKey: string | null = null

  // Check if we're in a browser environment
  private isBrowser(): boolean {
    return typeof window !== 'undefined' && typeof window.localStorage !== 'undefined'
  }

  // Get encryption key
  private getEncryptionKey(): string {
    if (this.encryptionKey) {
      return this.encryptionKey
    }

    // Use base key from environment
    const baseKey = getBaseEncryptionKey()
    
    // Add some randomness by creating a user-specific key
    if (this.isBrowser()) {
      let userKey = window.localStorage.getItem('user_encryption_key')
      if (!userKey) {
        // Generate user-specific key
        const array = new Uint8Array(16)
        window.crypto.getRandomValues(array)
        userKey = Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('')
        window.localStorage.setItem('user_encryption_key', userKey)
      }
      this.encryptionKey = baseKey + userKey
    } else {
      this.encryptionKey = baseKey
    }
    
    return this.encryptionKey
  }

  // Simple XOR encryption
  private encrypt(text: string): string {
    const key = this.getEncryptionKey()
    let result = ''
    for (let i = 0; i < text.length; i++) {
      result += String.fromCharCode(
        text.charCodeAt(i) ^ key.charCodeAt(i % key.length)
      )
    }
    // Convert to base64 for safe storage
    return btoa(result)
  }

  // Simple XOR decryption
  private decrypt(encryptedText: string): string {
    const key = this.getEncryptionKey()
    // Convert from base64
    const text = atob(encryptedText)
    let result = ''
    for (let i = 0; i < text.length; i++) {
      result += String.fromCharCode(
        text.charCodeAt(i) ^ key.charCodeAt(i % key.length)
      )
    }
    return result
  }

  // Get all rooms from localStorage
  async getRooms(): Promise<LocalRoomData[]> {
    if (!this.isBrowser()) return []
    
    try {
      const encryptedData = window.localStorage.getItem(ROOMS_KEY)
      if (!encryptedData) return []
      
      const decryptedData = this.decrypt(encryptedData)
      return JSON.parse(decryptedData) as LocalRoomData[]
    } catch (error) {
      console.error('Error reading rooms from secure storage:', error)
      return []
    }
  }

  // Save a room to localStorage
  async saveRoom(roomData: LocalRoomData): Promise<void> {
    if (!this.isBrowser()) return
    
    try {
      const rooms = await this.getRooms()
      const existingIndex = rooms.findIndex(r => r.roomId === roomData.roomId)
      
      if (existingIndex >= 0) {
        // Update existing room
        rooms[existingIndex] = {
          ...rooms[existingIndex],
          ...roomData,
          lastAccessed: Date.now()
        }
      } else {
        // Add new room
        rooms.push({
          ...roomData,
          lastAccessed: Date.now()
        })
      }
      
      const encryptedData = this.encrypt(JSON.stringify(rooms))
      window.localStorage.setItem(ROOMS_KEY, encryptedData)
    } catch (error) {
      console.error('Error saving room to secure storage:', error)
    }
  }

  // Store password securely for a room
  async storePassword(roomId: string, password: string): Promise<void> {
    if (!this.isBrowser()) return
    
    try {
      const encryptedPassword = this.encrypt(password)
      window.localStorage.setItem(`room_password_${roomId}`, encryptedPassword)
    } catch (error) {
      console.error('Error storing password securely:', error)
    }
  }

  // Get password securely for a room
  async getPassword(roomId: string): Promise<string | null> {
    if (!this.isBrowser()) return null
    
    try {
      const encryptedPassword = window.localStorage.getItem(`room_password_${roomId}`)
      if (!encryptedPassword) return null
      
      return this.decrypt(encryptedPassword)
    } catch (error) {
      console.error('Error getting password securely:', error)
      return null
    }
  }

  // Remove password for a room
  removePassword(roomId: string): void {
    if (!this.isBrowser()) return
    
    try {
      window.localStorage.removeItem(`room_password_${roomId}`)
    } catch (error) {
      console.error('Error removing password:', error)
    }
  }

  // Remove a room from localStorage
  async removeRoom(roomId: string): Promise<void> {
    if (!this.isBrowser()) return
    
    try {
      const rooms = await this.getRooms()
      const filteredRooms = rooms.filter(r => r.roomId !== roomId)
      const encryptedData = this.encrypt(JSON.stringify(filteredRooms))
      window.localStorage.setItem(ROOMS_KEY, encryptedData)
      
      // Also remove the password
      this.removePassword(roomId)
    } catch (error) {
      console.error('Error removing room from secure storage:', error)
    }
  }

  // Check if user has access to a room (has stored password)
  async hasRoomAccess(roomId: string): Promise<boolean> {
    const password = await this.getPassword(roomId)
    return password !== null
  }

  // Store user's name in localStorage
  async storeUserName(name: string): Promise<void> {
    if (!this.isBrowser()) return
    
    try {
      const encryptedName = this.encrypt(name)
      window.localStorage.setItem('user_name', encryptedName)
    } catch (error) {
      console.error('Error storing user name:', error)
    }
  }

  // Get user's name from localStorage
  async getUserName(): Promise<string | null> {
    if (!this.isBrowser()) return null
    
    try {
      const encryptedName = window.localStorage.getItem('user_name')
      if (!encryptedName) return null
      
      return this.decrypt(encryptedName)
    } catch (error) {
      console.error('Error getting user name:', error)
      return null
    }
  }

  // Remove user's name from localStorage
  removeUserName(): void {
    if (!this.isBrowser()) return
    
    try {
      window.localStorage.removeItem('user_name')
    } catch (error) {
      console.error('Error removing user name:', error)
    }
  }
}

export const secureStorage = new SecureStorage()