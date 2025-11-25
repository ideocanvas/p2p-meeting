'use client'

import { useState, useEffect, useRef } from 'react'
import { useParams, useRouter } from 'next/navigation'
import MeetingManager from '@/services/meeting-manager'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Mic, MicOff, Video as VideoIcon, VideoOff, PhoneOff, Check, X, Users, Lock, User, Key, Home, Share2, QrCode, Copy } from 'lucide-react'
import { toast } from 'sonner'
import { PublicRoomInfo, Participant } from '@/lib/types'
import { secureStorage } from '@/lib/secure-storage'
import { SiteHeader } from '@/components/site-header'
import { QRCodeGenerator } from '@/components/qr-code-generator'

// ParticipantVideo component with proper cleanup
function ParticipantVideo({ participant }: { participant: Participant }) {
  const videoRef = useRef<HTMLVideoElement>(null)

  useEffect(() => {
    const video = videoRef.current
    if (!video) return

    // Set the stream when available
    if (participant.stream) {
      video.srcObject = participant.stream
    }

    // Cleanup function
    return () => {
      if (video.srcObject) {
        const stream = video.srcObject as MediaStream
        stream.getTracks().forEach(track => track.stop())
        video.srcObject = null
      }
    }
  }, [participant.stream])

  return (
    <div className="relative bg-black rounded-lg overflow-hidden aspect-video">
      <video
        ref={videoRef}
        autoPlay
        playsInline
        className="w-full h-full object-cover"
      />
      <div className="absolute bottom-2 left-2 text-white bg-black/50 px-2 rounded text-sm">
        {participant.name}
      </div>
    </div>
  )
}

