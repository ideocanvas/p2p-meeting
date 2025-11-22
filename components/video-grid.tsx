"use client";

import { useState, useEffect, useRef } from "react";
import { Participant, IMediaStream } from "@/lib/types";
import { Video, VideoOff, Mic, MicOff, Users } from "lucide-react";

interface VideoGridProps {
  participants: Participant[];
  localStream?: IMediaStream | null;
  localParticipantName?: string;
  isAudioEnabled?: boolean;
  isVideoEnabled?: boolean;
  onToggleAudio?: () => void;
  onToggleVideo?: () => void;
  className?: string;
}

interface VideoTileProps {
  participant: Participant;
  stream?: IMediaStream | null;
  isLocal?: boolean;
}

function VideoTile({ participant, stream, isLocal = false }: VideoTileProps) {
  const videoRef = useRef<any>(null); // eslint-disable-line @typescript-eslint/no-explicit-any
  const [isVideoReady, setIsVideoReady] = useState(false);

  useEffect(() => {
    if (videoRef.current && stream) {
      videoRef.current.srcObject = stream as any; // eslint-disable-line @typescript-eslint/no-explicit-any
      setIsVideoReady(true);
    }
  }, [stream]);

  return (
    <div className="relative bg-gray-900 rounded-lg overflow-hidden aspect-video">
      {/* Video element */}
      {stream && isVideoReady ? (
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted={isLocal}
          className="w-full h-full object-cover"
        />
      ) : (
        <div className="w-full h-full flex items-center justify-center bg-gray-800">
          <div className="text-center">
            <VideoOff className="w-12 h-12 text-gray-600 mx-auto mb-2" />
            <p className="text-gray-400 text-sm">
              {isLocal ? "Your camera is off" : `${participant.name}'s camera is off`}
            </p>
          </div>
        </div>
      )}

      {/* Participant info overlay */}
      <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/70 to-transparent p-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <div className="w-8 h-8 bg-gray-700 rounded-full flex items-center justify-center">
              <span className="text-white text-sm font-semibold">
                {participant.name.charAt(0).toUpperCase()}
              </span>
            </div>
            <div>
              <p className="text-white text-sm font-medium">
                {isLocal ? "You" : participant.name}
              </p>
              <div className="flex items-center space-x-1">
                {participant.hasAudio !== false && (
                  <Mic className="w-3 h-3 text-green-400" />
                )}
                {participant.hasVideo !== false && (
                  <Video className="w-3 h-3 text-green-400" />
                )}
              </div>
            </div>
          </div>
          {isLocal && (
            <div className="bg-blue-600 text-white text-xs px-2 py-1 rounded">
              Host
            </div>
          )}
        </div>
      </div>

      {/* Connection status indicator */}
      <div className="absolute top-2 right-2">
        <div className={`w-3 h-3 rounded-full ${
          participant.status === "connected" 
            ? "bg-green-500" 
            : participant.status === "connecting"
            ? "bg-yellow-500 animate-pulse"
            : "bg-red-500"
        }`} />
      </div>
    </div>
  );
}

