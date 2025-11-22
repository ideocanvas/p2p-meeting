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
  ArrowLeft, 
  Users, 
  Lock, 
  Clock, 
  Video, 
  Mic, 
  MessageSquare, 
  Share2,
  Calendar,
  Check,
  ChevronRight
} from 'lucide-react'
import Link from 'next/link'

type Step = 'basic' | 'settings' | 'review'

export default function CreateRoomPage({ params }: { params: Promise<{ lang: string }> }) {
  const [lang, setLang] = useState('en')
  const [currentStep, setCurrentStep] = useState<Step>('basic')
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
      requirePassword: false,
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

  const validateStep = (step: Step): string[] => {
    const errors: string[] = []

    if (step === 'basic') {
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
    }

    if (step === 'settings') {
      if (formData.settings.maxParticipants < 2 || formData.settings.maxParticipants > 100) {
        errors.push('Max participants must be between 2 and 100')
      }
    }

    return errors
  }

  const handleNextStep = () => {
    const errors = validateStep(currentStep)
    if (errors.length > 0) {
      errors.forEach(error => toast.error(error))
      return
    }

    if (currentStep === 'basic') setCurrentStep('settings')
    else if (currentStep === 'settings') setCurrentStep('review')
  }

  const handlePreviousStep = () => {
    if (currentStep === 'settings') setCurrentStep('basic')
    else if (currentStep === 'review') setCurrentStep('settings')
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    const errors = validateStep('review')
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
          const existingRooms = JSON.parse(window.localStorage.getItem('persistentRooms') || '[]')
          const newRoom = {
            id: response.roomId,
            title: formData.title,
            description: formData.description,
            ownerId: `owner_${Date.now()}`,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            isActive: true,
            settings: formData.settings
          }
          window.localStorage.setItem('persistentRooms', JSON.stringify([...existingRooms, newRoom]))
          window.localStorage.setItem('roomId', response.roomId)
          window.localStorage.setItem('roomPassword', formData.password)
          window.localStorage.setItem('isRoomOwner', 'true')
        }
        
        // Redirect to dashboard
        router.push(`/${lang}/dashboard`)
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
    if (titleWords.length > 0 && !formData.roomId) {
      const suggestion = titleWords.slice(0, 2).join('-')
      setFormData(prev => ({ ...prev, roomId: suggestion }))
    }
  }

  const steps = [
    { id: 'basic', title: 'Basic Info', description: 'Room details and security' },
    { id: 'settings', title: 'Settings', description: 'Meeting preferences' },
    { id: 'review', title: 'Review', description: 'Confirm and create' }
  ]

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-4xl mx-auto px-4 py-6">
          <div className="flex items-center justify-between">
            <Link
              href={`/${lang}/dashboard`}
              className="flex items-center space-x-2 text-gray-600 hover:text-gray-900 transition-colors"
            >
              <ArrowLeft className="w-5 h-5" />
              <span>Back to Dashboard</span>
            </Link>
            <h1 className="text-2xl font-bold text-gray-900">Create Persistent Room</h1>
            <div className="w-24"></div> {/* Spacer for balance */}
          </div>
        </div>
      </div>

      {/* Progress Steps */}
      <div className="max-w-4xl mx-auto px-4 py-6">
        <div className="flex items-center justify-center space-x-8">
          {steps.map((step, index) => (
            <div key={step.id} className="flex items-center">
              <div className={`flex items-center justify-center w-8 h-8 rounded-full ${
                currentStep === step.id ? 'bg-blue-600 text-white' :
                steps.findIndex(s => s.id === currentStep) > index ? 'bg-green-600 text-white' :
                'bg-gray-200 text-gray-600'
              }`}>
                {steps.findIndex(s => s.id === currentStep) > index ? (
                  <Check className="w-4 h-4" />
                ) : (
                  <span>{index + 1}</span>
                )}
              </div>
              <div className="ml-3">
                <div className={`text-sm font-medium ${
                  currentStep === step.id ? 'text-blue-600' : 'text-gray-600'
                }`}>
                  {step.title}
                </div>
                <div className="text-xs text-gray-500">{step.description}</div>
              </div>
              {index < steps.length - 1 && (
                <div className="ml-8 w-16 h-px bg-gray-300"></div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-4xl mx-auto px-4 py-8">
        <Card>
          <CardHeader>
            <CardTitle className="text-xl">
              {currentStep === 'basic' && 'Room Information'}
              {currentStep === 'settings' && 'Meeting Settings'}
              {currentStep === 'review' && 'Review & Create'}
            </CardTitle>
            <CardDescription>
              {currentStep === 'basic' && 'Set up the basic details for your persistent meeting room'}
              {currentStep === 'settings' && 'Configure how meetings will work in this room'}
              {currentStep === 'review' && 'Review your settings before creating the room'}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Step 1: Basic Information */}
              {currentStep === 'basic' && (
                <div className="space-y-6">
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="title">Room Title *</Label>
                      <Input
                        id="title"
                        placeholder="e.g., Team Weekly Meeting, Project Review"
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

                  <div className="space-y-4 border-t pt-6">
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
                  </div>
                </div>
              )}

              {/* Step 2: Settings */}
              {currentStep === 'settings' && (
                <div className="space-y-6">
                  <div className="grid grid-cols-2 gap-6">
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

                  <div className="space-y-4">
                    <h4 className="font-medium">Meeting Preferences</h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
                  </div>
                </div>
              )}

              {/* Step 3: Review */}
              {currentStep === 'review' && (
                <div className="space-y-6">
                  <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                    <div className="flex items-center">
                      <Check className="w-5 h-5 text-green-600 mr-2" />
                      <span className="text-green-800 font-medium">Ready to create your persistent room!</span>
                    </div>
                  </div>

                  <div className="space-y-4">
                    <h4 className="font-medium">Room Summary</h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                      <div>
                        <span className="text-gray-600">Title:</span>
                        <p className="font-medium">{formData.title}</p>
                      </div>
                      <div>
                        <span className="text-gray-600">Room ID:</span>
                        <p className="font-mono font-medium">{formData.roomId}</p>
                      </div>
                      <div>
                        <span className="text-gray-600">Description:</span>
                        <p className="font-medium line-clamp-2">{formData.description}</p>
                      </div>
                      <div>
                        <span className="text-gray-600">Max Participants:</span>
                        <p className="font-medium">{formData.settings.maxParticipants}</p>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-3">
                    <h4 className="font-medium">Settings</h4>
                    <div className="flex flex-wrap gap-2">
                      {formData.settings.videoOnEntry && (
                        <span className="inline-flex items-center px-2 py-1 rounded-full text-xs bg-green-100 text-green-800">
                          <Video className="w-3 h-3 mr-1" />
                          Video On Entry
                        </span>
                      )}
                      {formData.settings.enableChat && (
                        <span className="inline-flex items-center px-2 py-1 rounded-full text-xs bg-blue-100 text-blue-800">
                          💬 Chat Enabled
                        </span>
                      )}
                      {formData.settings.enableScreenShare && (
                        <span className="inline-flex items-center px-2 py-1 rounded-full text-xs bg-purple-100 text-purple-800">
                          🖥️ Screen Share
                        </span>
                      )}
                      <span className="inline-flex items-center px-2 py-1 rounded-full text-xs bg-gray-100 text-gray-800">
                        <Clock className="w-3 h-3 mr-1" />
                        {formData.settings.defaultMeetingDuration} min
                      </span>
                    </div>
                  </div>
                </div>
              )}

              {/* Navigation Buttons */}
              <div className="flex justify-between pt-6">
                <div>
                  {currentStep !== 'basic' && (
                    <Button
                      type="button"
                      variant="outline"
                      onClick={handlePreviousStep}
                      disabled={isCreating}
                    >
                      Previous
                    </Button>
                  )}
                </div>
                
                <div className="flex gap-3">
                  {currentStep !== 'review' ? (
                    <Button
                      type="button"
                      onClick={handleNextStep}
                      className="flex items-center gap-2"
                    >
                      Next
                      <ChevronRight className="w-4 h-4" />
                    </Button>
                  ) : (
                    <Button
                      type="submit"
                      disabled={isCreating}
                      className="flex items-center gap-2"
                    >
                      {isCreating ? (
                        <>
                          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2" />
                          Creating Room...
                        </>
                      ) : (
                        <>
                          <Check className="w-4 h-4" />
                          Create Persistent Room
                        </>
                      )}
                    </Button>
                  )}
                </div>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}