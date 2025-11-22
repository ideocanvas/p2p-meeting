'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { meetingService } from '@/lib/meeting-service'
import { CreateRoomRequest } from '@/lib/types'
import { toast } from 'sonner'
import { 
  Users, 
  Lock, 
  Clock, 
  Video, 
  Mic, 
  MessageSquare, 
  Share2, 
  Calendar,
  Settings
} from 'lucide-react'

export default function CreateRoomPage({ params }: { params: Promise<{ lang: string }> }) {
  const [lang, setLang] = useState('en')
  const [isCreating, setIsCreating] = useState(false)
  const [confirmPassword, setConfirmPassword] = useState('')
  const router = useRouter()
  
  const [formData, setFormData] = useState<CreateRoomRequest>({
    title: '',
    description: '',
    roomId: '',
    password: '',
    settings: {
      maxParticipants: 10,
      requirePassword: true,
      allowWaitingRoom: false,
      muteOnEntry: false,
      videoOnEntry: true,
      enableChat: true,
      enableScreenShare: true,
      autoRecord: false,
      defaultMeetingDuration: 60,
    }
  })

  // Load language parameter
  useEffect(() => {
    const loadParams = async () => {
      const resolvedParams = await params
      setLang(resolvedParams.lang)
    }
    loadParams()
  }, [params])

  const handleInputChange = (field: string, value: string | number | boolean) => {
    if (field.startsWith('settings.')) {
      const settingField = field.replace('settings.', '')
      setFormData(prev => ({
        ...prev,
        settings: {
          ...prev.settings,
          [settingField]: value
        }
      }))
    } else {
      setFormData(prev => ({
        ...prev,
        [field]: value
      }))
    }
  }

  const validateForm = (): string[] => {
    const errors: string[] = []

    if (!formData.title.trim() || formData.title.trim().length < 3) {
      errors.push('Meeting title must be at least 3 characters long')
    }

    if (!formData.description.trim() || formData.description.trim().length < 10) {
      errors.push('Description must be at least 10 characters long')
    }

    if (!formData.roomId.trim()) {
      errors.push('Room ID is required')
    } else if (!/^[a-zA-Z0-9-_]{3,50}$/.test(formData.roomId)) {
      errors.push('Room ID must be 3-50 characters containing letters, numbers, hyphens, or underscores')
    }

    if (!formData.password.trim()) {
      errors.push('Password is required')
    } else if (formData.password.length < 4) {
      errors.push('Password must be at least 4 characters long')
    }

    if (formData.password !== confirmPassword) {
      errors.push('Passwords do not match')
    }

    if (formData.settings.maxParticipants < 2 || formData.settings.maxParticipants > 100) {
      errors.push('Max participants must be between 2 and 100')
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

      if (response.success && response.roomId) {
        toast.success('Persistent meeting room created successfully!')
        
        // Store room info for management
        if (typeof window !== 'undefined') {
          window.localStorage.setItem('roomId', response.roomId)
          window.localStorage.setItem('roomPassword', formData.password)
          window.localStorage.setItem('isRoomOwner', 'true')
        }
        
        // Redirect to room management page
        router.push(`/${lang}/room/${response.roomId}`)
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

  const generateRoomIdSuggestion = () => {
    const titleWords = formData.title.toLowerCase().split(/\s+/).filter(word => word.length > 2)
    if (titleWords.length > 0) {
      const suggestion = titleWords.slice(0, 2).join('-')
      if (!formData.roomId) {
        setFormData(prev => ({ ...prev, roomId: suggestion }))
      }
    }
  }

  return (
    <div className="container mx-auto py-8 px-4">
      <div className="max-w-2xl mx-auto">
        <div className="mb-8 text-center">
          <h1 className="text-3xl font-bold mb-2">Create Persistent Meeting Room</h1>
          <p className="text-gray-600">
            Set up a permanent meeting room with a fixed, reusable link
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Room Configuration</CardTitle>
            <CardDescription>
              Configure your permanent meeting room with custom settings
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Basic Information */}
              <div className="space-y-4">
                <h3 className="text-lg font-semibold flex items-center gap-2">
                  <Settings className="w-5 h-5" />
                  Basic Information
                </h3>
                
                <div className="space-y-2">
                  <Label htmlFor="title">Room Title *</Label>
                  <Input
                    id="title"
                    placeholder="e.g., Team Weekly Meeting"
                    value={formData.title}
                    onChange={(e) => handleInputChange('title', e.target.value)}
                    onBlur={generateRoomIdSuggestion}
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="description">Room Description *</Label>
                  <Textarea
                    id="description"
                    placeholder="Describe the purpose of this meeting room..."
                    value={formData.description}
                    onChange={(e) => handleInputChange('description', e.target.value)}
                    required
                    rows={3}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="roomId">Permanent Room ID *</Label>
                  <Input
                    id="roomId"
                    placeholder="e.g., team-weekly or project-review"
                    value={formData.roomId}
                    onChange={(e) => handleInputChange('roomId', e.target.value.toLowerCase())}
                    required
                    className="font-mono"
                  />
                  <p className="text-xs text-gray-500">
                    This will be your permanent meeting URL: /room/{formData.roomId || 'your-id'}
                  </p>
                </div>
              </div>

              {/* Security Settings */}
              <div className="space-y-4">
                <h3 className="text-lg font-semibold flex items-center gap-2">
                  <Lock className="w-5 h-5" />
                  Security
                </h3>
                
                <div className="space-y-2">
                  <Label htmlFor="password">Room Password *</Label>
                  <Input
                    id="password"
                    type="password"
                    placeholder="Set a password for room management"
                    value={formData.password}
                    onChange={(e) => handleInputChange('password', e.target.value)}
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="confirmPassword">Confirm Password *</Label>
                  <Input
                    id="confirmPassword"
                    type="password"
                    placeholder="Confirm your password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    required
                  />
                </div>

                <div className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    id="requirePassword"
                    checked={formData.settings.requirePassword}
                    onChange={(e) => handleInputChange('settings.requirePassword', e.target.checked)}
                    className="rounded"
                  />
                  <Label htmlFor="requirePassword" className="text-sm">
                    Require password for participants to join
                  </Label>
                </div>
              </div>

              {/* Meeting Settings */}
              <div className="space-y-4">
                <h3 className="text-lg font-semibold flex items-center gap-2">
                  <Video className="w-5 h-5" />
                  Meeting Settings
                </h3>
                
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="maxParticipants" className="flex items-center gap-1">
                      <Users className="w-4 h-4" />
                      Max Participants
                    </Label>
                    <Input
                      id="maxParticipants"
                      type="number"
                      min="2"
                      max="100"
                      value={formData.settings.maxParticipants}
                      onChange={(e) => handleInputChange('settings.maxParticipants', parseInt(e.target.value))}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="defaultMeetingDuration" className="flex items-center gap-1">
                      <Clock className="w-4 h-4" />
                      Default Duration (minutes)
                    </Label>
                    <Input
                      id="defaultMeetingDuration"
                      type="number"
                      min="15"
                      max="480"
                      value={formData.settings.defaultMeetingDuration}
                      onChange={(e) => handleInputChange('settings.defaultMeetingDuration', parseInt(e.target.value))}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="flex items-center space-x-2">
                    <input
                      type="checkbox"
                      id="videoOnEntry"
                      checked={formData.settings.videoOnEntry}
                      onChange={(e) => handleInputChange('settings.videoOnEntry', e.target.checked)}
                      className="rounded"
                    />
                    <Label htmlFor="videoOnEntry" className="text-sm flex items-center gap-1">
                      <Video className="w-4 h-4" />
                      Video on entry
                    </Label>
                  </div>

                  <div className="flex items-center space-x-2">
                    <input
                      type="checkbox"
                      id="muteOnEntry"
                      checked={formData.settings.muteOnEntry}
                      onChange={(e) => handleInputChange('settings.muteOnEntry', e.target.checked)}
                      className="rounded"
                    />
                    <Label htmlFor="muteOnEntry" className="text-sm flex items-center gap-1">
                      <Mic className="w-4 h-4" />
                      Mute on entry
                    </Label>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="flex items-center space-x-2">
                    <input
                      type="checkbox"
                      id="enableChat"
                      checked={formData.settings.enableChat}
                      onChange={(e) => handleInputChange('settings.enableChat', e.target.checked)}
                      className="rounded"
                    />
                    <Label htmlFor="enableChat" className="text-sm flex items-center gap-1">
                      <MessageSquare className="w-4 h-4" />
                      Enable chat
                    </Label>
                  </div>

                  <div className="flex items-center space-x-2">
                    <input
                      type="checkbox"
                      id="enableScreenShare"
                      checked={formData.settings.enableScreenShare}
                      onChange={(e) => handleInputChange('settings.enableScreenShare', e.target.checked)}
                      className="rounded"
                    />
                    <Label htmlFor="enableScreenShare" className="text-sm flex items-center gap-1">
                      <Share2 className="w-4 h-4" />
                      Enable screen share
                    </Label>
                  </div>
                </div>

                <div className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    id="autoRecord"
                    checked={formData.settings.autoRecord}
                    onChange={(e) => handleInputChange('settings.autoRecord', e.target.checked)}
                    className="rounded"
                  />
                  <Label htmlFor="autoRecord" className="text-sm flex items-center gap-1">
                    <Calendar className="w-4 h-4" />
                    Auto-record meetings
                  </Label>
                </div>
              </div>

              {/* Room Information */}
              <div className="bg-blue-50 p-4 rounded-lg">
                <h4 className="font-medium text-blue-900 mb-2 flex items-center gap-2">
                  <Info className="w-4 h-4" />
                  Room Information
                </h4>
                <ul className="text-sm text-blue-700 space-y-1">
                  <li>• This room will have a permanent URL: /room/{formData.roomId || 'your-id'}</li>
                  <li>• You can share this link with participants anytime</li>
                  <li>• The room will remain active until you delete it</li>
                  <li>• You can schedule multiple meetings in the same room</li>
                  <li>• All meeting recordings will be stored in this room</li>
                </ul>
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
                      Creating Persistent Room...
                    </>
                  ) : (
                    'Create Persistent Room'
                  )}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => router.push(`/${lang}`)}
                  disabled={isCreating}
                >
                  Cancel
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>

        <div className="mt-6 text-center">
          <p className="text-sm text-gray-600">
            Looking for a quick meeting?{' '}
            <button
              onClick={() => router.push(`/${lang}/quick-meeting`)}
              className="text-blue-600 hover:text-blue-800 font-medium"
            >
              Create a quick meeting instead
            </button>
          </p>
        </div>
      </div>
    </div>
  )
}

// Simple Info icon component
const Info = ({ className }: { className?: string }) => (
  <svg className={className} fill="currentColor" viewBox="0 0 20 20">
    <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
  </svg>
)