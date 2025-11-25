'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { meetingService } from '@/lib/meeting-service'
import { LocalRoomData } from '@/lib/types'
import { toast } from 'sonner'
import {
  Plus,
  Users,
  Calendar,
  Video,
  Copy,
  Share2,
  Clock,
  Trash2,
  Key,
  Settings
} from 'lucide-react'
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
      // Load rooms from secure storage
      const storedRooms = await secureStorage.getRooms()
      setRooms(storedRooms)
    } catch (error) {
      console.error('Error loading rooms:', error)
      toast.error('Failed to load rooms')
    } finally {
      setIsLoading(false)
    }
  }

  const handleCreateRoom = () => {
    router.push(`/${lang}/create`)
  }

  const handleJoinRoom = (roomId: string) => {
    router.push(`/${lang}/room/${roomId}`)
  }

  const handleCopyLink = async (roomId: string) => {
    const roomLink = `${typeof window !== 'undefined' ? window.location.origin : ''}/${lang}/room/${roomId}`
    try {
      await navigator.clipboard.writeText(roomLink)
      toast.success('Room link copied to clipboard')
    } catch (err) {
      toast.error('Failed to copy link')
    }
  }

  const handleShareRoom = (roomId: string) => {
    const roomLink = `${typeof window !== 'undefined' ? window.location.origin : ''}/${lang}/room/${roomId}`
    if (navigator.share) {
      navigator.share({
        title: 'Join my meeting room',
        text: 'Click the link to join the meeting',
        url: roomLink,
      })
    } else {
      handleCopyLink(roomId)
    }
  }

  const handleDeleteRoom = async (roomId: string) => {
    if (typeof window !== 'undefined' && !window.confirm('Are you sure you want to delete this room? This action cannot be undone.')) {
      return
    }

    try {
      // Remove from secure storage
      await secureStorage.removeRoom(roomId)
      setRooms(rooms.filter(room => room.roomId !== roomId))
      toast.success('Room deleted successfully')
    } catch (error) {
      console.error('Error deleting room:', error)
      toast.error('Failed to delete room')
    }
  }


  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading your rooms...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 py-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Meeting Rooms</h1>
              <p className="text-gray-600 mt-1">Manage your persistent meeting rooms</p>
            </div>
            <Button onClick={handleCreateRoom} className="flex items-center gap-2">
              <Plus className="w-4 h-4" />
              Create New Room
            </Button>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 py-8">
        {rooms.length === 0 ? (
          // Empty State
          <div className="text-center py-16">
            <div className="w-24 h-24 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-6">
              <Video className="w-12 h-12 text-blue-600" />
            </div>
            <h2 className="text-2xl font-bold text-gray-900 mb-4">No rooms yet</h2>
            <p className="text-gray-600 mb-8 max-w-md mx-auto">
              Create your first persistent meeting room to get started. Persistent rooms have fixed, reusable links that you can share with participants anytime.
            </p>
            <Button onClick={handleCreateRoom} size="lg" className="flex items-center gap-2">
              <Plus className="w-5 h-5" />
              Create Your First Room
            </Button>
          </div>
        ) : (
          // Rooms Grid
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {rooms.map((room) => (
              <Card key={room.roomId} className="hover:shadow-lg transition-shadow">
                <CardHeader className="pb-4">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <CardTitle className="text-lg truncate">{room.title}</CardTitle>
                      <CardDescription className="line-clamp-2 mt-1">
                        Created {new Date(room.createdAt).toLocaleDateString()}
                      </CardDescription>
                    </div>
                    <div className="flex gap-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleCopyLink(room.roomId)}
                        className="h-8 w-8 p-0"
                      >
                        <Copy className="w-4 h-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleShareRoom(room.roomId)}
                        className="h-8 w-8 p-0"
                      >
                        <Share2 className="w-4 h-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDeleteRoom(room.roomId)}
                        className="h-8 w-8 p-0 text-red-600 hover:text-red-700"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  {/* Room Stats */}
                  <div className="flex items-center justify-between text-sm text-gray-600">
                    <div className="flex items-center gap-1">
                      <Video className="w-4 h-4" />
                      <span>Meeting Room</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <Clock className="w-4 h-4" />
                      <span>Last accessed {new Date(room.lastAccessed).toLocaleDateString()}</span>
                    </div>
                  </div>

                  {/* Action Buttons */}
                  <div className="flex gap-2">
                    <Button
                      onClick={() => handleJoinRoom(room.roomId)}
                      className="flex-1 flex items-center gap-2"
                    >
                      <Video className="w-4 h-4" />
                      Join Now
                    </Button>
                  </div>

                  {/* Quick Actions */}
                  <div className="flex justify-between text-xs text-gray-500">
                    <button
                      onClick={() => handleCopyLink(room.roomId)}
                      className="hover:text-gray-700"
                    >
                      Copy Link
                    </button>
                    <button className="hover:text-gray-700">
                      View History
                    </button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {/* Quick Stats */}
        {rooms.length > 0 && (
          <div className="mt-8 grid grid-cols-1 md:grid-cols-3 gap-6">
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center">
                  <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center mr-4">
                    <Video className="w-6 h-6 text-blue-600" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-gray-900">{rooms.length}</p>
                    <p className="text-sm text-gray-600">Active Rooms</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center">
                  <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center mr-4">
                    <Users className="w-6 h-6 text-green-600" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-gray-900">
                      {rooms.length}
                    </p>
                    <p className="text-sm text-gray-600">Total Capacity</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center">
                  <div className="w-12 h-12 bg-purple-100 rounded-full flex items-center justify-center mr-4">
                    <Calendar className="w-6 h-6 text-purple-600" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-gray-900">0</p>
                    <p className="text-sm text-gray-600">Scheduled Meetings</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </div>
  )
}