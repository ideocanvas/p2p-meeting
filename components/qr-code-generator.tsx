
'use client'

import { useEffect, useRef } from 'react'
import QRCode from 'qrcode'

interface QRCodeGeneratorProps {
  url: string
  size?: number
  scanText?: string
}

export function QRCodeGenerator({
  url,
  size = 256,
  scanText = 'Scan with any QR code scanner or camera app'
}: QRCodeGeneratorProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    if (!canvasRef.current || !url) return

    QRCode.toCanvas(
      canvasRef.current,
      url,
      {
        width: size,
        margin: 2,
        color: {
          dark: '#1f2937',
          light: '#ffffff'
        }
      },
      (error) => {
        if (error) console.error('QR Code generation error:', error)
      }
    )
  }, [url, size])

  return (
    <div className="flex flex-col items-center">
      <div className="bg-white p-4 rounded-lg border-2 border-gray-200 shadow-sm">
        <canvas
          ref={canvasRef}
          className="block"
          style={{ width: size, height: size }}
        />
      </div>
      <p className="text-xs text-gray-500 mt-2 text-center max-w-xs">
        {scanText}
      </p>
    </div>
  )
}
