'use client'

import { useState, useEffect, useRef } from 'react'
import { useParams, useRouter } from 'next/navigation'
import MeetingManager from '@/services/meeting-manager'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Mic, MicOff, Video as VideoIcon, VideoOff, PhoneOff, Check, X, Users, Lock, User, Key } from 'lucide-react'
import { toast } from 'sonner'
import { PublicRoomInfo, Participant } from '@/lib/types'
import { secureStorage } from '@/lib/secure-storage'

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
  
  // Meeting State
  const manager = MeetingManager.getInstance()
  const [meetingState, setMeetingState] = useState(manager.state)
  const localVideoRef = useRef<HTMLVideoElement>(null)

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
      <div className="min-h-screen bg-gray-100 flex flex-col items-center justify-center p-4">
        <Card className="w-full max-w-2xl bg-white shadow-xl">
          <CardHeader>
            <CardTitle>{roomInfo.title}</CardTitle>
            <p className="text-sm text-gray-500">Created {new Date(roomInfo.createdAt).toLocaleDateString()}</p>
          </CardHeader>
          <CardContent className="grid md:grid-cols-2 gap-6">
            {/* Video Preview */}
            <div className="bg-black rounded-lg aspect-video overflow-hidden relative">
              <video ref={localVideoRef} autoPlay muted playsInline className="w-full h-full object-cover" />
              <div className="absolute bottom-4 left-0 right-0 flex justify-center gap-2">
                <Button variant="secondary" size="icon" onClick={() => manager.toggleAudio()}>
                  <Mic className="h-4 w-4" />
                </Button>
                <Button variant="secondary" size="icon" onClick={() => manager.toggleVideo()}>
                  <VideoIcon className="h-4 w-4" />
                </Button>
              </div>
            </div>

            {/* Form */}
            <div className="space-y-4 flex flex-col justify-center">
              <div>
                <label className="text-sm font-medium">Display Name</label>
                <Input value={name} onChange={e => setName(e.target.value)} placeholder="Your Name" />
              </div>
              
              <div>
                <label className="text-sm font-medium flex items-center gap-2">
                  <Key className="h-3 w-3" /> Host Password (Optional)
                </label>
                <Input
                  type="password"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="Enter room password"
                />
                <p className="text-xs text-gray-500 mt-1">
                  Enter the room password to host the meeting. Password will be stored securely.
                </p>
              </div>

              <div className="pt-4">
                <Button className="w-full" size="lg" onClick={handleJoin}>
                  {password ? 'Start Meeting as Host' : 'Ask to Join'}
                </Button>
              </div>
              
              {!password && (
                <p className="text-xs text-center text-gray-500">
                  You will wait in the lobby until the host approves you.
                </p>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  // LOBBY PHASE
  if (phase === 'lobby') {
    return (
      <div className="min-h-screen bg-blue-50 flex flex-col items-center justify-center p-4 text-center">
        <div className="bg-white p-8 rounded-full shadow-lg mb-6 animate-pulse">
          <Users className="h-12 w-12 text-blue-500" />
        </div>
        <h2 className="text-2xl font-bold mb-2">Waiting for Host Approval</h2>
        <p className="text-gray-600 mb-8 max-w-md">
          You are in the lobby for <strong>{roomInfo.title}</strong>.
          Please wait while the host lets you in.
        </p>
        
        <div className="bg-white p-4 rounded-lg shadow-sm border max-w-sm w-full">
          <div className="flex justify-between border-b pb-2 mb-2">
            <span className="text-gray-500">Start Time</span>
            <span>{new Date(roomInfo.createdAt).toLocaleTimeString()}</span>
          </div>
          <div className="flex justify-between">
             <span className="text-gray-500">Duration</span>
             <span>{(Date.now() - roomInfo.createdAt) / 60000 | 0} mins</span>
          </div>
        </div>
        
        <Button variant="outline" className="mt-8" onClick={() => { manager.leave(); setPhase('setup'); }}>
          Cancel
        </Button>
      </div>
    )
  }

  // MEETING PHASE
  return (
    <div className="h-screen bg-gray-900 flex flex-col">
      {/* Header */}
      <div className="bg-gray-800 p-4 flex justify-between items-center text-white">
        <div className="flex items-center gap-2">
          <span className="font-bold">{roomInfo.title}</span>
          <span className="bg-gray-700 px-2 py-0.5 rounded text-xs">
            {isHost ? 'Host' : 'Guest'}
          </span>
        </div>
        <div className="text-sm text-gray-400">
          {isHost ? meetingState.participants.length : meetingState.participants.length + 1} Participants
        </div>
      </div>

      {/* Main Grid */}
      <div className="flex-1 p-4 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 overflow-y-auto">
        {/* Local Video */}
        <div className="relative bg-black rounded-lg overflow-hidden aspect-video border-2 border-blue-500">
          <video
            ref={(ref) => { if(ref && manager.getLocalStream()) ref.srcObject = manager.getLocalStream() }}
            autoPlay muted playsInline
            className="w-full h-full object-cover"
          />
          <div className="absolute bottom-2 left-2 text-white bg-black/50 px-2 rounded text-sm">
            You ({name})
          </div>
        </div>

        {/* Remote Participants */}
        {meetingState.participants.filter(p => isHost ? p.role !== 'host' : p.id !== manager.getPeerId()).map(p => (
          <ParticipantVideo key={p.id} participant={p} />
        ))}
      </div>

      {/* Host Controls: Lobby List */}
      {isHost && meetingState.waitingPeers.length > 0 && (
        <div className="absolute top-16 right-4 w-72 bg-white rounded-lg shadow-xl overflow-hidden z-50">
          <div className="bg-blue-600 text-white p-3 font-bold flex justify-between">
            <span>Lobby ({meetingState.waitingPeers.length})</span>
          </div>
          <div className="max-h-60 overflow-y-auto">
            {meetingState.waitingPeers.map(peer => (
              <div key={peer.peerId} className="p-3 border-b flex justify-between items-center">
                <div className="flex items-center gap-2">
                  <User className="h-4 w-4 text-gray-500" />
                  <span className="font-medium text-sm">{peer.name}</span>
                </div>
                <div className="flex gap-1">
                  <Button size="icon" variant="ghost" className="h-8 w-8 text-green-600" onClick={() => manager.approveParticipant(peer.peerId)}>
                    <Check className="h-4 w-4" />
                  </Button>
                  <Button size="icon" variant="ghost" className="h-8 w-8 text-red-600" onClick={() => manager.rejectParticipant(peer.peerId)}>
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Footer Controls */}
      <div className="bg-gray-800 p-4 flex justify-center gap-4">
        <Button variant="secondary" size="icon" onClick={() => manager.toggleAudio()}>
           <Mic className="h-5 w-5" />
        </Button>
        <Button variant="secondary" size="icon" onClick={() => manager.toggleVideo()}>
           <VideoIcon className="h-5 w-5" />
        </Button>
        <Button variant="destructive" size="icon" onClick={() => { manager.leave(); router.push('/'); }}>
           <PhoneOff className="h-5 w-5" />
        </Button>
      </div>
    </div>
  )
}