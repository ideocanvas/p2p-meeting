"use client";

import { useEffect, useRef } from "react";
import { Monitor, MicOff } from "lucide-react";
import { getInitials, getAvatarColor } from "@/lib/utils";

interface VideoPlayerProps {
  stream: MediaStream | null;
  isLocal?: boolean;
  name?: string;
  className?: string;
  isScreenSharing?: boolean;
  hasAudio?: boolean;
  isVideoEnabled?: boolean;
  objectFit?: "cover" | "contain";
}

export function VideoPlayer({
  stream,
  isLocal = false,
  name = "User",
  className = "",
  isScreenSharing = false,
  hasAudio = true,
  isVideoEnabled = true,
  objectFit = "cover",
}: VideoPlayerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);

  // Determine if we should actually show the video element.
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

  const fitClass = isScreenSharing
    ? `${objectFit === "contain" ? "object-contain" : "object-cover"} bg-black`
    : `object-cover ${isLocal ? "scale-x-[-1]" : ""}`;

  return (
    <div className={`relative bg-gray-900 rounded-xl overflow-hidden shadow-sm border border-gray-800 flex items-center justify-center ${className}`}>
      {shouldShowVideo ? (
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted={isLocal} // Always mute local to prevent echo
          className={`w-full h-full ${fitClass}`}
        />
      ) : (
        <div className="flex flex-col items-center justify-center w-full h-full bg-gray-800 absolute inset-0">
           <div className={`w-20 h-20 rounded-full bg-gradient-to-br ${getAvatarColor(name)} flex items-center justify-center shadow-lg`}>
              <span className="text-2xl font-bold text-white tracking-widest">
                {getInitials(name)}
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
