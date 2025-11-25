'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { LocalRoomData } from '@/lib/types'
import { toast } from 'sonner'
import { SiteHeader } from '@/components/site-header'
import { Plus, Users, Video, Copy, Share2, Clock, Trash2, Calendar, ArrowRight } from 'lucide-react'
import { secureStorage } from '@/lib/secure-storage'

export default function DashboardPage({ params }: { params: Promise<{ lang: string }> }) {
  const [lang, setLang] = useState('en')
  const [rooms, setRooms] = useState<LocalRoomData[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const router = useRouter()

  useEffect(() => {
    const loadParams = async () => {
      const resolvedParams = await params
      setLang(resolvedParams.lang)
    }
    loadParams()
  }, [params])

  useEffect(() => {
    loadRooms()
  }, [])

  const loadRooms = async () => {
    try {
      setIsLoading(true)
      const storedRooms = await secureStorage.getRooms()
      setRooms(storedRooms)
    } catch (error) {
      console.error('Error loading rooms:', error)
      toast.error('Failed to load rooms')
    } finally {
      setIsLoading(false)
    }
  }

  const handleCopyLink = async (roomId: string) => {
    const roomLink = `${window.location.origin}/${lang}/room/${roomId}`
    try {
      await navigator.clipboard.writeText(roomLink)
      toast.success('Link copied')
    } catch (err) {
      toast.error('Failed to copy')
    }
  }

  const handleDeleteRoom = async (roomId: string) => {
    if (!window.confirm('Delete this room?')) return
    try {
      await secureStorage.removeRoom(roomId)
      setRooms(rooms.filter(room => room.roomId !== roomId))
      toast.success('Room deleted')
    } catch (error) {
      toast.error('Failed to delete')
    }
  }

  return (
    <div className="min-h-screen bg-gray-50/50">
      <SiteHeader lang={lang} />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-12">
        <div className="flex flex-col md:flex-row md:items-center justify-between mb-10 gap-4">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 tracking-tight">Dashboard</h1>
            <p className="text-gray-500 mt-2">Manage your persistent meeting rooms</p>
          </div>
          <Button onClick={() => router.push(`/${lang}/create`)} size="lg" className="bg-blue-600 hover:bg-blue-700 shadow-md">
            <Plus className="w-5 h-5 mr-2" />
            Create New Room
          </Button>
        </div>

        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[1, 2, 3].map(i => (
              <div key={i} className="h-48 bg-gray-200 rounded-xl animate-pulse" />
            ))}
          </div>
        ) : rooms.length === 0 ? (
          <div className="text-center py-20 bg-white rounded-3xl border border-gray-100 shadow-sm">
            <div className="w-20 h-20 bg-blue-50 rounded-full flex items-center justify-center mx-auto mb-6">
              <Calendar className="w-10 h-10 text-blue-500" />
            </div>
            <h2 className="text-2xl font-bold text-gray-900 mb-3">No rooms yet</h2>
            <p className="text-gray-500 mb-8 max-w-md mx-auto">
              Create your first room to get started. Share the link once, use it forever.
            </p>
            <Button onClick={() => router.push(`/${lang}/create`)} variant="outline" className="border-2">
              Create Room
            </Button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {rooms.map((room) => (
              <Card key={room.roomId} className="group hover:shadow-xl transition-all duration-300 border-gray-200/60 overflow-hidden bg-white">
                <CardContent className="p-0">
                  <div className="p-6 border-b border-gray-100">
                    <div className="flex justify-between items-start mb-4">
                      <div className="p-3 bg-indigo-50 rounded-lg group-hover:bg-indigo-100 transition-colors">
                        <Video className="w-6 h-6 text-indigo-600" />
                      </div>
                      <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <Button variant="ghost" size="icon" onClick={() => handleCopyLink(room.roomId)} title="Copy Link">
                          <Copy className="w-4 h-4 text-gray-500" />
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => handleDeleteRoom(room.roomId)} title="Delete Room">
                          <Trash2 className="w-4 h-4 text-red-500" />
                        </Button>
                      </div>
                    </div>
                    
                    <h3 className="text-xl font-bold text-gray-900 mb-1 truncate pr-4">{room.title}</h3>
                    <div className="flex items-center text-sm text-gray-500 gap-2">
                      <Clock className="w-3 h-3" />
                      <span>Last used {new Date(room.lastAccessed).toLocaleDateString()}</span>
                    </div>
                  </div>
                  
                  <div className="p-4 bg-gray-50/50 flex gap-3">
                    <Button 
                      className="w-full bg-white text-gray-700 hover:bg-gray-50 border border-gray-200 shadow-sm"
                      onClick={() => router.push(`/${lang}/room/${room.roomId}`)}
                    >
                      Join Room <ArrowRight className="w-4 h-4 ml-2" />
                    </Button>
                    <Button 
                      variant="outline" 
                      size="icon" 
                      className="bg-white"
                      onClick={() => {
                         if (navigator.share) {
                            navigator.share({
                              title: room.title,
                              url: `${window.location.origin}/${lang}/room/${room.roomId}`
                            })
                         } else {
                            handleCopyLink(room.roomId)
                         }
                      }}
                    >
                      <Share2 className="w-4 h-4" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </main>
    </div>
  )
}