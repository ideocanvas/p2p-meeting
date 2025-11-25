'use client'

import { useState, useEffect, useRef } from 'react'
import { useParams, useRouter } from 'next/navigation'
import MeetingManager from '@/services/meeting-manager'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent } from '@/components/ui/card'
import {
  Mic, MicOff, Video as VideoIcon, VideoOff, PhoneOff,
  Check, X, Users, Key, QrCode, Copy, Share2, MessageSquare, Send, Monitor, MonitorOff
} from 'lucide-react'
import { toast } from 'sonner'
import { PublicRoomInfo, Participant, ChatMessage } from '@/lib/types'
import { secureStorage } from '@/lib/secure-storage'
import { QRCodeGenerator } from '@/components/qr-code-generator'
import { ScrollArea } from '@/components/ui/scroll-area'
import { VideoPlayer } from '@/components/video-player'
import { getTranslations } from '@/lib/client-i18n'

const getInitials = (name: string) => {
  return (name || 'User')
    .split(' ')
    .map(n => n[0])
    .join('')
    .substring(0, 2)
    .toUpperCase();
}

// 1. Participant Tile Component (Updated)
function ParticipantVideo({ participant }: { participant: Participant }) {
  return (
    <VideoPlayer
      stream={participant.stream || null}
      isLocal={false}
      name={participant.name}
      className={`${participant.isScreenSharing ? 'col-span-1 sm:col-span-2 row-span-2' : 'aspect-video'}`}
      isScreenSharing={participant.isScreenSharing}
      hasAudio={participant.hasAudio}
      isVideoEnabled={participant.hasVideo} // Pass the status here
    />
  )
}

