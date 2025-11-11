
import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 Bytes'

  const k = 1024
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))

  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
}

export function generateSessionId(): string {
  return Math.random().toString(36).substr(2, 9)
}

export function generateVerificationCode(): string {
  return Math.floor(100000 + Math.random() * 900000).toString()
}

export async function createQRCodeDataUrl(text: string, size: number = 256): Promise<string> {
  // Using a public QR code API for simplicity
  const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=${size}x${size}&data=${encodeURIComponent(text)}&bgcolor=ffffff&color=1f2937&margin=2`
  
  try {
    const response = await fetch(qrUrl)
    const blob = await response.blob()
    return URL.createObjectURL(blob)
  } catch (error) {
    console.error('Error generating QR code:', error)
    return ''
  }
}

export function isWebRTCSupported(): boolean {
  return typeof window !== 'undefined' && 
         'RTCPeerConnection' in window && 
         'RTCDataChannel' in window
}

export function isMobileDevice(): boolean {
  if (typeof window === 'undefined') return false
  
  return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(
    navigator.userAgent
  )
}

export function copyToClipboard(text: string): Promise<boolean> {
  if (typeof window === 'undefined') return Promise.resolve(false)
  
  if (navigator.clipboard) {
    return navigator.clipboard.writeText(text).then(() => true).catch(() => false)
  }
  
  // Fallback for older browsers
  const textArea = document.createElement('textarea')
  textArea.value = text
  textArea.style.position = 'fixed'
  textArea.style.left = '-999999px'
  textArea.style.top = '-999999px'
  document.body.appendChild(textArea)
  textArea.focus()
  textArea.select()
  
  try {
    const successful = document.execCommand('copy')
    document.body.removeChild(textArea)
    return Promise.resolve(successful)
  } catch (err) {
    document.body.removeChild(textArea)
    return Promise.resolve(false)
  }
}

export function validateFile(file: File, maxSize?: number): { valid: boolean; error?: string } {
  if (!file) {
    return { valid: false, error: 'No file provided' }
  }
  
  if (maxSize && file.size > maxSize) {
    return { 
      valid: false, 
      error: `File size (${formatFileSize(file.size)}) exceeds maximum allowed size (${formatFileSize(maxSize)})` 
    }
  }
  
  return { valid: true }
}

export function chunkArrayBuffer(buffer: ArrayBuffer, chunkSize: number): ArrayBuffer[] {
  const chunks: ArrayBuffer[] = []
  const totalChunks = Math.ceil(buffer.byteLength / chunkSize)
  
  for (let i = 0; i < totalChunks; i++) {
    const start = i * chunkSize
    const end = Math.min(start + chunkSize, buffer.byteLength)
    chunks.push(buffer.slice(start, end))
  }
  
  return chunks
}

export function assembleArrayBufferChunks(chunks: ArrayBuffer[]): ArrayBuffer {
  const totalSize = chunks.reduce((sum, chunk) => sum + chunk.byteLength, 0)
  const assembled = new ArrayBuffer(totalSize)
  const view = new Uint8Array(assembled)
  
  let offset = 0
  chunks.forEach(chunk => {
    view.set(new Uint8Array(chunk), offset)
    offset += chunk.byteLength
  })
  
  return assembled
}

export function saveArrayBufferAsFile(data: ArrayBuffer, filename: string, mimeType?: string) {
  const blob = new Blob([data], { type: mimeType || 'application/octet-stream' })
  const url = URL.createObjectURL(blob)
  
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  
  URL.revokeObjectURL(url)
}
