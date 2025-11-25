'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { toast } from 'sonner'
import { Video, Home } from 'lucide-react'
import { secureStorage } from '@/lib/secure-storage'

export default function CreateRoomPage({ params }: { params: Promise<{ lang: string }> }) {
  const [title, setTitle] = useState('')
  const [password, setPassword] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [lang, setLang] = useState('en')
  const router = useRouter()

  useEffect(() => {
    const loadParams = async () => {
      const resolvedParams = await params
      setLang(resolvedParams.lang)
    }
    loadParams()
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
        // Store room and password securely
        if (typeof window !== 'undefined' && password) {
          await secureStorage.saveRoom({
            roomId: data.roomId,
            title,
            createdAt: Date.now(),
            lastAccessed: Date.now()
          })
          
          await secureStorage.storePassword(data.roomId, password)
        }
        
        const { lang } = await params
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

  const handleGoHome = () => {
    router.push(`/${lang}`)
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Button variant="ghost" onClick={handleGoHome} className="flex items-center gap-2 px-4 py-2">
                <Home className="w-4 h-4" />
                <span>Home</span>
              </Button>
              <div className="w-px h-6 bg-gray-300"></div>
              <div>
                <h1 className="text-base font-normal text-gray-700">Create Meeting Room</h1>
                <p className="text-gray-500 text-xs">Setup a room and become the host</p>
              </div>
            </div>
          </div>
        </div>
      </div>
      
      {/* Main Content */}
      <div className="flex items-center justify-center p-4 min-h-[calc(100vh-80px)]">
        <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Create Meeting Room</CardTitle>
          <CardDescription>Setup a room and become the host.</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleCreate} className="space-y-4">
            <div className="space-y-2">
              <Label>Room Title</Label>
              <Input
                placeholder="Weekly Sync"
                value={title}
                onChange={e => setTitle(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label>Host Password</Label>
              <Input
                type="password"
                placeholder="Secret code"
                value={password}
                onChange={e => setPassword(e.target.value)}
                required
              />
              <p className="text-xs text-gray-500">You will need this to manage the room.</p>
            </div>
            <Button type="submit" className="w-full" disabled={isLoading}>
              {isLoading ? 'Creating...' : (
                <><Video className="mr-2 h-4 w-4" /> Create Room</>
              )}
            </Button>
          </form>
        </CardContent>
        </Card>
      </div>
    </div>
  )
}