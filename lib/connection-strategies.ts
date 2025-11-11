
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
  
  // Open Relay Project (free TURN server)
  {
    urls: "turn:openrelay.metered.ca:80",
    username: "openrelayproject",
    credential: "openrelayproject",
  },
  {
    urls: "turn:openrelay.metered.ca:443",
    username: "openrelayproject",
    credential: "openrelayproject",
  },
  {
    urls: "turn:openrelay.metered.ca:443?transport=tcp",
    username: "openrelayproject",
    credential: "openrelayproject",
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
