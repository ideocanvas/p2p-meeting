
// Connection strategies configuration
export type ConnectionStrategy = "webrtc-peerjs" | "webrtc-custom" | "server-relay";

export interface STUNTURNConfig {
  urls: string | string[];
  username?: string;
  credential?: string;
}

// Free public STUN/TURN servers
export const ICE_SERVERS: RTCIceServer[] = [
  // Google's public STUN servers
  { urls: "stun:stun.l.google.com:19302" },
  { urls: "stun:stun1.l.google.com:19302" },
  { urls: "stun:stun2.l.google.com:19302" },
  { urls: "stun:stun3.l.google.com:19302" },
  { urls: "stun:stun4.l.google.com:19302" },

  // More reliable STUN servers
  { urls: "stun:stun.voipbuster.com:3478" },
  { urls: "stun:stun.voipstunt.com:3478" },

  // Free TURN servers (may be unreliable)
  {
    urls: "turn:numb.viagenie.ca",
    username: "webrtc@live.com",
    credential: "muazkh",
  },
  {
    urls: "turn:turn.bistri.com:80",
    username: "homeo",
    credential: "homeo",
  },
];

export const STRATEGY_CONFIG = {
  "webrtc-peerjs": {
    name: "WebRTC (PeerJS)",
    timeout: 15000, // 15 seconds
    description: "Using PeerJS cloud signaling with STUN/TURN",
  },
  "webrtc-custom": {
    name: "WebRTC (Custom)",
    timeout: 15000,
    description: "Direct WebRTC with server signaling",
  },
  "server-relay": {
    name: "Server Relay",
    timeout: 10000,
    description: "File transfer through server",
  },
};
