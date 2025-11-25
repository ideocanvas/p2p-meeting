import { RoomData, PublicRoomInfo, SimplifiedRoom } from '@/lib/types'
import { KVHelper } from '@/lib/kv-helper'

export const roomService = {
  async createRoom(title: string, masterPassword: string): Promise<RoomData> {
    const id = Math.random().toString(36).substring(2, 8).toUpperCase()
    const room: RoomData = {
      id,
      title,
      masterPassword,
      hostPeerId: null,
      createdAt: Date.now(),
      participants: [],
      settings: { maxParticipants: 20 }
    }

    try {
      const kvHelper = KVHelper.getInstance();
      await kvHelper.put(`room:${id}`, JSON.stringify(room), { expirationTtl: 24 * 60 * 60 }) // 24h expiry
    } catch (error) {
      console.error('Failed to save room to KV:', error)
      throw new Error('Failed to create room')
    }
    
    return room
  },

  async getRoom(id: string): Promise<RoomData | null> {
    try {
      const kvHelper = KVHelper.getInstance();
      const data = await kvHelper.get(`room:${id}`)
      return data ? JSON.parse(data) : null
    } catch (error) {
      console.error('Failed to get room from KV:', error)
      return null
    }
  },

  async verifyMasterPassword(id: string, password: string): Promise<boolean> {
    const room = await this.getRoom(id)
    return room ? room.masterPassword === password : false
  },

  async isAuthorized(id: string, authData: { password?: string }): Promise<boolean> {
    if (authData.password) {
      return this.verifyMasterPassword(id, authData.password)
    }
    return false
  },

  async updateHostPeerId(id: string, peerId: string | null) {
    const room = await this.getRoom(id)
    if (room) {
      room.hostPeerId = peerId
      try {
        const kvHelper = KVHelper.getInstance();
        await kvHelper.put(`room:${id}`, JSON.stringify(room), { expirationTtl: 24 * 60 * 60 })
      } catch (error) {
        console.error('Failed to update room in KV:', error)
        throw new Error('Failed to update room')
      }
    }
  },

  async joinRoom(roomId: string, participantName: string, peerId: string): Promise<{ success: boolean; participantId?: string; error?: string }> {
    const room = await this.getRoom(roomId)
    if (!room) {
      return { success: false, error: 'Room not found' }
    }

    // Check if room is full
    const activeParticipants = room.participants.filter(p => p.status === 'active')
    if (activeParticipants.length >= room.settings.maxParticipants) {
      return { success: false, error: 'Room is full' }
    }

    // Add participant to waiting list
    const participantId = Math.random().toString(36).substring(2, 8).toUpperCase()
    const participant = {
      id: participantId,
      name: participantName,
      peerId,
      status: 'waiting' as const,
      joinedAt: Date.now()
    }

    room.participants.push(participant)

    try {
      const kvHelper = KVHelper.getInstance();
      await kvHelper.put(`room:${roomId}`, JSON.stringify(room), { expirationTtl: 24 * 60 * 60 })
      return { success: true, participantId }
    } catch (error) {
      console.error('Failed to join room:', error)
      return { success: false, error: 'Failed to join room' }
    }
  },

  async approveParticipant(roomId: string, participantId: string): Promise<{ success: boolean; error?: string }> {
    const room = await this.getRoom(roomId)
    if (!room) {
      return { success: false, error: 'Room not found' }
    }

    const participant = room.participants.find(p => p.id === participantId)
    if (!participant) {
      return { success: false, error: 'Participant not found' }
    }

    // Update participant status to active
    participant.status = 'active'

    try {
      const kvHelper = KVHelper.getInstance();
      await kvHelper.put(`room:${roomId}`, JSON.stringify(room), { expirationTtl: 24 * 60 * 60 })
      return { success: true }
    } catch (error) {
      console.error('Failed to approve participant:', error)
      return { success: false, error: 'Failed to approve participant' }
    }
  },

  async endMeeting(roomId: string, password: string): Promise<{ success: boolean; error?: string }> {
    const room = await this.getRoom(roomId)
    if (!room) {
      return { success: false, error: 'Room not found' }
    }

    if (!this.verifyMasterPassword(roomId, password)) {
      return { success: false, error: 'Invalid password' }
    }

    try {
      // Delete the room from KV
      const kvHelper = KVHelper.getInstance();
      await kvHelper.delete(`room:${roomId}`)
      return { success: true }
    } catch (error) {
      console.error('Failed to end meeting:', error)
      return { success: false, error: 'Failed to end meeting' }
    }
  },

  async hostReconnect(roomId: string, password: string, hostPeerId: string): Promise<{ success: boolean; room?: SimplifiedRoom; error?: string }> {
    const room = await this.getRoom(roomId)
    if (!room) {
      return { success: false, error: 'Room not found' }
    }

    if (!this.verifyMasterPassword(roomId, password)) {
      return { success: false, error: 'Invalid password' }
    }

    try {
      // Update host peer ID
      await this.updateHostPeerId(roomId, hostPeerId)
      
      const simplifiedRoom: SimplifiedRoom = {
        id: room.id,
        title: room.title,
        status: 'active',
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
        participantCount: room.participants.filter(p => p.status === 'active').length,
        hostConnected: !!hostPeerId
      }
      
      return { success: true, room: simplifiedRoom }
    } catch (error) {
      console.error('Failed to reconnect host:', error)
      return { success: false, error: 'Failed to reconnect host' }
    }
  },

  sanitize(room: RoomData): PublicRoomInfo {
    return {
      id: room.id,
      title: room.title,
      createdAt: room.createdAt,
      participantCount: room.participants.filter(p => p.status === 'active').length,
      hostConnected: !!room.hostPeerId
    }
  }
}