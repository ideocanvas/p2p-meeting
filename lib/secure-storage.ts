// Local storage helper for room metadata and the remembered display name.
//
// No secrets are persisted locally: the host re-enters their password each
// session, which avoids storing reversible credentials in the browser.
import { LocalRoomData } from './types'

const ROOMS_KEY = 'meeting_rooms'
const USER_NAME_KEY = 'user_name'

class LocalStorage {
  // Check if we're in a browser environment
  private isBrowser(): boolean {
    return typeof window !== 'undefined' && typeof window.localStorage !== 'undefined'
  }

  // Get all rooms from localStorage
  async getRooms(): Promise<LocalRoomData[]> {
    if (!this.isBrowser()) return []

    try {
      const data = window.localStorage.getItem(ROOMS_KEY)
      if (!data) return []
      return JSON.parse(data) as LocalRoomData[]
    } catch (error) {
      console.error('Error reading rooms from storage:', error)
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
        // Update existing room - always update lastAccessed to most recent
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

      // Sort rooms by lastAccessed (most recent first)
      rooms.sort((a, b) => b.lastAccessed - a.lastAccessed)

      window.localStorage.setItem(ROOMS_KEY, JSON.stringify(rooms))
    } catch (error) {
      console.error('Error saving room to storage:', error)
    }
  }

  // Remove a room from localStorage
  async removeRoom(roomId: string): Promise<void> {
    if (!this.isBrowser()) return

    try {
      const rooms = await this.getRooms()
      const filteredRooms = rooms.filter(r => r.roomId !== roomId)
      window.localStorage.setItem(ROOMS_KEY, JSON.stringify(filteredRooms))
    } catch (error) {
      console.error('Error removing room from storage:', error)
    }
  }

  // Store user's name in localStorage
  async storeUserName(name: string): Promise<void> {
    if (!this.isBrowser()) return

    try {
      window.localStorage.setItem(USER_NAME_KEY, name)
    } catch (error) {
      console.error('Error storing user name:', error)
    }
  }

  // Get user's name from localStorage
  async getUserName(): Promise<string | null> {
    if (!this.isBrowser()) return null

    try {
      return window.localStorage.getItem(USER_NAME_KEY)
    } catch (error) {
      console.error('Error getting user name:', error)
      return null
    }
  }

  // Remove user's name from localStorage
  removeUserName(): void {
    if (!this.isBrowser()) return

    try {
      window.localStorage.removeItem(USER_NAME_KEY)
    } catch (error) {
      console.error('Error removing user name:', error)
    }
  }
}

export const secureStorage = new LocalStorage()