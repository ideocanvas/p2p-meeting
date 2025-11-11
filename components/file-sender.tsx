
'use client'

import { useState, useRef } from 'react'
import { Upload, File, Check, Clock, X } from 'lucide-react'
import { formatFileSize } from '@/lib/utils'

import { FileTransfer } from '@/lib/types'

interface FileSenderProps {
  files: FileTransfer[]
  connectionState: string
  onFileSelect: (files: FileList) => void
}

export function FileSender({ files, connectionState, onFileSelect }: FileSenderProps) {
  const [isDragOver, setIsDragOver] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragOver(false)
    
    if (e.dataTransfer.files) {
      onFileSelect(e.dataTransfer.files)
    }
  }

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragOver(true)
  }

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragOver(false)
  }

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      onFileSelect(e.target.files)
    }
  }

  const triggerFileSelect = () => {
    fileInputRef.current?.click()
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed':
        return <Check className="w-5 h-5 text-green-600" />
      case 'transferring':
        return <Clock className="w-5 h-5 text-blue-600 animate-spin" />
      case 'error':
        return <X className="w-5 h-5 text-red-600" />
      default:
        return <File className="w-5 h-5 text-gray-400" />
    }
  }

  const isTransferring = connectionState === 'transferring'
  const isConnected = connectionState === 'connected' || connectionState === 'transferring'

  return (
    <div className="space-y-6">
      <div className="text-center">
        <Upload className="w-16 h-16 text-green-600 mx-auto mb-4" />
        <h2 className="text-2xl font-bold text-gray-900 mb-4">Ready to Send Files</h2>
        <p className="text-gray-600 mb-8">
          Select or drag files to transfer them securely
        </p>
      </div>

      {/* File Upload Area */}
      <div
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onClick={triggerFileSelect}
        className={`border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-all ${
          isDragOver
            ? 'border-green-500 bg-green-50'
            : isConnected
            ? 'border-gray-300 hover:border-green-500 hover:bg-green-50'
            : 'border-gray-200 bg-gray-50 cursor-not-allowed'
        }`}
      >
        <input
          ref={fileInputRef}
          type="file"
          multiple
          onChange={handleFileInputChange}
          className="hidden"
          disabled={!isConnected}
        />
        
        <Upload className={`w-12 h-12 mx-auto mb-4 ${
          isConnected ? 'text-gray-400' : 'text-gray-300'
        }`} />
        
        {isConnected ? (
          <>
            <p className="text-lg font-medium text-gray-900 mb-2">
              Drop files here or click to browse
            </p>
            <p className="text-gray-600">
              No size limits • Multiple files supported
            </p>
          </>
        ) : (
          <p className="text-gray-500">
            Waiting for connection to be established...
          </p>
        )}
      </div>

      {/* File Transfer List */}
      {files?.length > 0 && (
        <div className="space-y-4">
          <h3 className="text-lg font-semibold text-gray-900">
            File Transfers ({files.length})
          </h3>
          
          <div className="space-y-3">
            {files.map((fileTransfer) => (
              <div key={fileTransfer.id} className="bg-gray-50 rounded-lg p-4">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center space-x-3 min-w-0 flex-1">
                    <div className="flex-shrink-0">
                      {getStatusIcon(fileTransfer.status)}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="font-medium text-gray-900 truncate" title={fileTransfer.name}>
                        {fileTransfer.name}
                      </p>
                      <p className="text-sm text-gray-600">
                        {formatFileSize(fileTransfer.size)}
                      </p>
                    </div>
                  </div>
                  <div className="text-right ml-4 flex-shrink-0">
                    <p className="text-sm font-medium text-gray-900">
                      {fileTransfer.progress.toFixed(0)}%
                    </p>
                    <p className="text-xs text-gray-500 capitalize">
                      {fileTransfer.status}
                    </p>
                  </div>
                </div>
                
                {/* Progress Bar */}
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div
                    className={`h-2 rounded-full transition-all duration-300 ${
                      fileTransfer.status === 'completed'
                        ? 'bg-green-600'
                        : fileTransfer.status === 'error'
                        ? 'bg-red-600'
                        : 'bg-blue-600'
                    }`}
                    style={{ width: `${fileTransfer.progress}%` }}
                  />
                </div>
                
                {fileTransfer.error && (
                  <p className="text-sm text-red-600 mt-2">
                    Error: {fileTransfer.error}
                  </p>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Info */}
      <div className="bg-blue-50 rounded-lg p-4">
        <p className="text-sm text-blue-800">
          <strong>Tip:</strong> You can send multiple files in one session. 
          Files are transferred directly to the receiver's device with end-to-end encryption.
        </p>
      </div>
    </div>
  )
}
