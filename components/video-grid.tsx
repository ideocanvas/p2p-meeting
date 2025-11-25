"use client";

import { useState, useEffect, useRef } from "react";
import { Participant } from "@/lib/types";
import { Video, VideoOff, Mic, MicOff, Users } from "lucide-react";
import { VideoPlayer } from "@/components/video-player";

interface VideoGridProps {
  participants: Participant[];
  localStream?: MediaStream | null;
  localParticipantName?: string;
  isAudioEnabled?: boolean;
  isVideoEnabled?: boolean;
  onToggleAudio?: () => void;
  onToggleVideo?: () => void;
  className?: string;
}

interface VideoTileProps {
  participant: Participant | {
    id: string;
    name: string;
    role: "host" | "participant";
    status: "connecting" | "waiting" | "connected" | "disconnected";
    hasVideo: boolean;
    hasAudio: boolean;
    joinedAt: number;
    stream?: MediaStream | null;
  };
  stream?: MediaStream | null;
  isLocal?: boolean;
}

function VideoTile({ participant, stream, isLocal = false }: VideoTileProps) {
  return (
    <div className="relative bg-gray-900 rounded-lg overflow-hidden aspect-video">
      <VideoPlayer
        stream={stream || null}
        isLocal={isLocal}
        name={isLocal ? "You" : participant.name}
        className="w-full h-full"
        hasAudio={participant.hasAudio}
      />
      
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
  const [spotlightParticipant, setSpotlightParticipant] = useState<Participant | {
    id: string;
    name: string;
    role: "host" | "participant";
    status: "connecting" | "waiting" | "connected" | "disconnected";
    hasVideo: boolean;
    hasAudio: boolean;
    joinedAt: number;
    stream?: MediaStream | null;
  } | null>(null);

  const allParticipants = [
    {
      id: "local",
      name: localParticipantName,
      role: "host" as const,
      status: "connected" as const,
      hasVideo: isVideoEnabled,
      hasAudio: isAudioEnabled,
      joinedAt: Date.now(),
      stream: localStream,
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
            stream={spotlightParticipant.id === "local" ? localStream : (spotlightParticipant.stream || null)}
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
                  stream={participant.id === "local" ? localStream : (participant.stream || null)}
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
              stream={participant.id === "local" ? localStream : (participant.stream || null)}
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