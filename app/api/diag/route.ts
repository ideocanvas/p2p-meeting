import { NextResponse } from 'next/server'
import { hashPassword, verifyPassword } from '@/lib/password'
import { KVHelper } from '@/lib/kv-helper'

export async function GET() {
  const out: string[] = []

  out.push(`typeof crypto=${typeof crypto}`)
  out.push(`typeof crypto.subtle=${typeof (globalThis as { crypto?: { subtle?: unknown } }).crypto?.subtle}`)
  out.push(`typeof crypto.getRandomValues=${typeof (globalThis as { crypto?: { getRandomValues?: unknown } }).crypto?.getRandomValues}`)

  try {
    const h = await hashPassword('test1234')
    out.push(`hash ok: ${h.slice(0, 20)}... (len ${h.length})`)
    const ok = await verifyPassword('test1234', h)
    out.push(`verify ok=${ok}`)
    const bad = await verifyPassword('wrong', h)
    out.push(`verify wrong=${bad}`)
  } catch (e) {
    out.push(`hash/verify threw: ${e instanceof Error ? `${e.name}: ${e.message}` : String(e)}`)
  }

  try {
    const kv = KVHelper.getInstance()
    await kv.put('diag:test', 'hello', { expirationTtl: 60 })
    const got = await kv.get('diag:test')
    out.push(`kv put/get ok: ${got}`)
    await kv.delete('diag:test')
  } catch (e) {
    out.push(`kv threw: ${e instanceof Error ? `${e.name}: ${e.message}` : String(e)}`)
  }

  return NextResponse.json({ ok: true, log: out })
}