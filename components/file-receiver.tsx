
'use client'

import { useState } from 'react'
import { Download, File, Check, Clock, Save } from 'lucide-react'
import { formatFileSize } from '@/lib/utils'

import { FileTransfer } from '@/lib/types'

interface FileReceiverProps {
  files: FileTransfer[]
  connectionState: string
}

export function FileReceiver({ files, connectionState }: FileReceiverProps) {
  const [downloadingFiles, setDownloadingFiles] = useState<Set<string>>(new Set())

  const downloadFile = async (file: FileTransfer) => {
    if (!file.data || downloadingFiles.has(file.id)) return
    
    setDownloadingFiles(prev => new Set(prev).add(file.id))
    
    try {
      const blob = new Blob([file.data])
      const url = URL.createObjectURL(blob)
      
      // Create a temporary link element and click it
      const link = document.createElement('a')
      link.href = url
      link.download = file.name
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      
      // Clean up the object URL
      URL.revokeObjectURL(url)
    } catch (error) {
      console.error('Error downloading file:', error)
    } finally {
      setDownloadingFiles(prev => {
        const newSet = new Set(prev)
        newSet.delete(file.id)
        return newSet
      })
    }
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed':
        return <Check className="w-5 h-5 text-green-600" />
      case 'transferring':
      case 'receiving':
        return <Clock className="w-5 h-5 text-blue-600 animate-spin" />
      case 'error':
        return <File className="w-5 h-5 text-red-600" />
      default:
        return <File className="w-5 h-5 text-gray-400" />
    }
  }

  const completedFiles = files?.filter(f => f.status === 'completed') ?? []
  const receivingFiles = files?.filter(f => f.status === 'transferring' || f.status === 'receiving') ?? []

  return (
    <div className="space-y-6">
      <div className="text-center">
        <Download className="w-16 h-16 text-blue-600 mx-auto mb-4" />
        <h2 className="text-2xl font-bold text-gray-900 mb-4">Ready to Receive Files</h2>
        <p className="text-gray-600 mb-8">
          Files sent to you will appear here for download
        </p>
      </div>

      {/* Currently Receiving */}
      {receivingFiles.length > 0 && (
        <div className="space-y-4">
          <h3 className="text-lg font-semibold text-gray-900">
            Receiving Files ({receivingFiles.length})
          </h3>
          
          <div className="space-y-3">
            {receivingFiles.map((file) => (
              <div key={file.id} className="bg-blue-50 rounded-lg p-4">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center space-x-3 min-w-0 flex-1">
                    <div className="flex-shrink-0">
                      {getStatusIcon(file.status)}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="font-medium text-gray-900 truncate" title={file.name}>{file.name}</p>
                      <p className="text-sm text-gray-600">{formatFileSize(file.size)}</p>
                    </div>
                  </div>
                  <div className="text-right ml-4 flex-shrink-0">
                    <p className="text-sm font-medium text-gray-900">{file.progress.toFixed(0)}%</p>
                    <p className="text-xs text-gray-500 capitalize">{file.status}</p>
                  </div>
                </div>
                
                {/* Progress Bar */}
                <div className="w-full bg-white rounded-full h-2">
                  <div
                    className="h-2 bg-blue-600 rounded-full transition-all duration-300"
                    style={{ width: `${file.progress}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Completed Files */}
      {completedFiles.length > 0 && (
        <div className="space-y-4">
          <h3 className="text-lg font-semibold text-gray-900">
            Received Files ({completedFiles.length})
          </h3>
          
          <div className="space-y-3">
            {completedFiles.map((file) => (
              <div key={file.id} className="bg-green-50 rounded-lg p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-3 min-w-0 flex-1">
                    <div className="flex-shrink-0">
                      {getStatusIcon(file.status)}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="font-medium text-gray-900 truncate" title={file.name}>{file.name}</p>
                      <p className="text-sm text-gray-600">{formatFileSize(file.size)}</p>
                    </div>
                  </div>
                  <button
                    onClick={() => downloadFile(file)}
                    disabled={downloadingFiles.has(file.id)}
                    className="flex items-center space-x-2 bg-green-600 text-white px-4 py-2 rounded-lg font-semibold hover:bg-green-700 transition-colors disabled:opacity-50 ml-4 flex-shrink-0"
                  >
                    <Save className="w-4 h-4" />
                    <span>{downloadingFiles.has(file.id) ? 'Saving...' : 'Save File'}</span>
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Empty State */}
      {(!files || files.length === 0) && connectionState === 'connected' && (
        <div className="text-center py-8">
          <File className="w-12 h-12 text-gray-300 mx-auto mb-4" />
          <p className="text-gray-500">
            No files received yet. Files will appear here when the sender uploads them.
          </p>
        </div>
      )}

      {/* Info */}
      <div className="bg-green-50 rounded-lg p-4">
        <p className="text-sm text-green-800">
          <strong>Info:</strong> Files are transferred directly from the sender's device. 
          Click "Save File" to download completed transfers to your device.
        </p>
      </div>
    </div>
  )
}
