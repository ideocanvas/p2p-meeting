'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { toast } from 'sonner'
import { Video } from 'lucide-react'
import { secureStorage } from '@/lib/secure-storage'

export default function CreateRoomPage({ params }: { params: Promise<{ lang: string }> }) {
  const [title, setTitle] = useState('')
  const [password, setPassword] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const router = useRouter()

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

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
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
  )
}