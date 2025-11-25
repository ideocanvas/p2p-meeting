"use client";

import Peer, { DataConnection, MediaConnection } from "peerjs";
import { Participant, ConnectionState } from "@/lib/types";

// Configuration
const ICE_SERVERS = [
  { urls: "stun:stun.l.google.com:19302" },
  { urls: "stun:global.stun.twilio.com:3478" }
];

type Message =
  | { type: 'join-request'; name: string }
  | { type: 'join-accepted' }
  | { type: 'join-rejected' }
  | { type: 'participants-update'; count: number };

class MeetingManager {
  private static instance: MeetingManager;
  private peer: Peer | null = null;
  private localStream: MediaStream | null = null;
  private connections: Map<string, DataConnection> = new Map(); // peerId -> conn
  private calls: Map<string, MediaConnection> = new Map();
  private trackMonitoringIntervals: Map<string, NodeJS.Timeout> = new Map(); // peerId -> intervalId
  
  // State
  public state: {
    connectionState: ConnectionState;
    participants: Participant[];
    waitingPeers: { peerId: string; name: string; conn: DataConnection }[];
    error: string | null;
    isAudioMuted: boolean;
    isVideoMuted: boolean;
  } = {
    connectionState: 'disconnected',
    participants: [],
    waitingPeers: [],
    error: null,
    isAudioMuted: false,
    isVideoMuted: false
  };

  private listeners: (() => void)[] = [];

  static getInstance() {
    if (!this.instance) this.instance = new MeetingManager();
    return this.instance;
  }

  subscribe(listener: () => void) {
    this.listeners.push(listener);
    return () => { this.listeners = this.listeners.filter(l => l !== listener); };
  }

  private notify() {
    this.listeners.forEach(l => l());
  }

  async initializeMedia() {
    try {
      this.localStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
      // Initialize audio/video state
      this.state.isAudioMuted = false;
      this.state.isVideoMuted = false;
      this.notify();
    } catch (e) {
      console.error("Media error", e);
      this.state.error = "Could not access camera/microphone";
      this.notify();
    }
  }

  toggleAudio() {
    if (this.localStream) {
      const audioTracks = this.localStream.getAudioTracks();
      if (audioTracks.length > 0) {
        const newEnabledState = !audioTracks[0].enabled;
        audioTracks.forEach(t => t.enabled = newEnabledState);
        this.state.isAudioMuted = !newEnabledState;
        
        // Update the local participant's audio state
        const localParticipant = this.state.participants.find(p => p.id === this.getPeerId());
        if (localParticipant) {
          localParticipant.hasAudio = newEnabledState;
        }
        
        this.notify(); // Force re-render to update icons
      }
    }
  }

  isMuted() {
    return this.state.isAudioMuted;
  }

  isVideoOff() {
    return this.state.isVideoMuted;
  }

  toggleVideo() {
    if (this.localStream) {
      const videoTracks = this.localStream.getVideoTracks();
      if (videoTracks.length > 0) {
        const newEnabledState = !videoTracks[0].enabled;
        videoTracks.forEach(t => t.enabled = newEnabledState);
        this.state.isVideoMuted = !newEnabledState;
        
        // Update the local participant's video state
        const localParticipant = this.state.participants.find(p => p.id === this.getPeerId());
        if (localParticipant) {
          localParticipant.hasVideo = newEnabledState;
        }
        
        this.notify();
      }
    }
  }

  // --- HOST LOGIC ---

  async startHosting(roomId: string, authToken: string, name: string, isApiKey: boolean = false) {
    if (!this.localStream) await this.initializeMedia();

    this.peer = new Peer({ config: { iceServers: ICE_SERVERS } });

    this.peer.on('open', async (id) => {
      // Register Host ID with Server using appropriate authentication
      if (isApiKey) {
        // Use API key authentication
        await fetch(`/api/rooms/${roomId}`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${authToken}`
          },
          body: JSON.stringify({ hostPeerId: id })
        });
      } else {
        // Use master password authentication
        await fetch(`/api/rooms/${roomId}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ password: authToken, hostPeerId: id })
        });
      }
      
