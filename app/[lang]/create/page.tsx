'use client'

import { useState } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { QRCodeGenerator } from '@/components/qr-code-generator'
import { meetingService } from '@/lib/meeting-service'
import { CreateRoomRequest } from '@/lib/types'
import { toast } from 'sonner'

export default function CreateRoomPage() {
  const router = useRouter()
  const params = useParams()
  const lang = params.lang as string
  const [isCreating, setIsCreating] = useState(false)
  const [createdRoom, setCreatedRoom] = useState<string | null>(null)
  const [formData, setFormData] = useState<CreateRoomRequest>({
    title: '',
    hostName: '',
    password: '',
    meetingDate: '',
    maxParticipants: 10,
    description: '',
    settings: {
      requirePassword: true,
      allowWaitingRoom: false,
      muteOnEntry: false,
      videoOnEntry: true,
      enableChat: true,
      enableScreenShare: true,
      recordMeeting: false,
    },
  })
  const [confirmPassword, setConfirmPassword] = useState('')

  const handleInputChange = (field: keyof CreateRoomRequest, value: string | number) => {
    setFormData(prev => ({
      ...prev,
      [field]: value,
    }))
  }

  const validateForm = (): string[] => {
    const errors: string[] = []

    if (!formData.title.trim() || formData.title.trim().length < 3) {
      errors.push('Title must be at least 3 characters long')
    }

    if (!formData.hostName.trim() || formData.hostName.trim().length < 2) {
      errors.push('Host name must be at least 2 characters long')
    }

    if (!formData.password || formData.password.length < 4) {
      errors.push('Password must be at least 4 characters long')
    }

    if (formData.password !== confirmPassword) {
      errors.push('Passwords do not match')
    }

    if (!formData.meetingDate) {
      errors.push('Meeting date is required')
    } else {
      const meetingDate = new Date(formData.meetingDate)
      const now = new Date()
      if (meetingDate <= now) {
        errors.push('Meeting date must be in the future')
      }
    }

    if (formData.maxParticipants && (formData.maxParticipants < 2 || formData.maxParticipants > 50)) {
      errors.push('Max participants must be between 2 and 50')
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

    setIsCreating(true)

    try {
      const response = await meetingService.createRoom(formData)

      if (response.success && response.room) {
        setCreatedRoom(response.room.id)
        toast.success('Meeting room created successfully!')
      } else {
        toast.error(response.error || 'Failed to create room')
      }
    } catch (error) {
      console.error('Error creating room:', error)
      toast.error('An error occurred while creating the room')
    } finally {
      setIsCreating(false)
    }
  }

  const copyJoinLink = () => {
    if (createdRoom) {
      const link = meetingService.generateJoinLink(createdRoom)
      navigator.clipboard.writeText(link)
      toast.success('Join link copied to clipboard!')
    }
  }

  const getJoinLink = () => {
    if (createdRoom) {
      return meetingService.generateJoinLink(createdRoom)
    }
    return ''
  }

  const goToRoom = () => {
    if (createdRoom) {
      router.push(`/${lang}/room/${createdRoom}`)
    }
  }

  if (createdRoom) {
    return (
      <div className="container mx-auto py-8 px-4">
        <div className="max-w-2xl mx-auto">
          <Card>
            <CardHeader className="text-center">
              <div className="mx-auto w-12 h-12 bg-green-100 rounded-full flex items-center justify-center mb-4">
                <svg className="h-6 w-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <CardTitle className="text-2xl">Room Created Successfully!</CardTitle>
              <CardDescription>
                Your meeting room is ready. Share the link with participants.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="bg-gray-50 p-4 rounded-lg">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium text-gray-600">Room ID</span>
                  <span className="font-mono text-lg">{createdRoom}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-gray-600">Join Link</span>
                  <Button variant="outline" size="sm" onClick={copyJoinLink}>
                    <svg className="h-4 w-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                    </svg>
                    Copy Link
                  </Button>
                </div>
              </div>

              <div className="bg-blue-50 p-6 rounded-lg">
                <h4 className="font-medium text-blue-900 mb-4 text-center">Share via QR Code (Mobile)</h4>
                <div className="flex justify-center mb-4">
                  <QRCodeGenerator url={getJoinLink()} />
                </div>
                <p className="text-sm text-blue-700 text-center">
                  Scan this QR code with your mobile device to join the meeting
                </p>
              </div>

              <div className="bg-blue-50 p-4 rounded-lg">
                <h4 className="font-medium text-blue-900 mb-2">Meeting Details</h4>
                <div className="space-y-1 text-sm text-blue-700">
                  <p><strong>Title:</strong> {formData.title}</p>
                  <p><strong>Host:</strong> {formData.hostName}</p>
                  <p><strong>Date:</strong> {meetingService.formatMeetingDate(formData.meetingDate)}</p>
                  <p><strong>Max Participants:</strong> {formData.maxParticipants}</p>
                </div>
              </div>

              <div className="flex gap-3">
                <Button onClick={goToRoom} className="flex-1">
                  Enter Room
                </Button>
                <Button 
                  variant="outline" 
                  onClick={() => router.push('/')}
                  className="flex-1"
                >
                  Create Another Room
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    )
  }

  return (
    <div className="container mx-auto py-8 px-4">
      <div className="max-w-2xl mx-auto">
        <div className="mb-8 text-center">
          <h1 className="text-3xl font-bold mb-2">Create Meeting Room</h1>
          <p className="text-gray-600">Set up a new meeting room and invite participants</p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Meeting Details</CardTitle>
            <CardDescription>
              Configure your meeting room settings
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label htmlFor="title" className="text-sm font-medium">Meeting Title *</label>
                  <Input
                    id="title"
                    placeholder="Team Standup"
                    value={formData.title}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => handleInputChange('title', e.target.value)}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <label htmlFor="hostName" className="text-sm font-medium">Your Name *</label>
                  <Input
                    id="hostName"
                    placeholder="John Doe"
                    value={formData.hostName}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => handleInputChange('hostName', e.target.value)}
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label htmlFor="password" className="text-sm font-medium">Room Password *</label>
                  <Input
                    id="password"
                    type="password"
                    placeholder="Enter password"
                    value={formData.password}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => handleInputChange('password', e.target.value)}
                    required
                  />
                  <p className="text-xs text-gray-500">
                    Participants will need this password to join
                  </p>
                </div>
                <div className="space-y-2">
                  <label htmlFor="confirmPassword" className="text-sm font-medium">Confirm Password *</label>
                  <Input
                    id="confirmPassword"
                    type="password"
                    placeholder="Confirm password"
                    value={confirmPassword}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => setConfirmPassword(e.target.value)}
                    required
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label htmlFor="maxParticipants" className="text-sm font-medium">Max Participants</label>
                <select
                  id="maxParticipants"
                  value={formData.maxParticipants}
                  onChange={(e) => handleInputChange('maxParticipants', parseInt(e.target.value))}
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <option value="2">2 participants</option>
                  <option value="5">5 participants</option>
                  <option value="10">10 participants</option>
                  <option value="20">20 participants</option>
                  <option value="50">50 participants</option>
                </select>
              </div>

              <div className="space-y-2">
                <label htmlFor="meetingDate" className="text-sm font-medium">Meeting Date & Time *</label>
                <Input
                  id="meetingDate"
                  type="datetime-local"
                  value={formData.meetingDate}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => handleInputChange('meetingDate', e.target.value)}
                  required
                />
              </div>

              <div className="space-y-2">
                <label htmlFor="description" className="text-sm font-medium">Description (Optional)</label>
                <textarea
                  id="description"
                  placeholder="Meeting agenda or notes..."
                  value={formData.description}
                  onChange={(e) => handleInputChange('description', e.target.value)}
                  rows={3}
                  className="flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                />
              </div>

              <div className="flex gap-3 pt-4">
                <Button
                  type="submit"
                  disabled={isCreating}
                  className="flex-1"
                >
                  {isCreating ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2" />
                      Creating Room...
                    </>
                  ) : (
                    'Create Room'
                  )}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => router.push('/')}
                  disabled={isCreating}
                >
                  Cancel
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}