'use client'

import { useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { meetingService } from '@/lib/meeting-service'
import { JoinRoomRequest } from '@/lib/types'
import { toast } from 'sonner'

export default function JoinRoomPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const roomId = searchParams.get('roomId')
  
  const [isJoining, setIsJoining] = useState(false)
  const [formData, setFormData] = useState<JoinRoomRequest>({
    roomId: roomId || '',
    participantName: '',
    password: '',
  })

  const handleInputChange = (field: keyof JoinRoomRequest, value: string) => {
    setFormData(prev => ({
      ...prev,
      [field]: value,
    }))
  }

  const validateForm = (): string[] => {
    const errors: string[] = []

    if (!formData.roomId.trim()) {
      errors.push('Room ID is required')
    } else if (!meetingService.isValidRoomId(formData.roomId)) {
      errors.push('Invalid room ID format')
    }

    if (!formData.participantName.trim() || formData.participantName.trim().length < 2) {
      errors.push('Name must be at least 2 characters long')
    }

    return errors
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    const errors = validateForm()
    if (errors.length > 0) {
      errors.forEach(error => toast.error(error))
      return
    }

    setIsJoining(true)

    try {
      const response = await meetingService.joinRoom(formData)

      if (response.success && response.room) {
        toast.success('Joined room successfully!')
        // Store participant info for the meeting
        if (typeof window !== 'undefined') {
          window.localStorage.setItem('participantId', response.participantId || '')
          window.localStorage.setItem('participantName', formData.participantName)
          window.localStorage.setItem('roomId', formData.roomId)
        }
        
        router.push(`/room/${formData.roomId}`)
      } else {
        toast.error(response.error || 'Failed to join room')
      }
    } catch (error) {
      console.error('Error joining room:', error)
      toast.error('An error occurred while joining the room')
    } finally {
      setIsJoining(false)
    }
  }

  return (
    <div className="container mx-auto py-8 px-4">
      <div className="max-w-md mx-auto">
        <div className="mb-8 text-center">
          <h1 className="text-3xl font-bold mb-2">Join Meeting Room</h1>
          <p className="text-gray-600">Enter the room details to join the meeting</p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Room Information</CardTitle>
            <CardDescription>
              Provide the room ID and your name to join
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="space-y-2">
                <label htmlFor="roomId" className="text-sm font-medium">Room ID *</label>
                <Input
                  id="roomId"
                  placeholder="Enter room ID (e.g., ABC123)"
                  value={formData.roomId}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => handleInputChange('roomId', e.target.value.toUpperCase())}
                  required
                  className="font-mono"
                />
                <p className="text-xs text-gray-500">
                  Room ID is typically 6-12 characters long
                </p>
              </div>

              <div className="space-y-2">
                <label htmlFor="participantName" className="text-sm font-medium">Your Name *</label>
                <Input
                  id="participantName"
                  placeholder="Enter your name"
                  value={formData.participantName}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => handleInputChange('participantName', e.target.value)}
                  required
                />
              </div>

              <div className="space-y-2">
                <label htmlFor="password" className="text-sm font-medium">Room Password</label>
                <Input
                  id="password"
                  type="password"
                  placeholder="Enter room password (if required)"
                  value={formData.password}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => handleInputChange('password', e.target.value)}
                />
                <p className="text-xs text-gray-500">
                  Only required if the room is password protected
                </p>
              </div>

              <div className="bg-blue-50 p-4 rounded-lg">
                <h4 className="font-medium text-blue-900 mb-2">Before You Join</h4>
                <ul className="text-sm text-blue-700 space-y-1">
                  <li>• Make sure you have a working camera and microphone</li>
                  <li>• Use a modern browser (Chrome, Firefox, Safari, Edge)</li>
                  <li>• Ensure you have a stable internet connection</li>
                  <li>• Allow browser permissions for camera and microphone when prompted</li>
                </ul>
              </div>

              <div className="flex gap-3 pt-4">
                <Button
                  type="submit"
                  disabled={isJoining}
                  className="flex-1"
                >
                  {isJoining ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2" />
                      Joining Room...
                    </>
                  ) : (
                    'Join Room'
                  )}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => router.push('/')}
                  disabled={isJoining}
                >
                  Cancel
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>

        <div className="mt-6 text-center">
          <p className="text-sm text-gray-600">
            Don't have a room ID?{' '}
            <button
              onClick={() => router.push('/create')}
              className="text-blue-600 hover:text-blue-800 font-medium"
            >
              Create a new room
            </button>
          </p>
        </div>
      </div>
    </div>
  )
}