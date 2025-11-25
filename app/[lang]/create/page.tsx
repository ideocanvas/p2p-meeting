'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { toast } from 'sonner'
import { Video, Loader2, KeyRound } from 'lucide-react'
import { secureStorage } from '@/lib/secure-storage'
import { SiteHeader } from '@/components/site-header'

export default function CreateRoomPage({ params }: { params: Promise<{ lang: string }> }) {
  const [title, setTitle] = useState('')
  const [password, setPassword] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [lang, setLang] = useState('en')
  const router = useRouter()

  useEffect(() => {
    params.then(p => setLang(p.lang))
  }, [params])

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)

    try {
      const res = await fetch('/api/rooms', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title, password })
      })
      const data = await res.json()
      
      if (data.success) {
        if (typeof window !== 'undefined' && password) {
          await secureStorage.saveRoom({
            roomId: data.roomId,
            title,
            createdAt: Date.now(),
            lastAccessed: Date.now()
          })
          await secureStorage.storePassword(data.roomId, password)
        }
        router.push(`/${lang}/room/${data.roomId}`)
      } else {
        toast.error(data.error)
      }
    } catch (err) {
      toast.error('Failed to create room')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-purple-50">
      <SiteHeader lang={lang} />
      
      <div className="flex items-center justify-center p-4 min-h-[calc(100vh-80px)]">
        <Card className="w-full max-w-md shadow-2xl border-0 bg-white/80 backdrop-blur-xl">
          <CardHeader className="space-y-1 pb-6">
            <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center mb-4 text-blue-600">
              <Video className="w-6 h-6" />
            </div>
            <CardTitle className="text-2xl font-bold">Create Room</CardTitle>
            <CardDescription className="text-gray-500">
              Setup a persistent room to host meetings.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleCreate} className="space-y-6">
              <div className="space-y-2">
                <Label htmlFor="title" className="text-sm font-medium text-gray-700">Room Name</Label>
                <Input
                  id="title"
                  placeholder="e.g. Weekly Standup"
                  value={title}
                  onChange={e => setTitle(e.target.value)}
                  required
                  className="h-11 bg-white/50"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password" className="text-sm font-medium text-gray-700">Host Password</Label>
                <div className="relative">
                  <KeyRound className="absolute left-3 top-3 h-5 w-5 text-gray-400" />
                  <Input
                    id="password"
                    type="password"
                    placeholder="Create a secret code"
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    required
                    className="pl-10 h-11 bg-white/50"
                  />
                </div>
                <p className="text-xs text-gray-500 ml-1">You'll need this to control the room later.</p>
              </div>
              
              <Button type="submit" className="w-full h-11 text-base bg-blue-600 hover:bg-blue-700" disabled={isLoading}>
                {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : 'Create Room'}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}