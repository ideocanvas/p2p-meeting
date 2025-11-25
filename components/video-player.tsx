"use client";

import { useEffect, useRef } from "react";
import { VideoOff, Monitor, MicOff } from "lucide-react";

interface VideoPlayerProps {
  stream: MediaStream | null;
  isLocal?: boolean;
  name?: string;
  className?: string;
  isScreenSharing?: boolean;
  hasAudio?: boolean;
  isVideoEnabled?: boolean; // Added prop
}

export function VideoPlayer({
  stream,
  isLocal = false,
  name = "User",
  className = "",
  isScreenSharing = false,
  hasAudio = true,
  isVideoEnabled = true // Default to true
}: VideoPlayerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);

  // Determine if we should actually show the video element
  // We show it ONLY if:
  // 1. The explicit isVideoEnabled prop is true
  // 2. We have a valid stream
  // 3. The stream has video tracks
  // 4. The first video track is enabled (double check)
  const shouldShowVideo =
    isVideoEnabled &&
    stream &&
    stream.active &&
    stream.getVideoTracks().length > 0 &&
    stream.getVideoTracks()[0].enabled;

  useEffect(() => {
    const videoEl = videoRef.current;
    if (!videoEl) return;

    if (shouldShowVideo && stream) {
      videoEl.srcObject = stream;
      videoEl.play().catch((e) => console.error("Video play failed", e));
    } else {
      videoEl.srcObject = null;
    }
  }, [stream, shouldShowVideo]);

  return (
    <div className={`relative bg-gray-900 rounded-xl overflow-hidden shadow-sm border border-gray-800 flex items-center justify-center ${className}`}>
      {shouldShowVideo ? (
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted={isLocal} // Always mute local to prevent echo
          className={`w-full h-full object-cover ${isScreenSharing ? 'object-contain bg-black' : (isLocal ? 'scale-x-[-1]' : '')}`}
        />
      ) : (
        <div className="flex flex-col items-center justify-center w-full h-full bg-gray-800 absolute inset-0">
           <div className="w-20 h-20 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center shadow-lg">
              <span className="text-2xl font-bold text-white tracking-widest">
                {(name || '?').charAt(0).toUpperCase()}
              </span>
           </div>
           <p className="mt-3 text-gray-400 text-sm font-medium">Camera Off</p>
        </div>
      )}

      {/* Name Tag */}
      <div className="absolute bottom-2 left-2 right-2 flex justify-between items-end z-10 pointer-events-none">
        <div className="bg-black/60 backdrop-blur-sm px-2 py-1 rounded text-xs text-white font-medium truncate max-w-[150px] flex items-center gap-1">
          {name} {isLocal && "(You)"}
          {isScreenSharing && <Monitor className="w-3 h-3 text-blue-400 ml-1"/>}
        </div>
        <div className="flex gap-1">
            {!hasAudio && (
              <div className="bg-red-500/90 p-1.5 rounded-full shadow-sm">
                <MicOff className="w-3 h-3 text-white"/>
              </div>
            )}
        </div>
      </div>
    </div>
  );
}