export default function RoomPage() {
  const params = useParams()
  const router = useRouter()
  const roomId = params.roomId as string
  const lang = params.lang as string

  // State
  const [roomInfo, setRoomInfo] = useState<PublicRoomInfo | null>(null)
  const [phase, setPhase] = useState<'setup' | 'lobby' | 'meeting'>('setup')
  const [name, setName] = useState('')
  const [password, setPassword] = useState('')
  const [isHost, setIsHost] = useState(false)
  const [isReady, setIsReady] = useState(false)
  const [showShareModal, setShowShareModal] = useState(false)
  
  // Meeting State
  const manager = MeetingManager.getInstance()
  const [meetingState, setMeetingState] = useState(manager.state)
  const localVideoRef = useRef<HTMLVideoElement>(null)

  const meetingLink = typeof window !== 'undefined'
    ? `${window.location.origin}/${lang}/room/${roomId}`
    : ''

  const handleGoHome = () => {
    manager.leave()
    router.push(`/${lang}`)
  }

  const handleShareMeeting = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: `Join ${roomInfo?.title || 'Meeting'}`,
          text: `Join my meeting room: ${roomInfo?.title || 'Meeting'}`,
          url: meetingLink
        })
      } catch (error) {
        console.log('Share canceled')
      }
    } else {
      setShowShareModal(true)
    }
  }

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(meetingLink)
      toast.success('Meeting link copied to clipboard')
    } catch (error) {
      toast.error('Failed to copy link')
    }
  }

  // 1. Fetch Room Info on Load
  useEffect(() => {
    const fetchRoom = async () => {
      const res = await fetch(`/api/rooms/${roomId}`)
      const data = await res.json()
      if (!data.success) {
        toast.error('Room not found')
        router.push(`/${lang}`)
        return
      }
      setRoomInfo(data.room)

      // Load stored user name
      const storedName = await secureStorage.getUserName()
      if (storedName) {
        setName(storedName)
      }

      // Check if we have a stored password for this room
      const hasAccess = await secureStorage.hasRoomAccess(roomId)
      if (hasAccess) {
        // Auto-fill with stored password
        const storedPassword = await secureStorage.getPassword(roomId)
        if (storedPassword) {
          setPassword(storedPassword)
        }
      }
    }
    fetchRoom()
    
    // Subscribe to Manager updates
    const unsub = manager.subscribe(() => {
      setMeetingState({ ...manager.state })
    })
    return () => { unsub() }
  }, [roomId, lang, router])

  // 2. Initialize Media Preview in Setup
  useEffect(() => {
    if (phase === 'setup') {
      manager.initializeMedia().then(() => {
        if (localVideoRef.current && manager.getLocalStream()) {
          localVideoRef.current.srcObject = manager.getLocalStream()
        }
      })
    }
  }, [phase])

  // 3. Handle Join Logic
  const handleJoin = async () => {
    if (!name) return toast.error('Name required')

    // Store user name for future use
    await secureStorage.storeUserName(name)

    // Try to verify as Host using password
    if (password) {
      // Try master password
      const res = await fetch(`/api/rooms/${roomId}?password=${password}`)
      const data = await res.json()
      if (data.isHost) {
        // Store password securely for future use
        await secureStorage.storePassword(roomId, password)
        await secureStorage.saveRoom({
          roomId,
          title: roomInfo?.title || '',
          createdAt: roomInfo?.createdAt || Date.now(),
          lastAccessed: Date.now()
        })
        
        setIsHost(true)
        setPhase('meeting')
        manager.startHosting(roomId, password, name, false)
        return
      } else {
        toast.error('Incorrect password')
        return
      }
    }

    // Join as Participant
    if (!roomInfo?.hostConnected && !roomInfo?.id /* Basic check if loaded */) {
      toast.error('Host is not online yet. Cannot join lobby.')
      return
    }

    // Need Host Peer ID to connect
    const res = await fetch(`/api/rooms/${roomId}`)
    const data = await res.json()
    
    if (data.hostPeerId) {
      manager.joinRoom(data.hostPeerId, name)
      setPhase('lobby')
    } else {
      toast.error("Waiting for host to come online...")
    }
  }

  // Effect to handle transition from Lobby -> Meeting
  useEffect(() => {
    if (phase === 'lobby' && meetingState.connectionState === 'active') {
      setPhase('meeting')
    }
  }, [meetingState.connectionState, phase])

  // --- RENDERERS ---

  if (!roomInfo) return <div className="flex h-screen items-center justify-center">Loading Room...</div>

  // SETUP PHASE
  if (phase === 'setup') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-purple-50">
        <SiteHeader lang={lang} />
        
        {/* Main Content */}
        <div className="flex flex-col items-center justify-center p-4 min-h-[calc(100vh-80px)]">
          <Card className="w-full max-w-2xl bg-white/80 backdrop-blur-xl shadow-2xl border-0">
            <CardHeader className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-t-lg">
              <CardTitle className="text-xl font-bold">{roomInfo.title}</CardTitle>
              <p className="text-blue-100 text-sm">Created {new Date(roomInfo.createdAt).toLocaleDateString()}</p>
            </CardHeader>
            <CardContent className="grid md:grid-cols-2 gap-8 p-8">
              {/* Video Preview */}
              <div className="bg-gradient-to-br from-gray-900 to-black rounded-2xl aspect-video overflow-hidden relative shadow-inner">
                <video ref={localVideoRef} autoPlay muted playsInline className="w-full h-full object-cover" />
                <div className="absolute bottom-6 left-0 right-0 flex justify-center gap-4">
                  <Button
                    variant="secondary"
                    size="icon"
                    onClick={() => manager.toggleAudio()}
                    className={`backdrop-blur-sm hover:bg-white/30 border-white/20 text-white ${
                      meetingState.isAudioMuted ? 'bg-red-500/30' : 'bg-white/20'
                    }`}
                  >
                    {meetingState.isAudioMuted ? <MicOff className="h-5 w-5" /> : <Mic className="h-5 w-5" />}
                  </Button>
                  <Button
                    variant="secondary"
                    size="icon"
                    onClick={() => manager.toggleVideo()}
                    className={`backdrop-blur-sm hover:bg-white/30 border-white/20 text-white ${
                      meetingState.isVideoMuted ? 'bg-red-500/30' : 'bg-white/20'
                    }`}
                  >
                    {meetingState.isVideoMuted ? <VideoOff className="h-5 w-5" /> : <VideoIcon className="h-5 w-5" />}
                  </Button>
                </div>
                <div className="absolute top-4 right-4 bg-red-500 text-white px-2 py-1 rounded-full text-xs font-medium">
                  PREVIEW
                </div>
              </div>

              {/* Form */}
              <div className="space-y-6 flex flex-col justify-center">
                <div className="space-y-2">
                  <label className="text-sm font-semibold text-gray-700">Display Name</label>
                  <Input
                    value={name}
                    onChange={e => setName(e.target.value)}
                    placeholder="Your Name"
                    className="h-12 text-lg"
                  />
                </div>
                
                <div className="space-y-2">
                  <label className="text-sm font-semibold text-gray-700 flex items-center gap-2">
                    <Key className="h-4 w-4 text-blue-600" /> Host Password (Optional)
                  </label>
                  <Input
                    type="password"
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    placeholder="Enter room password"
                    className="h-12"
                  />
                  <p className="text-xs text-gray-500 mt-2">
                    Enter the room password to host the meeting. Password will be stored securely.
                  </p>
                </div>

                <div className="pt-2">
                  <Button
                    className="w-full h-14 text-lg font-semibold bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 transition-all duration-200 shadow-lg"
                    size="lg"
                    onClick={handleJoin}
                  >
                    {password ? '🎥 Start Meeting as Host' : '👋 Ask to Join'}
                  </Button>
                </div>
                
                {!password && (
                  <p className="text-xs text-center text-gray-500 bg-blue-50 p-3 rounded-lg">
                    You will wait in the lobby until the host approves you.
                  </p>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    )
  }

  // LOBBY PHASE
  if (phase === 'lobby') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-purple-50">
        <SiteHeader lang={lang} />
        
        {/* Main Content */}
        <div className="flex flex-col items-center justify-center p-4 text-center min-h-[calc(100vh-80px)]">
          <div className="bg-white/80 backdrop-blur-xl p-8 rounded-full shadow-2xl mb-6 animate-pulse border border-indigo-100">
            <Users className="h-12 w-12 text-indigo-600" />
          </div>
          <h2 className="text-2xl font-bold mb-3 bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent">Waiting for Host Approval</h2>
          <p className="text-gray-600 mb-8 max-w-md">
            You are in the lobby for <strong className="text-indigo-600">{roomInfo.title}</strong>.
            Please wait while the host lets you in.
          </p>
          
          <Card className="bg-white/80 backdrop-blur-xl shadow-xl border-0 max-w-sm w-full mb-8">
            <CardContent className="p-6">
              <div className="flex justify-between items-center pb-3 mb-3 border-b border-blue-100">
                <span className="text-gray-500 font-medium">Start Time</span>
                <span className="text-gray-900 font-semibold">{new Date(roomInfo.createdAt).toLocaleTimeString()}</span>
              </div>
              <div className="flex justify-between items-center">
                 <span className="text-gray-500 font-medium">Duration</span>
                 <span className="text-gray-900 font-semibold">{(Date.now() - roomInfo.createdAt) / 60000 | 0} mins</span>
              </div>
            </CardContent>
          </Card>
          
          <Button
            variant="outline"
            onClick={() => { manager.leave(); setPhase('setup'); }}
            className="bg-white/90 backdrop-blur-sm hover:bg-white transition-all duration-200 shadow-md border-gray-200 px-6 py-3"
          >
            Cancel
          </Button>
        </div>
      </div>
    )
  }

  // MEETING PHASE
  return (
    <div className="h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 flex flex-col">
      {/* Header */}
      <div className="bg-gray-800/90 backdrop-blur-sm p-3 flex justify-between items-center text-white shadow-xl">
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            onClick={handleGoHome}
            className="text-gray-300 hover:text-white hover:bg-white/10 transition-all duration-200 px-4 py-2"
          >
            <Home className="w-4 h-4 mr-2" />
            <span>Leave</span>
          </Button>
          <div className="w-px h-6 bg-gray-600"></div>
          <div className="flex items-center gap-3">
            <div className="bg-gradient-to-r from-blue-600 to-purple-600 p-2 rounded-lg">
              <Users className="h-4 w-4" />
            </div>
            <div>
              <span className="font-normal text-base text-gray-200">{roomInfo.title}</span>
              <div className="flex items-center gap-2 mt-1">
                <span className={`px-2 py-1 rounded-full text-xs font-medium ${isHost ? 'bg-blue-600 text-white' : 'bg-purple-600 text-white'}`}>
                  {isHost ? '🎥 Host' : '👋 Guest'}
                </span>
              </div>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            onClick={handleShareMeeting}
            className="text-gray-300 hover:text-white hover:bg-white/10 transition-all duration-200 px-4 py-2"
          >
            <Share2 className="w-4 h-4 mr-2" />
            <span>Share</span>
          </Button>
          <div className="text-right">
            <div className="text-sm text-gray-400">Participants</div>
            <div className="text-lg font-normal text-gray-200">
              {isHost ? meetingState.participants.length : meetingState.participants.length + 1}
            </div>
          </div>
        </div>
      </div>

      {/* Main Grid */}
      <div className="flex-1 p-6 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 overflow-y-auto">
        {/* Local Video */}
        <div className="relative bg-black rounded-2xl overflow-hidden aspect-video border-2 border-blue-500 shadow-2xl">
          <video
            ref={(ref) => { if(ref && manager.getLocalStream()) ref.srcObject = manager.getLocalStream() }}
            autoPlay muted playsInline
            className="w-full h-full object-cover"
          />
          <div className="absolute bottom-4 left-4 text-white bg-black/70 backdrop-blur-sm px-3 py-2 rounded-lg text-sm font-medium">
            You ({name})
          </div>
          <div className="absolute top-4 left-4 bg-blue-500 text-white px-2 py-1 rounded-full text-xs font-medium">
            YOU
          </div>
        </div>

        {/* Remote Participants */}
        {meetingState.participants.filter(p => isHost ? p.role !== 'host' : p.id !== manager.getPeerId()).map(p => (
          <div key={p.id} className="relative bg-black rounded-2xl overflow-hidden aspect-video shadow-2xl">
            <ParticipantVideo key={p.id} participant={p} />
          </div>
        ))}
      </div>

      {/* Host Controls: Lobby List */}
      {isHost && meetingState.waitingPeers.length > 0 && (
        <div className="absolute top-24 right-6 w-80 bg-white/95 backdrop-blur-sm rounded-2xl shadow-2xl overflow-hidden z-50 border border-white/20">
          <div className="bg-gradient-to-r from-blue-600 to-purple-600 text-white p-4 font-bold flex justify-between items-center">
            <span className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              Lobby ({meetingState.waitingPeers.length})
            </span>
          </div>
          <div className="max-h-72 overflow-y-auto">
            {meetingState.waitingPeers.map(peer => (
              <div key={peer.peerId} className="p-4 border-b border-gray-100 flex justify-between items-center hover:bg-gray-50 transition-colors">
                <div className="flex items-center gap-3">
                  <div className="bg-blue-100 p-2 rounded-full">
                    <User className="h-4 w-4 text-blue-600" />
                  </div>
                  <div>
                    <span className="font-medium text-gray-900">{peer.name}</span>
                    <div className="text-xs text-gray-500">Waiting to join</div>
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button size="icon" className="h-9 w-9 bg-green-500 hover:bg-green-600 text-white rounded-lg" onClick={() => manager.approveParticipant(peer.peerId)}>
                    <Check className="h-4 w-4" />
                  </Button>
                  <Button size="icon" className="h-9 w-9 bg-red-500 hover:bg-red-600 text-white rounded-lg" onClick={() => manager.rejectParticipant(peer.peerId)}>
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Footer Controls */}
      <div className="bg-gray-800/90 backdrop-blur-sm p-6 flex justify-center gap-6 shadow-xl">
        <Button
          variant="secondary"
          size="icon"
          onClick={() => manager.toggleAudio()}
          className={`h-14 w-14 backdrop-blur-sm hover:bg-white/20 text-white border-white/20 rounded-full ${
            meetingState.isAudioMuted ? 'bg-red-500/20 hover:bg-red-500/30 border-red-500/30' : 'bg-white/10'
          }`}
        >
           {meetingState.isAudioMuted ? <MicOff className="h-6 w-6" /> : <Mic className="h-6 w-6" />}
        </Button>
        <Button
          variant="secondary"
          size="icon"
          onClick={() => manager.toggleVideo()}
          className={`h-14 w-14 backdrop-blur-sm hover:bg-white/20 text-white border-white/20 rounded-full ${
            meetingState.isVideoMuted ? 'bg-red-500/20 hover:bg-red-500/30 border-red-500/30' : 'bg-white/10'
          }`}
        >
           {meetingState.isVideoMuted ? <VideoOff className="h-6 w-6" /> : <VideoIcon className="h-6 w-6" />}
        </Button>
        <Button
          variant="destructive"
          size="icon"
          onClick={handleGoHome}
          className="h-14 w-14 bg-red-500 hover:bg-red-600 text-white rounded-full shadow-lg"
        >
           <PhoneOff className="h-6 w-6" />
        </Button>
      </div>

      {/* Share Modal */}
      {showShareModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <Card className="w-full max-w-md bg-white/95 backdrop-blur-xl shadow-2xl border-0">
            <CardHeader className="text-center pb-4">
              <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <Share2 className="w-6 h-6 text-blue-600" />
              </div>
              <CardTitle className="text-xl font-bold">Share Meeting</CardTitle>
              <p className="text-gray-500 text-sm">
                Invite others to join "{roomInfo?.title}"
              </p>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="bg-gray-50 p-4 rounded-lg">
                <p className="text-xs text-gray-500 mb-2">Meeting Link</p>
                <div className="flex items-center gap-2">
                  <Input
                    value={meetingLink}
                    readOnly
                    className="bg-white border-gray-200 text-sm"
                  />
                  <Button
                    size="icon"
                    variant="outline"
                    onClick={handleCopyLink}
                    className="shrink-0"
                  >
                    <Copy className="w-4 h-4" />
                  </Button>
                </div>
              </div>
              
              <div className="flex flex-col items-center">
                <p className="text-xs text-gray-500 mb-4">Scan QR Code</p>
                <QRCodeGenerator
                  url={meetingLink}
                  size={200}
                  scanText="Scan with mobile camera to join"
                />
              </div>

              <div className="flex gap-3 pt-4">
                <Button
                  variant="outline"
                  onClick={() => setShowShareModal(false)}
                  className="flex-1"
                >
                  Close
                </Button>
                <Button
                  onClick={handleCopyLink}
                  className="flex-1 bg-blue-600 hover:bg-blue-700"
                >
                  Copy Link
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  )
}