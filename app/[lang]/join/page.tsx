'use client'

import { useState, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { meetingService } from '@/lib/meeting-service'
import { toast } from 'sonner'
import { LogIn, Loader2, User } from 'lucide-react'
import { SiteHeader } from '@/components/site-header'

export default function JoinRoomPage({ params }: { params: Promise<{ lang: string }> }) {
  const [lang, setLang] = useState('en')
  const router = useRouter()
  const searchParams = useSearchParams()
  const [isJoining, setIsJoining] = useState(false)
  const [roomId, setRoomId] = useState(searchParams.get('roomId') || '')
  const [name, setName] = useState('')

  useEffect(() => {
    params.then(p => setLang(p.lang))
  }, [params])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!roomId || !name) return toast.error('Please fill in all fields')
    
    setIsJoining(true)
    try {
      const roomCheck = await meetingService.getRoom({ roomId })
      if (!roomCheck.success) throw new Error('Room not found')
      
      if (typeof window !== 'undefined' && window.localStorage) {
        window.localStorage.setItem('user_name', name) // Simple cache
      }
      router.push(`/${lang}/room/${roomId}`)
    } catch (error) {
      toast.error('Room not found or invalid')
    } finally {
      setIsJoining(false)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-blue-50">
      <SiteHeader lang={lang} />
      
      <div className="flex items-center justify-center p-4 min-h-[calc(100vh-80px)]">
        <Card className="w-full max-w-md shadow-2xl border-0 bg-white/80 backdrop-blur-xl">
          <CardHeader className="space-y-1 pb-6">
            <div className="w-12 h-12 bg-indigo-100 rounded-xl flex items-center justify-center mb-4 text-indigo-600">
              <LogIn className="w-6 h-6" />
            </div>
            <CardTitle className="text-2xl font-bold">Join Meeting</CardTitle>
            <CardDescription className="text-gray-500">
              Enter the room ID and your name to connect.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="space-y-2">
                <Label htmlFor="roomId">Room ID</Label>
                <Input
                  id="roomId"
                  placeholder="e.g. X8J2P9"
                  value={roomId}
                  onChange={e => setRoomId(e.target.value.toUpperCase())}
                  required
                  className="h-11 font-mono uppercase tracking-wider"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="name">Your Name</Label>
                <div className="relative">
                  <User className="absolute left-3 top-3 h-5 w-5 text-gray-400" />
                  <Input
                    id="name"
                    placeholder="Jane Doe"
                    value={name}
                    onChange={e => setName(e.target.value)}
                    required
                    className="pl-10 h-11"
                  />
                </div>
              </div>

              <Button type="submit" className="w-full h-11 text-base bg-indigo-600 hover:bg-indigo-700" disabled={isJoining}>
                {isJoining ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : 'Join Room'}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}