      this.state.connectionState = 'active';
      this.state.participants = [{
        id,
        name,
        role: 'host',
        status: 'connected',
        hasAudio: !this.state.isAudioMuted,
        hasVideo: !this.state.isVideoMuted
      }];
      this.notify();
    });

    this.peer.on('connection', (conn) => {
      conn.on('data', (data: unknown) => {
        const msg = data as Message;
        if (msg.type === 'join-request') {
          // Add to waiting list
          this.state.waitingPeers.push({ peerId: conn.peer, name: msg.name, conn });
          this.notify();
        }
      });
      
      conn.on('close', () => {
        // Remove from waiting list when connection closes
        this.state.waitingPeers = this.state.waitingPeers.filter(p => p.peerId !== conn.peer);
        this.connections.delete(conn.peer);
        this.notify();
      });
      
      // Store the connection reference
      this.connections.set(conn.peer, conn);
    });

    // Handle incoming calls (once approved)
    this.peer.on('call', (call) => {
      call.answer(this.localStream!);
      this.setupCall(call);
    });
  }

  approveParticipant(peerId: string) {
    const waiterIndex = this.state.waitingPeers.findIndex(p => p.peerId === peerId);
    if (waiterIndex === -1) return;
    
    const waiter = this.state.waitingPeers[waiterIndex];
    
    // 1. Send accepted message
    waiter.conn.send({ type: 'join-accepted' });

    // 2. Initiate Call
    const call = this.peer!.call(peerId, this.localStream!);
    this.setupCall(call, waiter.name);

    // 3. Move from waiting to participants
    this.state.participants.push({
      id: peerId,
      name: waiter.name,
      role: 'participant',
      status: 'connected',
      hasAudio: true,
      hasVideo: true
    });
    
    this.state.waitingPeers.splice(waiterIndex, 1);
    this.notify();
  }

  rejectParticipant(peerId: string) {
    const waiterIndex = this.state.waitingPeers.findIndex(p => p.peerId === peerId);
    if (waiterIndex === -1) return;
    
    const waiter = this.state.waitingPeers[waiterIndex];
    
    // Send rejection message
    waiter.conn.send({ type: 'join-rejected' });
    
    // Close the connection
    waiter.conn.close();
    
    // Remove from waiting list
    this.state.waitingPeers.splice(waiterIndex, 1);
    this.notify();
  }

  // --- PARTICIPANT LOGIC ---

  async joinRoom(hostPeerId: string, name: string) {
    if (!this.localStream) await this.initializeMedia();
    
    this.peer = new Peer({ config: { iceServers: ICE_SERVERS } });
    this.state.connectionState = 'connecting';
    this.notify();

    this.peer.on('open', (id) => {
      const conn = this.peer!.connect(hostPeerId);
      
      conn.on('open', () => {
        this.state.connectionState = 'waiting'; // Waiting for approval
        this.notify();
        conn.send({ type: 'join-request', name });
      });

      conn.on('data', (data: unknown) => {
        const msg = data as Message;
        if (msg.type === 'join-accepted') {
          this.state.connectionState = 'connected'; // Transition to meeting
          this.notify();
        } else if (msg.type === 'join-rejected') {
          this.state.error = "Host rejected your request";
          this.state.connectionState = 'disconnected';
          this.notify();
          conn.close();
        }
      });
      
      conn.on('close', () => {
        if (this.state.connectionState !== 'disconnected') {
          this.state.connectionState = 'disconnected';
          this.state.error = "Connection to host lost";
          this.notify();
        }
        this.connections.delete(hostPeerId);
      });
      
      // Store the connection reference
      this.connections.set(hostPeerId, conn);
    });

    // Wait for Host to call us (after approval)
    this.peer.on('call', (call) => {
      call.answer(this.localStream!);
      this.state.connectionState = 'active';
      this.setupCall(call, "Host");
      this.notify();
    });
  }

  // --- COMMON LOGIC ---

  private setupCall(call: MediaConnection, nameOverride?: string) {
    call.on('stream', (remoteStream) => {
      const existing = this.state.participants.find(p => p.id === call.peer);
      if (existing) {
        existing.stream = remoteStream;
        // Update initial video/audio state based on tracks
        existing.hasVideo = remoteStream.getVideoTracks().length > 0 && remoteStream.getVideoTracks()[0].enabled;
        existing.hasAudio = remoteStream.getAudioTracks().length > 0 && remoteStream.getAudioTracks()[0].enabled;
      } else {
        this.state.participants.push({
          id: call.peer,
          name: nameOverride || "User",
          role: 'participant',
          status: 'connected',
          hasAudio: remoteStream.getAudioTracks().length > 0 && remoteStream.getAudioTracks()[0].enabled,
          hasVideo: remoteStream.getVideoTracks().length > 0 && remoteStream.getVideoTracks()[0].enabled,
          stream: remoteStream
        });
      }
      
      // Monitor track changes for remote participants using polling
      const checkTrackStates = () => {
        const participant = this.state.participants.find(p => p.id === call.peer);
        if (participant && remoteStream) {
          const videoTrack = remoteStream.getVideoTracks()[0];
          const audioTrack = remoteStream.getAudioTracks()[0];
          
          const newVideoState = videoTrack ? videoTrack.enabled : false;
          const newAudioState = audioTrack ? audioTrack.enabled : false;
          
          if (participant.hasVideo !== newVideoState || participant.hasAudio !== newAudioState) {
            participant.hasVideo = newVideoState;
            participant.hasAudio = newAudioState;
            this.notify();
          }
        }
      };
      
      // Check track states periodically
      const intervalId = setInterval(checkTrackStates, 1000);
      this.trackMonitoringIntervals.set(call.peer, intervalId);
      
      this.notify();
    });

    call.on('close', () => {
      // Remove participant from the list
      this.state.participants = this.state.participants.filter(p => p.id !== call.peer);
      
      // Also remove from waiting list if they're still there
      this.state.waitingPeers = this.state.waitingPeers.filter(p => p.peerId !== call.peer);
      
      // Clean up the call reference
      this.calls.delete(call.peer);
      
      // Clean up the track monitoring interval
      const intervalId = this.trackMonitoringIntervals.get(call.peer);
      if (intervalId) {
        clearInterval(intervalId);
        this.trackMonitoringIntervals.delete(call.peer);
      }
      
      // Clean up the data connection if it exists
      const conn = this.connections.get(call.peer);
      if (conn) {
        conn.close();
        this.connections.delete(call.peer);
      }
      
      this.notify();
    });

    this.calls.set(call.peer, call);
  }

  getLocalStream() { return this.localStream; }
  
  getPeerId() { return this.peer?.id; }

  leave() {
    // Clean up all track monitoring intervals
    this.trackMonitoringIntervals.forEach(intervalId => clearInterval(intervalId));
    this.trackMonitoringIntervals.clear();
    
    this.peer?.destroy();
    this.localStream?.getTracks().forEach(t => t.stop());
    this.state = {
      connectionState: 'disconnected',
      participants: [],
      waitingPeers: [],
      error: null,
      isAudioMuted: false,
      isVideoMuted: false
    };
    (MeetingManager as any).instance = null;
    this.notify();
  }
}

export default MeetingManager;