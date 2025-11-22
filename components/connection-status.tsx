
'use client'

import { Wifi, WifiOff, CheckCircle, Clock, Upload, Download, AlertCircle, Shield, Video, Users } from 'lucide-react'

interface ConnectionStatusProps {
  state: 'waiting' | 'connecting' | 'verifying' | 'connected' | 'transferring' | 'disconnected' | 'active'
  role: 'sender' | 'receiver' | 'host' | 'participant'
  filesCount?: number
  participantsCount?: number
  translations?: {
    waitingForConnection: string
    establishingConnection: string
    waitingForVerification: string
    pleaseVerifyConnection: string
    connectedAndReady: string
    transferringFiles: string
    connectionLost: string
    unknownStatus: string
    receivingMode: string
    sendingMode: string
    hostingMode: string
    joiningMode: string
    meetingInProgress: string
  }
}

export function ConnectionStatus({
  state,
  role,
  filesCount = 0,
  participantsCount = 0,
  translations = {
    waitingForConnection: 'Waiting for connection...',
    establishingConnection: 'Establishing connection...',
    waitingForVerification: 'Waiting for receiver verification...',
    pleaseVerifyConnection: 'Please verify the connection',
    connectedAndReady: 'Connected and ready',
    transferringFiles: 'Transferring files...',
    connectionLost: 'Connection lost',
    unknownStatus: 'Unknown status',
    receivingMode: 'Receiving mode',
    sendingMode: 'Sending mode',
    hostingMode: 'Hosting mode',
    joiningMode: 'Joining mode',
    meetingInProgress: 'Meeting in progress'
  }
}: ConnectionStatusProps) {
  const getStatusInfo = () => {
    switch (state) {
      case 'waiting':
        return {
          icon: Clock,
          color: 'text-blue-600',
          bgColor: 'bg-blue-100',
          message: role === 'receiver' || role === 'host' ? translations.waitingForConnection : translations.establishingConnection
        }
      case 'connecting':
        return {
          icon: Wifi,
          color: 'text-orange-600',
          bgColor: 'bg-orange-100',
          message: translations.establishingConnection
        }
      case 'verifying':
        return {
          icon: Shield,
          color: 'text-yellow-600',
          bgColor: 'bg-yellow-100',
          message: role === 'sender' || role === 'host'
            ? translations.waitingForVerification
            : translations.pleaseVerifyConnection
        }
      case 'connected':
        return {
          icon: CheckCircle,
          color: 'text-green-600',
          bgColor: 'bg-green-100',
          message: translations.connectedAndReady
        }
      case 'active':
        return {
          icon: Video,
          color: 'text-green-600',
          bgColor: 'bg-green-100',
          message: `${translations.meetingInProgress} (${participantsCount})`
        }
      case 'transferring':
        return {
          icon: role === 'sender' ? Upload : Download,
          color: 'text-purple-600',
          bgColor: 'bg-purple-100',
          message: `${translations.transferringFiles} (${filesCount})`
        }
      case 'disconnected':
        return {
          icon: WifiOff,
          color: 'text-red-600',
          bgColor: 'bg-red-100',
          message: translations.connectionLost
        }
      default:
        return {
          icon: AlertCircle,
          color: 'text-gray-600',
          bgColor: 'bg-gray-100',
          message: translations.unknownStatus
        }
    }
  }

  const { icon: Icon, color, bgColor, message } = getStatusInfo()

  return (
    <div className="mb-6">
      <div className="flex items-center space-x-3 p-4 rounded-lg border bg-gray-50">
        <div className={`p-2 rounded-full ${bgColor}`}>
          <Icon className={`w-5 h-5 ${color}`} />
        </div>
        <div>
          <p className="font-medium text-gray-900">{message}</p>
          <p className="text-sm text-gray-600">
            {role === 'receiver' ? translations.receivingMode :
             role === 'host' ? translations.hostingMode :
             role === 'participant' ? translations.joiningMode :
             translations.sendingMode}
          </p>
        </div>
        {(state === 'connected' || state === 'active') && (
          <div className="ml-auto flex items-center space-x-2">
            {state === 'active' && participantsCount > 0 && (
              <div className="flex items-center space-x-1 text-gray-600">
                <Users className="w-4 h-4" />
                <span className="text-sm">{participantsCount}</span>
              </div>
            )}
            <div className={`w-2 h-2 rounded-full bg-green-400 animate-pulse`} />
          </div>
        )}
      </div>
    </div>
  )
}
