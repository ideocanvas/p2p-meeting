'use client'

import { useState, useEffect, useRef } from 'react'
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
  PhoneOff,
  Share,
  MessageSquare,
  Maximize2,
  Monitor,
  Copy,
  Clock,
  ChevronDown,
  ChevronUp,
  QrCode
} from 'lucide-react'
import { PersistentMeetingRoom } from '@/lib/types'

// Type for room info without password (what the API returns)
type RoomInfoWithoutPassword = Omit<PersistentMeetingRoom, 'password'>

export default function RoomPage({ params }: { params: Promise<{ lang: string; roomId: string }> }) {
  const [lang, setLang] = useState('en')
  const [roomId, setRoomId] = useState('')
  const router = useRouter()
  
  const [roomInfo, setRoomInfo] = useState<RoomInfoWithoutPassword | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isAudioEnabled, setIsAudioEnabled] = useState(true)
  const [isVideoEnabled, setIsVideoEnabled] = useState(true)
  const [isScreenSharing, setIsScreenSharing] = useState(false)
  const [participantName, setParticipantName] = useState('')
  const [participantId, setParticipantId] = useState('')
  const [isConnected, setIsConnected] = useState(false)
  const [showParticipants, setShowParticipants] = useState(false)
  const [showChat, setShowChat] = useState(false)
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [isControlsExpanded, setIsControlsExpanded] = useState(false)
  const [showShareMenu, setShowShareMenu] = useState(false)
  const [showQRCode, setShowQRCode] = useState(false)

  const videoRef = useRef<HTMLVideoElement>(null)
  const screenShareRef = useRef<HTMLVideoElement>(null)
  const shareMenuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const loadParams = async () => {
      const resolvedParams = await params
      setLang(resolvedParams.lang)
      setRoomId(resolvedParams.roomId)
    }
    loadParams()
  }, [params])

  useEffect(() => {
    if (!roomId) return

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

  // Close share menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (shareMenuRef.current && !shareMenuRef.current.contains(event.target as HTMLElement)) {
        setShowShareMenu(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

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
        router.push(`/${lang}/join`)
      }
    } catch (error) {
      console.error('Error loading room info:', error)
      toast.error('Failed to load room information')
      router.push(`/${lang}/join`)
    } finally {
      setIsLoading(false)
    }
  }

  const handleJoinMeeting = async () => {
    try {
      // TODO: Implement WebRTC connection logic
      setIsConnected(true)
      toast.success('Joined meeting successfully!')
      
      // Initialize camera and microphone
      await initializeMedia()
    } catch (error) {
      console.error('Error joining meeting:', error)
      toast.error('Failed to join meeting')
    }
  }

  const initializeMedia = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: isVideoEnabled,
        audio: isAudioEnabled
      })
      
      if (videoRef.current) {
        videoRef.current.srcObject = stream
      }
    } catch (error) {
      console.error('Error accessing media devices:', error)
      toast.error('Failed to access camera/microphone')
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
      router.push(`/${lang}/dashboard`)
    } catch (error) {
      console.error('Error leaving meeting:', error)
      toast.error('Failed to leave meeting')
    }
  }

  const handleToggleAudio = async () => {
    try {
      setIsAudioEnabled(!isAudioEnabled)
      // TODO: Implement audio toggle logic with WebRTC
      if (videoRef.current?.srcObject) {
        const stream = videoRef.current.srcObject as MediaStream
        const audioTracks = stream.getAudioTracks()
        audioTracks.forEach(track => {
          track.enabled = !isAudioEnabled
        })
      }
    } catch (error) {
      console.error('Error toggling audio:', error)
      toast.error('Failed to toggle audio')
    }
  }

  const handleToggleVideo = async () => {
    try {
      setIsVideoEnabled(!isVideoEnabled)
      // TODO: Implement video toggle logic with WebRTC
      if (videoRef.current?.srcObject) {
        const stream = videoRef.current.srcObject as MediaStream
        const videoTracks = stream.getVideoTracks()
        videoTracks.forEach(track => {
          track.enabled = !isVideoEnabled
        })
      }
    } catch (error) {
      console.error('Error toggling video:', error)
      toast.error('Failed to toggle video')
    }
  }

  const handleToggleScreenShare = async () => {
    try {
      if (!isScreenSharing) {
        // Start screen sharing
        const screenStream = await navigator.mediaDevices.getDisplayMedia({
          video: true,
          audio: true
        })
        
        if (screenShareRef.current) {
          screenShareRef.current.srcObject = screenStream
        }
        
        setIsScreenSharing(true)
        toast.success('Screen sharing started')
        
        // Handle when user stops screen sharing via browser UI
        screenStream.getVideoTracks()[0].onended = () => {
          setIsScreenSharing(false)
          toast.success('Screen sharing stopped')
        }
      } else {
        // Stop screen sharing
        if (screenShareRef.current?.srcObject) {
          const tracks = (screenShareRef.current.srcObject as MediaStream).getTracks()
          tracks.forEach(track => track.stop())
          screenShareRef.current.srcObject = null
        }
        setIsScreenSharing(false)
        toast.success('Screen sharing stopped')
      }
    } catch (error) {
      console.error('Error toggling screen share:', error)
      toast.error('Failed to toggle screen sharing')
    }
  }

  const handleCopyLink = async () => {
    const roomLink = `${typeof window !== 'undefined' ? window.location.origin : ''}/${lang}/room/${roomId}`
    try {
      await navigator.clipboard.writeText(roomLink)
      toast.success('Room link copied to clipboard')
      setShowShareMenu(false)
    } catch (err) {
      toast.error('Failed to copy link')
    }
  }

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen()
      setIsFullscreen(true)
    } else {
      document.exitFullscreen()
      setIsFullscreen(false)
    }
  }

  const generateQRCode = () => {
    const roomLink = `${typeof window !== 'undefined' ? window.location.origin : ''}/${lang}/room/${roomId}`
    // Simple QR code generation using URL
    const qrCodeUrl = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(roomLink)}`
    return qrCodeUrl
  }

  if (isLoading) {
    return (
      <div className="h-screen bg-gray-900 flex items-center justify-center overflow-hidden">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white mx-auto mb-4"></div>
          <p className="text-white">Loading room...</p>
        </div>
      </div>
    )
  }

  if (!roomInfo) {
    return (
      <div className="h-screen bg-gray-900 flex items-center justify-center overflow-hidden">
        <Card className="w-96 mx-4">
          <CardHeader>
            <CardTitle>Room Not Found</CardTitle>
            <CardDescription>
              The room you're trying to join doesn't exist or has expired.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button onClick={() => router.push(`/${lang}/dashboard`)} className="w-full">
              Back to Dashboard
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="h-screen bg-gray-900 text-white flex flex-col overflow-hidden">
      {/* Header - Fixed height */}
      <header className="bg-gray-800 border-b border-gray-700 px-3 py-2 h-14 flex-shrink-0">
        <div className="flex items-center justify-between h-full">
          <div className="flex items-center space-x-3 flex-1 min-w-0">
            <h1 className="text-base font-semibold truncate flex-1">{roomInfo.title}</h1>
            <div className="hidden sm:flex items-center space-x-2 text-xs text-gray-400">
              <Users className="w-3 h-3" />
              <span>1 participant</span>
            </div>
          </div>
          <div className="flex items-center space-x-1">
            <div className="hidden sm:flex items-center space-x-1 mr-2">
              <div className="w-1.5 h-1.5 bg-green-500 rounded-full"></div>
              <span className="text-xs text-green-500">Connected</span>
            </div>
            
            {/* Share Button with Menu */}
            <div className="relative" ref={shareMenuRef}>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowShareMenu(!showShareMenu)}
                className="flex items-center gap-1 px-2 py-1 h-7"
              >
                <Share className="w-3 h-3" />
                <span className="hidden xs:inline text-xs">Share</span>
              </Button>
              
              {showShareMenu && (
                <div className="absolute right-0 top-full mt-1 bg-gray-800 border border-gray-600 rounded-lg shadow-lg z-50 w-48">
                  <div className="p-2">
                    <button
                      onClick={handleCopyLink}
                      className="w-full flex items-center gap-2 px-2 py-2 text-sm hover:bg-gray-700 rounded"
                    >
                      <Copy className="w-3 h-3" />
                      Copy Link
                    </button>
                    <button
                      onClick={() => {
                        setShowQRCode(true)
                        setShowShareMenu(false)
                      }}
                      className="w-full flex items-center gap-2 px-2 py-2 text-sm hover:bg-gray-700 rounded"
                    >
                      <QrCode className="w-3 h-3" />
                      Show QR Code
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* Main Content - Flex container that fills remaining space */}
      <div className="flex-1 flex flex-col min-h-0">
        {/* Controls - Fixed at top of content area */}
        <div className="bg-gray-800 border-b border-gray-700 px-2 py-1.5 flex-shrink-0">
          <div className="flex items-center justify-between">
            {/* Primary Controls - Always visible */}
            <div className="flex items-center gap-1">
              {/* Audio Toggle */}
              <Button
                variant={isAudioEnabled ? "default" : "destructive"}
                size="sm"
                onClick={handleToggleAudio}
                className="flex items-center gap-1 px-2 py-1 h-7 text-xs"
                title={isAudioEnabled ? "Mute microphone" : "Unmute microphone"}
              >
                {isAudioEnabled ? <Mic className="w-3 h-3" /> : <MicOff className="w-3 h-3" />}
                <span className="hidden xs:inline">{isAudioEnabled ? "Mute" : "Unmute"}</span>
              </Button>

              {/* Video Toggle */}
              <Button
                variant={isVideoEnabled ? "default" : "destructive"}
                size="sm"
                onClick={handleToggleVideo}
                className="flex items-center gap-1 px-2 py-1 h-7 text-xs"
                title={isVideoEnabled ? "Turn off camera" : "Turn on camera"}
              >
                {isVideoEnabled ? <Video className="w-3 h-3" /> : <VideoOff className="w-3 h-3" />}
                <span className="hidden xs:inline">{isVideoEnabled ? "Stop Video" : "Start Video"}</span>
              </Button>

              {/* Screen Share */}
              <Button
                variant={isScreenSharing ? "default" : "secondary"}
                size="sm"
                onClick={handleToggleScreenShare}
                className="flex items-center gap-1 px-2 py-1 h-7 text-xs"
                title={isScreenSharing ? "Stop screen sharing" : "Start screen sharing"}
              >
                <Monitor className="w-3 h-3" />
                <span className="hidden xs:inline">{isScreenSharing ? "Stop Share" : "Share"}</span>
              </Button>
            </div>

            {/* Secondary Controls - Expandable on mobile */}
            <div className="flex items-center gap-1">
              {/* Expand/Collapse Controls */}
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setIsControlsExpanded(!isControlsExpanded)}
                className="flex items-center gap-1 px-2 py-1 h-7 md:hidden"
              >
                {isControlsExpanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
              </Button>

              {/* Always visible on desktop, expandable on mobile */}
              <div className={`${isControlsExpanded ? 'flex' : 'hidden'} md:flex items-center gap-1`}>
                {/* Participants */}
                <Button
                  variant={showParticipants ? "default" : "secondary"}
                  size="sm"
                  onClick={() => setShowParticipants(!showParticipants)}
                  className="flex items-center gap-1 px-2 py-1 h-7 text-xs"
                  title="Show participants"
                >
                  <Users className="w-3 h-3" />
                  <span className="hidden xs:inline">People</span>
                </Button>

                {/* Chat */}
                <Button
                  variant={showChat ? "default" : "secondary"}
                  size="sm"
                  onClick={() => setShowChat(!showChat)}
                  className="flex items-center gap-1 px-2 py-1 h-7 text-xs"
                  title="Show chat"
                >
                  <MessageSquare className="w-3 h-3" />
                  <span className="hidden xs:inline">Chat</span>
                </Button>

                {/* Fullscreen */}
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={toggleFullscreen}
                  className="flex items-center gap-1 px-2 py-1 h-7 text-xs"
                  title={isFullscreen ? "Exit fullscreen" : "Enter fullscreen"}
                >
                  <Maximize2 className="w-3 h-3" />
                  <span className="hidden xs:inline">{isFullscreen ? "Exit" : "Full"}</span>
                </Button>

                {/* Leave Meeting */}
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={handleLeaveMeeting}
                  className="flex items-center gap-1 px-2 py-1 h-7 text-xs"
                  title="Leave meeting"
                >
                  <PhoneOff className="w-3 h-3" />
                  <span className="hidden xs:inline">Leave</span>
                </Button>
              </div>
            </div>
          </div>
        </div>

        {/* Video Area - Takes remaining space, no scrolling */}
        <div className="flex-1 flex min-h-0 p-1">
          <div className="flex-1 grid grid-cols-1 gap-1 min-h-0">
            {/* Local Video */}
            <div className="relative bg-gray-800 rounded overflow-hidden min-h-0">
              <div className="w-full h-full min-h-0">
                {isVideoEnabled ? (
                  <video
                    ref={videoRef}
                    autoPlay
                    muted
                    playsInline
                    className="w-full h-full object-cover rounded"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center bg-gray-700 rounded min-h-0">
                    <div className="text-center p-2">
                      <VideoOff className="w-6 h-6 text-gray-500 mx-auto mb-1" />
                      <p className="text-gray-400 text-xs">Your camera is off</p>
                      <p className="text-gray-500 text-xs mt-0.5">{participantName}</p>
                    </div>
                  </div>
                )}
              </div>
              
              {/* Participant info overlay */}
              <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/70 to-transparent p-1">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-1">
                    <div className="w-5 h-5 bg-gray-700 rounded-full flex items-center justify-center">
                      <span className="text-white text-xs font-semibold">
                        {participantName.charAt(0).toUpperCase()}
                      </span>
                    </div>
                    <div>
                      <p className="text-white text-xs font-medium">You</p>
                      <div className="flex items-center space-x-0.5">
                        {isAudioEnabled && (
                          <Mic className="w-2 h-2 text-green-400" />
                        )}
                        {isVideoEnabled && (
                          <Video className="w-2 h-2 text-green-400" />
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Screen Share / Remote Video - Only show if screen sharing */}
            {isScreenSharing && (
              <div className="relative bg-gray-800 rounded overflow-hidden min-h-0">
                <div className="w-full h-full min-h-0">
                  <video
                    ref={screenShareRef}
                    autoPlay
                    playsInline
                    className="w-full h-full object-contain rounded bg-black"
                  />
                  <div className="absolute top-1 left-1 bg-red-600 text-white text-xs px-1 py-0.5 rounded">
                    Screen Sharing
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Sidebar - Collapsible, fixed width */}
          {(showParticipants || showChat) && (
            <div className="w-48 bg-gray-800 border-l border-gray-700 flex-shrink-0 min-h-0">
              {showParticipants && (
                <div className="p-1 border-b border-gray-700">
                  <h3 className="text-xs font-semibold mb-1 flex items-center gap-1">
                    <Users className="w-3 h-3" />
                    Participants (1)
                  </h3>
                  <div className="space-y-0.5">
                    <div className="flex items-center justify-between p-1 bg-gray-700 rounded text-xs">
                      <div className="flex items-center space-x-1">
                        <div className="w-5 h-5 bg-blue-600 rounded-full flex items-center justify-center">
                          <span className="text-white text-xs font-semibold">
                            {participantName.charAt(0).toUpperCase()}
                          </span>
                        </div>
                        <div>
                          <span className="font-medium">{participantName}</span>
                          <div className="flex items-center space-x-0.5 text-gray-400">
                            <span className="w-1 h-1 bg-green-500 rounded-full"></span>
                            <span>You</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {showChat && (
                <div className="p-1 h-full flex flex-col min-h-0">
                  <h3 className="text-xs font-semibold mb-1 flex items-center gap-1">
                    <MessageSquare className="w-3 h-3" />
                    Chat
                  </h3>
                  <div className="flex-1 bg-gray-700 rounded p-1 mb-1 min-h-0">
                    <div className="text-center text-gray-400 py-2 text-xs">
                      <MessageSquare className="w-4 h-4 mx-auto mb-0.5" />
                      <p>No messages yet</p>
                    </div>
                  </div>
                  <div className="flex space-x-0.5">
                    <input 
                      type="text"
                      placeholder="Type a message..." 
                      className="flex-1 bg-gray-700 border border-gray-600 rounded px-1 py-0.5 text-white text-xs focus:outline-none focus:border-blue-500"
                    />
                    <Button size="sm" className="text-xs px-1">Send</Button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* QR Code Modal */}
      {showQRCode && (
        <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50">
          <Card className="w-80 mx-4">
            <CardHeader>
              <CardTitle className="text-center">Scan to Join</CardTitle>
              <CardDescription className="text-center">
                Scan this QR code to join the meeting
              </CardDescription>
            </CardHeader>
            <CardContent className="text-center">
              <img 
                src={generateQRCode()} 
                alt="QR Code" 
                className="w-48 h-48 mx-auto mb-4"
              />
              <div className="space-y-2">
                <Button onClick={handleCopyLink} className="w-full" size="sm">
                  <Copy className="w-3 h-3 mr-1" />
                  Copy Link Instead
                </Button>
                <Button 
                  variant="outline" 
                  onClick={() => setShowQRCode(false)} 
                  className="w-full" 
                  size="sm"
                >
                  Close
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Join Meeting Overlay */}
      {!isConnected && (
        <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50">
          <Card className="w-96 mx-4">
            <CardHeader>
              <CardTitle>Join Meeting</CardTitle>
              <CardDescription>
                Click below to join the meeting "{roomInfo.title}"
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="text-sm text-gray-600">
                  <p><strong>Room ID:</strong> {roomId}</p>
                  <p><strong>Your Name:</strong> {participantName}</p>
                </div>
                <Button onClick={handleJoinMeeting} className="w-full">
                  Join Meeting
                </Button>
                <Button
                  variant="outline"
                  onClick={() => router.push(`/${lang}/dashboard`)}
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