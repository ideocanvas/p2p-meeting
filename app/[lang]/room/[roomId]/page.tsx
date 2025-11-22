'use client'

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { meetingService } from '@/lib/meeting-service'
import { toast } from 'sonner'
import { 
  Video, 
  VideoOff, 
  Mic, 
  MicOff, 
  Users, 
  Settings, 
  PhoneOff,
  Share,
  MessageSquare,
  Maximize2
} from 'lucide-react'

export default function RoomPage() {
  const params = useParams()
  const router = useRouter()
  const roomId = params.roomId as string
  
  const [roomInfo, setRoomInfo] = useState<unknown>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isAudioEnabled, setIsAudioEnabled] = useState(true)
  const [isVideoEnabled, setIsVideoEnabled] = useState(true)
  const [isScreenSharing, setIsScreenSharing] = useState(false)
  const [participantName, setParticipantName] = useState('')
  const [participantId, setParticipantId] = useState('')
  const [isConnected, setIsConnected] = useState(false)

  useEffect(() => {
    // Load participant info from localStorage
    if (typeof window !== 'undefined') {
      const name = window.localStorage.getItem('participantName')
      const id = window.localStorage.getItem('participantId')
      const storedRoomId = window.localStorage.getItem('roomId')
      
      if (name && id && storedRoomId === roomId) {
        setParticipantName(name)
        setParticipantId(id)
      } else {
        // Set default participant name for direct join
        const defaultName = `Participant_${Math.random().toString(36).substr(2, 6)}`
        const defaultId = `user_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`
        setParticipantName(defaultName)
        setParticipantId(defaultId)
        
        // Store in localStorage for future use
        window.localStorage.setItem('participantName', defaultName)
        window.localStorage.setItem('participantId', defaultId)
        window.localStorage.setItem('roomId', roomId)
      }
    }

    loadRoomInfo()
  }, [roomId, router])

  const loadRoomInfo = async () => {
    try {
      setIsLoading(true)
      // Get room info without password (participants don't need password to join)
      const response = await meetingService.getRoom({ roomId })
      
      if (response.success && response.room) {
        setRoomInfo(response.room)
        // Auto-join meeting for direct links
        setTimeout(() => {
          handleJoinMeeting()
        }, 1000)
      } else {
        toast.error(response.error || 'Failed to load room information')
        router.push('/join')
      }
    } catch (error) {
      console.error('Error loading room info:', error)
      toast.error('Failed to load room information')
      router.push('/join')
    } finally {
      setIsLoading(false)
    }
  }

  const handleJoinMeeting = async () => {
    try {
      // TODO: Implement WebRTC connection logic
      setIsConnected(true)
      toast.success('Joined meeting successfully!')
    } catch (error) {
      console.error('Error joining meeting:', error)
      toast.error('Failed to join meeting')
    }
  }

  const handleLeaveMeeting = async () => {
    try {
      // TODO: Implement WebRTC disconnection logic
      setIsConnected(false)
      // Clear localStorage
      if (typeof window !== 'undefined') {
        window.localStorage.removeItem('participantId')
        window.localStorage.removeItem('participantName')
        window.localStorage.removeItem('roomId')
      }
      router.push('/')
    } catch (error) {
      console.error('Error leaving meeting:', error)
      toast.error('Failed to leave meeting')
    }
  }

  const handleToggleAudio = () => {
    // TODO: Implement audio toggle logic
    setIsAudioEnabled(!isAudioEnabled)
  }

  const handleToggleVideo = () => {
    // TODO: Implement video toggle logic
    setIsVideoEnabled(!isVideoEnabled)
  }

  const handleToggleScreenShare = async () => {
    try {
      if (!isScreenSharing) {
        // Start screen sharing
        const screenStream = await navigator.mediaDevices.getDisplayMedia({
          video: true,
          audio: true
        })
        // TODO: Implement screen sharing logic
        setIsScreenSharing(true)
        toast.success('Screen sharing started')
      } else {
        // Stop screen sharing
        // TODO: Implement stop screen sharing logic
        setIsScreenSharing(false)
        toast.success('Screen sharing stopped')
      }
    } catch (error) {
      console.error('Error toggling screen share:', error)
      toast.error('Failed to toggle screen sharing')
    }
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white mx-auto mb-4"></div>
          <p className="text-white">Loading room...</p>
        </div>
      </div>
    )
  }

  if (!roomInfo) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <Card className="w-96">
          <CardHeader>
            <CardTitle>Room Not Found</CardTitle>
            <CardDescription>
              The room you're trying to join doesn't exist or has expired.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button onClick={() => router.push('/')} className="w-full">
              Go Home
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-900 text-white">
      {/* Header */}
      <header className="bg-gray-800 border-b border-gray-700">
        <div className="max-w-7xl mx-auto px-4 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <h1 className="text-lg font-semibold">{(roomInfo as { title: string }).title}</h1>
              <div className="flex items-center space-x-2 text-sm text-gray-400">
                <Users className="w-4 h-4" />
                <span>1 participant</span>
              </div>
            </div>
            <div className="flex items-center space-x-2">
              <div className="flex items-center space-x-2">
                <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                <span className="text-sm text-green-500">Connected</span>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => router.push('/join')}
              >
                <Settings className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex flex-col h-[calc(100vh-60px)]">
        {/* Video Area */}
        <div className="flex-1 p-4">
          <div className="grid grid-cols-1 gap-4 h-full">
            {/* Local Video */}
            <div className="relative bg-gray-800 rounded-lg overflow-hidden aspect-video">
              <div className="w-full h-full flex items-center justify-center bg-gray-700">
                <div className="text-center">
                  <VideoOff className="w-16 h-16 text-gray-500 mx-auto mb-4" />
                  <p className="text-gray-400 text-lg">Your camera is off</p>
                  <p className="text-gray-500 text-sm mt-2">{participantName}</p>
                </div>
              </div>
              
              {/* Participant info overlay */}
              <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/70 to-transparent p-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <div className="w-8 h-8 bg-gray-700 rounded-full flex items-center justify-center">
                      <span className="text-white text-sm font-semibold">
                        {participantName.charAt(0).toUpperCase()}
                      </span>
                    </div>
                    <div>
                      <p className="text-white text-sm font-medium">You</p>
                      <div className="flex items-center space-x-1">
                        {isAudioEnabled && (
                          <Mic className="w-3 h-3 text-green-400" />
                        )}
                        {isVideoEnabled && (
                          <Video className="w-3 h-3 text-green-400" />
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="bg-blue-600 text-white text-xs px-2 py-1 rounded">
                    Host
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Controls */}
        <div className="bg-gray-800 border-t border-gray-700 p-4">
          <div className="max-w-4xl mx-auto">
            <div className="flex items-center justify-center space-x-4">
              {/* Audio Toggle */}
              <Button
                variant={isAudioEnabled ? "default" : "destructive"}
                size="lg"
                onClick={handleToggleAudio}
                className="rounded-full w-12 h-12"
              >
                {isAudioEnabled ? <Mic className="w-5 h-5" /> : <MicOff className="w-5 h-5" />}
              </Button>

              {/* Video Toggle */}
              <Button
                variant={isVideoEnabled ? "default" : "destructive"}
                size="lg"
                onClick={handleToggleVideo}
                className="rounded-full w-12 h-12"
              >
                {isVideoEnabled ? <Video className="w-5 h-5" /> : <VideoOff className="w-5 h-5" />}
              </Button>

              {/* Screen Share */}
              <Button
                variant={isScreenSharing ? "default" : "secondary"}
                size="lg"
                onClick={handleToggleScreenShare}
                className="rounded-full w-12 h-12"
              >
                <Share className="w-5 h-5" />
              </Button>

              {/* Leave Meeting */}
              <Button
                variant="destructive"
                size="lg"
                onClick={handleLeaveMeeting}
                className="rounded-full w-12 h-12"
              >
                <PhoneOff className="w-5 h-5" />
              </Button>
            </div>

            {/* Additional Controls */}
            <div className="flex items-center justify-center space-x-4 mt-4">
              <Button variant="ghost" size="sm">
                <MessageSquare className="w-4 h-4 mr-2" />
                Chat
              </Button>
              <Button variant="ghost" size="sm">
                <Users className="w-4 h-4 mr-2" />
                Participants
              </Button>
              <Button variant="ghost" size="sm">
                <Maximize2 className="w-4 h-4 mr-2" />
                Fullscreen
              </Button>
            </div>
          </div>
        </div>
      </main>

      {/* Join Meeting Overlay */}
      {!isConnected && (
        <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50">
          <Card className="w-96">
            <CardHeader>
              <CardTitle>Join Meeting</CardTitle>
              <CardDescription>
                Click below to join the meeting "{(roomInfo as { title: string }).title}"
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="text-sm text-gray-600">
                  <p><strong>Room ID:</strong> {roomId}</p>
                  <p><strong>Your Name:</strong> {participantName}</p>
                  <p><strong>Host:</strong> {(roomInfo as { hostName: string }).hostName}</p>
                </div>
                <Button onClick={handleJoinMeeting} className="w-full">
                  Join Meeting
                </Button>
                <Button 
                  variant="outline" 
                  onClick={() => router.push('/join')}
                  className="w-full"
                >
                  Cancel
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  )
}