export function VideoGrid({
  participants,
  localStream,
  localParticipantName = "You",
  isAudioEnabled = true,
  isVideoEnabled = true,
  onToggleAudio,
  onToggleVideo,
  className = "",
}: VideoGridProps) {
  const [layout, setLayout] = useState<"grid" | "spotlight">("grid");
  const [spotlightParticipant, setSpotlightParticipant] = useState<Participant | null>(null);

  const allParticipants = [
    {
      id: "local",
      name: localParticipantName,
      role: "host" as const,
      status: "connected" as const,
      hasVideo: isVideoEnabled,
      hasAudio: isAudioEnabled,
      joinedAt: Date.now(),
    },
    ...participants,
  ];

  const getGridCols = (count: number) => {
    if (count <= 1) return "grid-cols-1";
    if (count <= 2) return "grid-cols-1 md:grid-cols-2";
    if (count <= 4) return "grid-cols-2";
    if (count <= 6) return "grid-cols-2 md:grid-cols-3";
    if (count <= 9) return "grid-cols-3";
    return "grid-cols-3 md:grid-cols-4";
  };

  if (layout === "spotlight" && spotlightParticipant) {
    return (
      <div className={`space-y-4 ${className}`}>
        {/* Spotlight view */}
        <div className="relative bg-gray-900 rounded-lg overflow-hidden aspect-video">
          <VideoTile
            participant={spotlightParticipant}
            stream={spotlightParticipant.id === "local" ? localStream : spotlightParticipant.stream}
            isLocal={spotlightParticipant.id === "local"}
          />
        </div>

        {/* Participant strip */}
        <div className="bg-gray-800 rounded-lg p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-white font-semibold flex items-center space-x-2">
              <Users className="w-4 h-4" />
              <span>Participants ({allParticipants.length})</span>
            </h3>
            <button
              onClick={() => setLayout("grid")}
              className="text-gray-400 hover:text-white text-sm"
            >
              Grid View
            </button>
          </div>
          <div className="flex space-x-2 overflow-x-auto pb-2">
            {allParticipants.map((participant) => (
              <button
                key={participant.id}
                onClick={() => setSpotlightParticipant(participant)}
                className={`flex-shrink-0 w-32 h-24 rounded-lg overflow-hidden border-2 transition-colors ${
                  spotlightParticipant.id === participant.id
                    ? "border-blue-500"
                    : "border-gray-600 hover:border-gray-500"
                }`}
              >
                <VideoTile
                  participant={participant}
                  stream={participant.id === "local" ? localStream : participant.stream}
                  isLocal={participant.id === "local"}
                />
              </button>
            ))}
          </div>
        </div>

        {/* Controls */}
        {onToggleAudio || onToggleVideo ? (
          <div className="flex justify-center space-x-4">
            {onToggleAudio && (
              <button
                onClick={onToggleAudio}
                className={`p-4 rounded-full transition-colors ${
                  isAudioEnabled 
                    ? "bg-blue-600 hover:bg-blue-700 text-white" 
                    : "bg-red-600 hover:bg-red-700 text-white"
                }`}
              >
                {isAudioEnabled ? <Mic className="w-6 h-6" /> : <MicOff className="w-6 h-6" />}
              </button>
            )}
            {onToggleVideo && (
              <button
                onClick={onToggleVideo}
                className={`p-4 rounded-full transition-colors ${
                  isVideoEnabled 
                    ? "bg-blue-600 hover:bg-blue-700 text-white" 
                    : "bg-red-600 hover:bg-red-700 text-white"
                }`}
              >
                {isVideoEnabled ? <Video className="w-6 h-6" /> : <VideoOff className="w-6 h-6" />}
              </button>
            )}
          </div>
        ) : null}
      </div>
    );
  }

  return (
    <div className={`space-y-4 ${className}`}>
      {/* Grid view */}
      <div className={`grid ${getGridCols(allParticipants.length)} gap-4`}>
        {allParticipants.map((participant) => (
          <div
            key={participant.id}
            className="cursor-pointer group"
            onClick={() => {
              setSpotlightParticipant(participant);
              setLayout("spotlight");
            }}
          >
            <VideoTile
              participant={participant}
              stream={participant.id === "local" ? localStream : participant.stream}
              isLocal={participant.id === "local"}
            />
          </div>
        ))}
      </div>

      {/* Controls and info */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <div className="flex items-center space-x-2 text-gray-400">
            <Users className="w-4 h-4" />
            <span className="text-sm">{allParticipants.length} participants</span>
          </div>
          {allParticipants.length > 1 && (
            <button
              onClick={() => {
                setSpotlightParticipant(allParticipants[1]); // First remote participant
                setLayout("spotlight");
              }}
              className="text-gray-400 hover:text-white text-sm"
            >
              Spotlight View
            </button>
          )}
        </div>

        {onToggleAudio || onToggleVideo ? (
          <div className="flex space-x-4">
            {onToggleAudio && (
              <button
                onClick={onToggleAudio}
                className={`p-3 rounded-full transition-colors ${
                  isAudioEnabled 
                    ? "bg-blue-600 hover:bg-blue-700 text-white" 
                    : "bg-red-600 hover:bg-red-700 text-white"
                }`}
              >
                {isAudioEnabled ? <Mic className="w-5 h-5" /> : <MicOff className="w-5 h-5" />}
              </button>
            )}
            {onToggleVideo && (
              <button
                onClick={onToggleVideo}
                className={`p-3 rounded-full transition-colors ${
                  isVideoEnabled 
                    ? "bg-blue-600 hover:bg-blue-700 text-white" 
                    : "bg-red-600 hover:bg-red-700 text-white"
                }`}
              >
                {isVideoEnabled ? <Video className="w-5 h-5" /> : <VideoOff className="w-5 h-5" />}
              </button>
            )}
          </div>
        ) : null}
      </div>
    </div>
  );
}