export default function RoomPage() {
  const params = useParams()
  const router = useRouter()
  const roomId = params.roomId as string
  const lang = params.lang as string
  const [t, setT] = useState(() => getTranslations(lang as 'en' | 'zh'))
  
  useEffect(() => {
    setT(() => getTranslations(lang as 'en' | 'zh'))
  }, [lang])

  // State
  const [roomInfo, setRoomInfo] = useState<PublicRoomInfo | null>(null)
  const [phase, setPhase] = useState<'setup' | 'lobby' | 'meeting'>('setup')
  const [name, setName] = useState('')
  const [password, setPassword] = useState('')
  const [isHost, setIsHost] = useState(false)
  const [showLobbyMobile, setShowLobbyMobile] = useState(false)
  const [showQR, setShowQR] = useState(false)
  const [showChat, setShowChat] = useState(false)
  const [chatInput, setChatInput] = useState('')
  
  // Meeting State
  const manager = MeetingManager.getInstance()
  const [meetingState, setMeetingState] = useState(manager.state)
  const localVideoRef = useRef<HTMLVideoElement>(null)
  
  // Track local media state for UI
  const [localVideoEnabled, setLocalVideoEnabled] = useState(true)
  const [localAudioEnabled, setLocalAudioEnabled] = useState(true)
  const chatScrollRef = useRef<HTMLDivElement>(null)

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
          title: `${t("room.join")} ${roomInfo?.title || t("room.title")}`,
          text: `${t("room.joinMyMeeting")} ${roomInfo?.title || t("room.title")}`,
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
      toast.success(t("room.meetingLinkCopied"))
    } catch (error) {
      toast.error(t("room.failedToCopyLink"))
    }
  }

  // Scroll to bottom of chat
  useEffect(() => {
    if (chatScrollRef.current) {
        chatScrollRef.current.scrollTop = chatScrollRef.current.scrollHeight
    }
  }, [meetingState.messages, showChat])

  // 1. Fetch Room Info on Load
  useEffect(() => {
    const fetchRoom = async () => {
      const res = await fetch(`/api/rooms/${roomId}`)
      const data = await res.json()
      if (!data.success) {
        toast.error(t("errors.roomNotFound"))
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
      
      const stream = manager.getLocalStream()
      if (stream) {
         setLocalVideoEnabled(!manager.state.isVideoMuted)
         setLocalAudioEnabled(!manager.state.isAudioMuted)
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
    if (!name) return toast.error(t("room.nameRequired"))

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
        toast.error(t("room.incorrectPassword"))
        return
      }
    }

    // Join as Participant
    if (!roomInfo?.hostConnected && !roomInfo?.id /* Basic check if loaded */) {
      toast.error(t("room.hostNotOnline"))
      return
    }

    // Need Host Peer ID to connect
    const res = await fetch(`/api/rooms/${roomId}`)
    const data = await res.json()
    
    if (data.hostPeerId) {
      // Save room to participant's history
      await secureStorage.saveRoom({
        roomId,
        title: roomInfo?.title || '',
        createdAt: roomInfo?.createdAt || Date.now(),
        lastAccessed: Date.now()
      })
      
      manager.joinRoom(data.hostPeerId, name)
      setPhase('lobby')
    } else {
      toast.error(t("room.waitingForHostOnline"))
    }
  }

  // Effect to handle transition from Lobby -> Meeting
  useEffect(() => {
    if (phase === 'lobby' && meetingState.connectionState === 'active') {
      setPhase('meeting')
    }
  }, [meetingState.connectionState, phase])

  const handleSendMessage = (e?: React.FormEvent) => {
      e?.preventDefault()
      if (!chatInput.trim()) return
      manager.sendMessage(chatInput)
      setChatInput('')
  }

  // --- RENDERERS ---

  if (!roomInfo) return <div className="flex h-screen items-center justify-center">{t("common.loading")}</div>

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
                <VideoPlayer
                  stream={localVideoRef.current ? manager.getLocalStream() : null}
                  isLocal={true}
                  name={name || t("room.you")}
                  className="aspect-[4/3] md:aspect-auto md:h-full"
                />
                
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
                  <h2 className="text-2xl font-bold text-gray-900 mb-2">{t("room.readyToJoin")}</h2>
                  <p className="text-gray-500 text-sm">{t("room.configureSettings")}</p>
                </div>

                <div className="space-y-4">
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-gray-700">{t("room.displayName")}</label>
                    <Input
                      value={name}
                      onChange={e => setName(e.target.value)}
                      placeholder={t("room.namePlaceholder")}
                      className="h-12 text-lg bg-white/50"
                    />
                  </div>
                  
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-gray-700 flex items-center gap-2">
                      <Key className="h-4 w-4 text-indigo-600" /> {t("room.hostPassword")}
                    </label>
                    <Input
                      type="password"
                      value={password}
                      onChange={e => setPassword(e.target.value)}
                      placeholder={t("room.hostPasswordPlaceholder")}
                      className="h-12 bg-white/50"
                    />
                  </div>
                </div>

                <Button
                  className="w-full h-14 text-lg font-semibold bg-indigo-600 hover:bg-indigo-700 shadow-lg shadow-indigo-500/20"
                  size="lg"
                  onClick={handleJoin}
                >
                  {password ? t("room.startAsHost") : t("room.joinMeeting")}
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
              <h2 className="text-xl font-bold text-gray-900">{t("room.waitingForHost")}</h2>
              <p className="text-gray-500 mt-2 text-sm">{t("room.waitingForHostText")} <strong className="text-gray-800">{roomInfo.title}</strong>.</p>
            </div>
            <Button variant="outline" onClick={() => { manager.leave(); setPhase('setup'); }} className="w-full">
               {t("room.cancelRequest")}
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
             {isHost ? t("room.host") : t("room.participant")}
          </span>
        </div>
        
        <div className="flex gap-2 pointer-events-auto">
            <Button size="icon" variant="ghost" className="text-white hover:bg-white/10" onClick={() => setShowQR(true)}>
                <QrCode className="w-5 h-5" />
            </Button>
            
            <Button
                size="icon"
                variant="ghost"
                className={`text-white hover:bg-white/10 relative ${showChat ? 'bg-white/20' : ''}`}
                onClick={() => setShowChat(!showChat)}
            >
                <MessageSquare className="w-5 h-5" />
                {meetingState.messages.length > 0 && (
                   <span className="absolute top-1 right-1 w-2.5 h-2.5 bg-red-500 rounded-full border-2 border-black"></span>
                )}
            </Button>

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
            </Button>
            )}
        </div>
      </div>

      {/* 2. Main Layout (Video Grid + Chat) */}
      <div className="flex-1 flex overflow-hidden mt-16 mb-20 relative">
          {/* Video Grid */}
          <div className={`flex-1 overflow-y-auto p-2 sm:p-4 transition-all duration-300 ${showChat ? 'mr-0 sm:mr-80' : ''}`}>
             <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 sm:gap-4 auto-rows-fr max-w-7xl mx-auto min-h-full content-start">
                
                {/* Local User */}
                <VideoPlayer
                  stream={manager.getLocalStream()}
                  isLocal={true}
                  name={t("room.you")}
                  className={`${meetingState.isScreenSharing ? 'col-span-1 sm:col-span-2 row-span-2 aspect-auto' : 'aspect-video'}`}
                  isScreenSharing={meetingState.isScreenSharing}
                  isVideoEnabled={localVideoEnabled} // Pass local toggle state
                />

                {/* Remote Participants */}
                {meetingState.participants
                    .filter(p => isHost ? p.role !== 'host' : p.id !== manager.getPeerId())
                    .map(p => (
                    <ParticipantVideo key={p.id} participant={p} />
                ))}

                {/* Empty State */}
                {meetingState.participants.length <= 1 && (
                    <div className="flex flex-col items-center justify-center text-white/30 bg-white/5 rounded-xl border border-white/5 aspect-video p-4 text-center border-dashed">
                        <p className="text-sm">{t("room.waitingForOthers")}</p>
                        <Button variant="link" className="text-blue-400 text-xs h-auto p-0" onClick={() => setShowQR(true)}>{t("room.invitePeople")}</Button>
                    </div>
                )}
             </div>
          </div>

          {/* Chat Sidebar */}
          <div className={`fixed inset-y-0 right-0 w-full sm:w-80 bg-gray-900 border-l border-gray-800 transform transition-transform duration-300 z-40 flex flex-col ${showChat ? 'translate-x-0' : 'translate-x-full'}`}>
             <div className="p-4 border-b border-gray-800 flex justify-between items-center bg-gray-900/95">
                <h3 className="font-bold text-white flex items-center gap-2">
                    <MessageSquare className="w-4 h-4"/> {t("room.chat")}
                </h3>
                <Button variant="ghost" size="sm" onClick={() => setShowChat(false)}><X className="w-4 h-4 text-gray-400"/></Button>
             </div>
             
             <div className="flex-1 overflow-y-auto p-4 space-y-4" ref={chatScrollRef}>
                {meetingState.messages.length === 0 ? (
                    <div className="text-center text-gray-600 text-sm py-10">{t("room.noMessages")}</div>
                ) : (
                    meetingState.messages.map((msg) => (
                        <div key={msg.id} className={`flex flex-col ${msg.senderId === manager.getPeerId() ? 'items-end' : 'items-start'}`}>
                            {msg.isSystem ? (
                                <div className="w-full text-center text-xs text-gray-500 my-2 italic">{msg.text}</div>
                            ) : (
                                <>
                                    <span className="text-[10px] text-gray-400 mb-1 px-1">{msg.senderName}</span>
                                    <div className={`px-3 py-2 rounded-lg max-w-[85%] text-sm ${
                                        msg.senderId === manager.getPeerId()
                                        ? 'bg-blue-600 text-white rounded-tr-none'
                                        : 'bg-gray-800 text-gray-200 rounded-tl-none'
                                    }`}>
                                        {msg.text}
                                    </div>
                                </>
                            )}
                        </div>
                    ))
                )}
             </div>
             
             <div className="p-3 border-t border-gray-800 bg-gray-900 pb-safe">
                 <form onSubmit={handleSendMessage} className="flex gap-2">
                     <Input
                        value={chatInput}
                        onChange={e => setChatInput(e.target.value)}
                        placeholder={t("room.typeMessage")}
                        className="bg-gray-800 border-gray-700 text-white focus-visible:ring-blue-500"
                     />
                     <Button type="submit" size="icon" className="bg-blue-600 hover:bg-blue-700">
                         <Send className="w-4 h-4" />
                     </Button>
                 </form>
             </div>
          </div>
      </div>

      {/* 3. Host Lobby Modal (Mobile/Desktop Overlay) */}
      {isHost && showLobbyMobile && (
        <div className="absolute inset-0 z-40 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200">
           <div className="bg-white rounded-2xl w-full max-w-sm overflow-hidden shadow-2xl">
              <div className="p-4 border-b flex justify-between items-center bg-gray-50">
                 <h3 className="font-bold text-gray-900">{t("room.waitingRoom")} ({meetingState.waitingPeers.length})</h3>
                 <Button variant="ghost" size="sm" onClick={() => setShowLobbyMobile(false)}><X className="w-4 h-4"/></Button>
              </div>
              <div className="max-h-[60vh] overflow-y-auto p-2">
                 {meetingState.waitingPeers.length === 0 ? (
                    <div className="text-center py-8 text-gray-500 text-sm">{t("room.noOneWaiting")}</div>
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
                 <h3 className="font-bold text-gray-900">{t("room.scanToJoin")}</h3>
                 <Button variant="ghost" size="sm" onClick={() => setShowQR(false)}><X className="w-4 h-4"/></Button>
              </div>
              <div className="p-6 flex flex-col items-center space-y-4">
                 <div className="p-2 bg-white rounded-xl shadow-inner border">
                    <QRCodeGenerator url={typeof window !== 'undefined' ? window.location.href : ''} size={200} />
                 </div>
                 <p className="text-center text-sm text-gray-500">
                    {t("room.scanDescription")} <strong>{roomInfo.title}</strong> {t("room.instantly")}
                 </p>
                 <div className="flex w-full gap-2">
                    <Button
                        variant="outline"
                        className="flex-1"
                        onClick={() => {
                            navigator.clipboard.writeText(window.location.href);
                            toast.success(t("room.linkCopied"));
                        }}
                    >
                        <Copy className="w-4 h-4 mr-2" /> {t("room.copyLink")}
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
                                toast.info(t("room.sharingNotSupported"));
                            }
                        }}
                    >
                        <Share2 className="w-4 h-4 mr-2" /> {t("room.share")}
                    </Button>
                 </div>
              </div>
           </div>
        </div>
      )}

      {/* 5. Bottom Controls */}
      <div className="fixed bottom-6 left-0 right-0 z-30 flex justify-center pointer-events-none pb-safe">
       <div className="bg-gray-900/90 backdrop-blur-xl border border-gray-700 rounded-2xl px-4 py-3 shadow-2xl flex items-center gap-3 pointer-events-auto">
         <Button
           variant="ghost"
           size="icon"
           onClick={() => manager.toggleAudio()}
           className={`h-12 w-12 rounded-xl transition-all ${!localAudioEnabled ? 'bg-red-500/90 text-white hover:bg-red-600' : 'bg-gray-800 text-white hover:bg-gray-700'}`}
         >
            {!localAudioEnabled ? <MicOff className="h-5 w-5" /> : <Mic className="h-5 w-5" />}
         </Button>
         
         <Button
           variant="ghost"
           size="icon"
           onClick={() => manager.toggleVideo()}
           className={`h-12 w-12 rounded-xl transition-all ${!localVideoEnabled ? 'bg-red-500/90 text-white hover:bg-red-600' : 'bg-gray-800 text-white hover:bg-gray-700'}`}
         >
            {!localVideoEnabled ? <VideoOff className="h-5 w-5" /> : <VideoIcon className="h-5 w-5" />}
         </Button>

         <Button
           variant="ghost"
           size="icon"
           onClick={() => {
               if (meetingState.isScreenSharing) manager.stopScreenShare();
               else manager.startScreenShare();
           }}
           className={`h-12 w-12 rounded-xl transition-all ${meetingState.isScreenSharing ? 'bg-blue-600 text-white hover:bg-blue-700' : 'bg-gray-800 text-white hover:bg-gray-700'}`}
         >
            {meetingState.isScreenSharing ? <MonitorOff className="h-5 w-5" /> : <Monitor className="h-5 w-5" />}
         </Button>

         <div className="w-px h-8 bg-gray-700 mx-1"></div>

         <Button
           variant="destructive"
           size="icon"
           onClick={handleGoHome}
           className="h-12 w-12 rounded-xl bg-red-600 hover:bg-red-700 shadow-lg shadow-red-500/20"
         >
            <PhoneOff className="h-5 w-5" />
         </Button>
       </div>
     </div>

    </div>
  )
}