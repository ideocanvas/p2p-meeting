'use client'

import { useState, useEffect, useRef } from 'react'
import { useParams, useRouter } from 'next/navigation'
import MeetingManager from '@/services/meeting-manager'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Mic, MicOff, Video as VideoIcon, VideoOff, PhoneOff,
  Check, X, Users, Key, QrCode, Copy, Share2
} from 'lucide-react'
import { toast } from 'sonner'
import { PublicRoomInfo, Participant } from '@/lib/types'
import { secureStorage } from '@/lib/secure-storage'
import { QRCodeGenerator } from '@/components/qr-code-generator'

// Helper to generate initials
const getInitials = (name: string) => {
  return name
    .split(' ')
    .map(n => n[0])
    .join('')
    .substring(0, 2)
    .toUpperCase();
}

// 1. Participant Tile Component (Updated)
function ParticipantVideo({ participant }: { participant: Participant }) {
  const videoRef = useRef<HTMLVideoElement>(null)

  useEffect(() => {
    const video = videoRef.current
    if (!video) return

    if (participant.stream) {
      video.srcObject = participant.stream
    }
    
    return () => {
      if (video && video.srcObject) {
        const stream = video.srcObject as MediaStream
        stream.getTracks().forEach(track => track.stop())
        video.srcObject = null
      }
    }
  }, [participant.stream])

  return (
    <div className="relative bg-gray-900 rounded-xl overflow-hidden aspect-video shadow-sm border border-gray-800 flex items-center justify-center">
      {participant.hasVideo && participant.stream ? (
        <video
          ref={videoRef}
          autoPlay
          playsInline
          className="w-full h-full object-cover"
        />
      ) : (
        /* AVATAR STATE */
        <div className="flex flex-col items-center justify-center w-full h-full bg-gray-800">
           <div className="w-20 h-20 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center shadow-lg">
              <span className="text-2xl font-bold text-white tracking-widest">
                {getInitials(participant.name)}
              </span>
           </div>
           <p className="mt-3 text-gray-400 text-sm font-medium">Camera Off</p>
        </div>
      )}

      {/* Name Tag & Status Icons */}
      <div className="absolute bottom-2 left-2 right-2 flex justify-between items-end">
        <div className="bg-black/60 backdrop-blur-sm px-2 py-1 rounded text-xs text-white font-medium truncate max-w-[120px]">
          {participant.name}
        </div>
        <div className="flex gap-1">
            {!participant.hasAudio && (
              <div className="bg-red-500/90 p-1.5 rounded-full shadow-sm">
                <MicOff className="w-3 h-3 text-white"/>
              </div>
            )}
        </div>
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
  const [showLobbyMobile, setShowLobbyMobile] = useState(false)
  const [showQR, setShowQR] = useState(false)
  
  // Meeting State
  const manager = MeetingManager.getInstance()
  const [meetingState, setMeetingState] = useState(manager.state)
  const localVideoRef = useRef<HTMLVideoElement>(null)
  
  // Track local media state for UI
  const [localVideoEnabled, setLocalVideoEnabled] = useState(true)
  const [localAudioEnabled, setLocalAudioEnabled] = useState(true)

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
      setShowQR(true)
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
    
    // Subscribe to Manager Updates
    const unsub = manager.subscribe(() => {
      setMeetingState({ ...manager.state })
      
      // Sync local controls state
      const stream = manager.getLocalStream()
      if (stream) {
         setLocalVideoEnabled(stream.getVideoTracks()[0]?.enabled ?? false)
         setLocalAudioEnabled(stream.getAudioTracks()[0]?.enabled ?? false)
      }
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
      <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-blue-50 flex flex-col">
        {/* Minimal Header */}
        <div className="bg-white/70 backdrop-blur-md border-b border-white/20 p-4 sticky top-0 z-10">
           <div className="max-w-4xl mx-auto flex items-center justify-between">
              <div className="flex items-center gap-2" onClick={handleGoHome}>
                 <div className="bg-indigo-600 p-1.5 rounded-lg text-white"><VideoIcon className="w-4 h-4" /></div>
                 <span className="font-semibold text-gray-800">{roomInfo.title}</span>
              </div>
              <Button variant="ghost" size="icon" onClick={handleGoHome}><X className="w-5 h-5 text-gray-500" /></Button>
           </div>
        </div>

        <div className="flex-1 flex items-center justify-center p-4">
          <Card className="w-full max-w-4xl bg-white/80 backdrop-blur-xl shadow-2xl border-white/20 overflow-hidden">
            <CardContent className="grid md:grid-cols-2 gap-0 p-0">
              {/* Preview Area */}
              <div className="relative bg-black aspect-[4/3] md:aspect-auto md:h-full order-first md:order-last flex items-center justify-center">
                {localVideoEnabled ? (
                    <video ref={localVideoRef} autoPlay muted playsInline className="w-full h-full object-cover" />
                ) : (
                    <div className="flex flex-col items-center justify-center">
                        <div className="w-24 h-24 rounded-full bg-gray-700 flex items-center justify-center mb-2">
                             <span className="text-2xl text-white font-bold">{getInitials(name || 'Me')}</span>
                        </div>
                        <span className="text-gray-400 text-sm">Camera is off</span>
                    </div>
                )}
                
                <div className="absolute bottom-4 left-0 right-0 flex justify-center gap-4 z-10">
                  <Button
                    variant={localAudioEnabled ? "secondary" : "destructive"}
                    size="icon"
                    className="rounded-full w-12 h-12 transition-all"
                    onClick={() => manager.toggleAudio()}
                  >
                    {localAudioEnabled ? <Mic className="h-5 w-5" /> : <MicOff className="h-5 w-5" />}
                  </Button>
                  <Button
                    variant={localVideoEnabled ? "secondary" : "destructive"}
                    size="icon"
                    className="rounded-full w-12 h-12 transition-all"
                    onClick={() => manager.toggleVideo()}
                  >
                    {localVideoEnabled ? <VideoIcon className="h-5 w-5" /> : <VideoOff className="h-5 w-5" />}
                  </Button>
                </div>
              </div>

              {/* Form Area */}
              <div className="p-6 md:p-8 flex flex-col justify-center space-y-6">
                <div>
                  <h2 className="text-2xl font-bold text-gray-900 mb-2">Ready to join?</h2>
                  <p className="text-gray-500 text-sm">Configure your settings before entering.</p>
                </div>

                <div className="space-y-4">
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-gray-700">Display Name</label>
                    <Input
                      value={name}
                      onChange={e => setName(e.target.value)}
                      placeholder="e.g. Alex Smith"
                      className="h-12 text-lg bg-white/50"
                    />
                  </div>
                  
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-gray-700 flex items-center gap-2">
                      <Key className="h-4 w-4 text-indigo-600" /> Host Password (Optional)
                    </label>
                    <Input
                      type="password"
                      value={password}
                      onChange={e => setPassword(e.target.value)}
                      placeholder="Enter only if you are the host"
                      className="h-12 bg-white/50"
                    />
                  </div>
                </div>

                <Button
                  className="w-full h-14 text-lg font-semibold bg-indigo-600 hover:bg-indigo-700 shadow-lg shadow-indigo-500/20"
                  size="lg"
                  onClick={handleJoin}
                >
                  {password ? 'Start as Host' : 'Join Meeting'}
                </Button>
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
      <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-4 text-center">
         <div className="bg-white p-8 rounded-2xl shadow-xl max-w-sm w-full space-y-6">
            <div className="w-16 h-16 bg-blue-50 rounded-full flex items-center justify-center mx-auto animate-pulse">
               <Users className="w-8 h-8 text-blue-500" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-gray-900">Waiting for Host</h2>
              <p className="text-gray-500 mt-2 text-sm">You are in the lobby for <strong className="text-gray-800">{roomInfo.title}</strong>.</p>
            </div>
            <Button variant="outline" onClick={() => { manager.leave(); setPhase('setup'); }} className="w-full">
               Cancel Request
            </Button>
         </div>
      </div>
    )
  }

  // MEETING PHASE
  return (
    <div className="fixed inset-0 bg-black flex flex-col touch-none">
      {/* 1. Mobile-friendly Header */}
      <div className="absolute top-0 left-0 right-0 z-50 p-4 bg-gradient-to-b from-black/80 to-transparent flex justify-between items-start pointer-events-none">
        <div className="flex flex-col pointer-events-auto">
          <span className="text-white font-bold text-shadow-sm">{roomInfo.title}</span>
          <span className="text-white/60 text-xs flex items-center gap-1">
             <div className={`w-2 h-2 rounded-full ${isHost ? 'bg-blue-500' : 'bg-green-500'}`}></div>
             {isHost ? 'Host' : 'Participant'}
          </span>
        </div>
        
        <div className="flex gap-2 pointer-events-auto">
            {/* QR Code / Share Button */}
            <Button
                size="sm"
                variant="secondary"
                className="bg-white/10 backdrop-blur-md text-white border-white/10"
                onClick={() => setShowQR(true)}
            >
                <QrCode className="w-4 h-4" />
            </Button>

            {/* Mobile Lobby Toggle (Host Only) */}
            {isHost && (
            <Button
                size="sm"
                variant="secondary"
                className="bg-white/10 backdrop-blur-md text-white border-white/10 relative"
                onClick={() => setShowLobbyMobile(!showLobbyMobile)}
            >
                <Users className="w-4 h-4 mr-1" />
                {meetingState.waitingPeers.length > 0 && (
                <span className="absolute -top-1 -right-1 flex h-3 w-3">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-3 w-3 bg-red-500"></span>
                </span>
                )}
                <span className="hidden sm:inline">Lobby</span>
            </Button>
            )}
        </div>
      </div>

      {/* 2. Video Grid - Responsive */}
      <div className="flex-1 overflow-y-auto p-2 sm:p-4 mt-12 mb-20 scrollbar-hide">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 sm:gap-4 auto-rows-fr max-w-7xl mx-auto h-full content-center">
          
          {/* Local User */}
          <div className="relative bg-gray-900 rounded-xl overflow-hidden aspect-video sm:aspect-auto border-2 border-indigo-500/50 shadow-lg flex items-center justify-center">
            {localVideoEnabled ? (
                <video
                    ref={(ref) => { if(ref && manager.getLocalStream()) ref.srcObject = manager.getLocalStream() }}
                    autoPlay muted playsInline
                    className="w-full h-full object-cover transform scale-x-[-1]"
                />
            ) : (
                <div className="flex flex-col items-center justify-center w-full h-full bg-gray-800">
                   <div className="w-20 h-20 rounded-full bg-indigo-600 flex items-center justify-center shadow-lg border-2 border-white/20">
                      <span className="text-2xl font-bold text-white tracking-widest">{getInitials(name || 'Me')}</span>
                   </div>
                   <p className="mt-2 text-white/50 text-xs">You</p>
                </div>
            )}
            
            <div className="absolute bottom-2 left-2 text-white bg-black/60 px-2 py-0.5 rounded text-xs font-medium">
              You
            </div>
          </div>

          {/* Remote Participants */}
          {meetingState.participants
            .filter(p => isHost ? p.role !== 'host' : p.id !== manager.getPeerId())
            .map(p => (
              <ParticipantVideo key={p.id} participant={p} />
          ))}

          {/* Empty State / Waiting for others */}
          {meetingState.participants.length <= 1 && (
            <div className="flex flex-col items-center justify-center text-white/50 bg-white/5 rounded-xl border border-white/10 aspect-video sm:aspect-auto p-4 text-center">
               <div className="bg-white/10 p-3 rounded-full mb-2">
                 <QrCode className="w-6 h-6" />
               </div>
               <p className="text-sm">Scan to join</p>
               <Button
                 variant="link"
                 className="text-blue-400 h-auto p-0 text-xs mt-1"
                 onClick={() => setShowQR(true)}
               >
                 Show QR Code
               </Button>
            </div>
          )}
        </div>
      </div>

      {/* 3. Host Lobby Modal (Mobile/Desktop Overlay) */}
      {isHost && showLobbyMobile && (
        <div className="absolute inset-0 z-40 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200">
           <div className="bg-white rounded-2xl w-full max-w-sm overflow-hidden shadow-2xl">
              <div className="p-4 border-b flex justify-between items-center bg-gray-50">
                 <h3 className="font-bold text-gray-900">Waiting Room ({meetingState.waitingPeers.length})</h3>
                 <Button variant="ghost" size="sm" onClick={() => setShowLobbyMobile(false)}><X className="w-4 h-4"/></Button>
              </div>
              <div className="max-h-[60vh] overflow-y-auto p-2">
                 {meetingState.waitingPeers.length === 0 ? (
                    <div className="text-center py-8 text-gray-500 text-sm">No one is waiting.</div>
                 ) : (
                   meetingState.waitingPeers.map(peer => (
                     <div key={peer.peerId} className="flex items-center justify-between p-3 border-b border-gray-100 last:border-0 hover:bg-gray-50 rounded-lg">
                        <div className="flex items-center gap-3">
                           <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 font-bold text-xs">
                              {peer.name.charAt(0).toUpperCase()}
                           </div>
                           <span className="font-medium text-sm text-gray-900">{peer.name}</span>
                        </div>
                        <div className="flex gap-2">
                           <Button size="icon" className="h-8 w-8 bg-green-500 hover:bg-green-600 text-white rounded-full" onClick={() => manager.approveParticipant(peer.peerId)}>
                             <Check className="h-4 w-4" />
                           </Button>
                           <Button size="icon" variant="destructive" className="h-8 w-8 rounded-full" onClick={() => manager.rejectParticipant(peer.peerId)}>
                             <X className="h-4 w-4" />
                           </Button>
                        </div>
                     </div>
                   ))
                 )}
              </div>
           </div>
        </div>
      )}

      {/* 4. QR Code Modal */}
      {showQR && (
        <div className="absolute inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200" onClick={() => setShowQR(false)}>
           <div className="bg-white rounded-2xl w-full max-w-sm overflow-hidden shadow-2xl" onClick={e => e.stopPropagation()}>
              <div className="p-4 border-b flex justify-between items-center">
                 <h3 className="font-bold text-gray-900">Scan to Join</h3>
                 <Button variant="ghost" size="sm" onClick={() => setShowQR(false)}><X className="w-4 h-4"/></Button>
              </div>
              <div className="p-6 flex flex-col items-center space-y-4">
                 <div className="p-2 bg-white rounded-xl shadow-inner border">
                    <QRCodeGenerator url={typeof window !== 'undefined' ? window.location.href : ''} size={200} />
                 </div>
                 <p className="text-center text-sm text-gray-500">
                    Scan this QR code with your mobile camera to join <strong>{roomInfo.title}</strong> instantly.
                 </p>
                 <div className="flex w-full gap-2">
                    <Button
                        variant="outline"
                        className="flex-1"
                        onClick={() => {
                            navigator.clipboard.writeText(window.location.href);
                            toast.success("Link copied");
                        }}
                    >
                        <Copy className="w-4 h-4 mr-2" /> Copy Link
                    </Button>
                     <Button
                        variant="outline"
                        className="flex-1"
                        onClick={() => {
                            if (navigator.share) {
                                navigator.share({
                                    title: `Join ${roomInfo.title}`,
                                    url: window.location.href
                                });
                            } else {
                                toast.info("Sharing not supported on this device");
                            }
                        }}
                    >
                        <Share2 className="w-4 h-4 mr-2" /> Share
                    </Button>
                 </div>
              </div>
           </div>
        </div>
      )}

      {/* 5. Bottom Controls - Floating & Safe Area */}
      <div className="fixed bottom-6 left-4 right-4 z-50 flex justify-center pb-safe">
        <div className="bg-black/80 backdrop-blur-xl border border-white/10 rounded-full px-6 py-3 shadow-2xl flex items-center gap-4 sm:gap-6">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => manager.toggleAudio()}
            className={`h-12 w-12 rounded-full transition-all ${
               !localAudioEnabled
               ? 'bg-red-500/90 text-white hover:bg-red-600'
               : 'bg-white/10 text-white hover:bg-white/20'
            }`}
          >
             {!localAudioEnabled ? <MicOff className="h-5 w-5" /> : <Mic className="h-5 w-5" />}
          </Button>
          
          <Button
            variant="ghost"
            size="icon"
            onClick={() => manager.toggleVideo()}
            className={`h-12 w-12 rounded-full transition-all ${
               !localVideoEnabled
               ? 'bg-red-500/90 text-white hover:bg-red-600'
               : 'bg-white/10 text-white hover:bg-white/20'
            }`}
          >
             {!localVideoEnabled ? <VideoOff className="h-5 w-5" /> : <VideoIcon className="h-5 w-5" />}
          </Button>

          <div className="w-px h-8 bg-white/20 mx-1"></div>

          <Button
            variant="destructive"
            size="icon"
            onClick={handleGoHome}
            className="h-12 w-12 rounded-full bg-red-600 hover:bg-red-700 shadow-lg shadow-red-500/20"
          >
             <PhoneOff className="h-5 w-5" />
          </Button>
        </div>
      </div>

    </div>
  )
}