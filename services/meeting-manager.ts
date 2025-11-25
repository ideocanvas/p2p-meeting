"use client";

import Peer, { DataConnection, MediaConnection } from "peerjs";
import { Participant, ConnectionState, ChatMessage } from "@/lib/types";

// Configuration
const ICE_SERVERS = [
  { urls: "stun:stun.l.google.com:19302" },
  { urls: "stun:global.stun.twilio.com:3478" }
];

type Message =
  | { type: 'join-request'; name: string }
  | { type: 'join-accepted' }
  | { type: 'join-rejected' }
  | { type: 'participants-update'; count: number }
  | { type: 'chat-message'; id: string; senderName: string; text: string; timestamp: number }
  | { type: 'status-update'; hasVideo: boolean; hasAudio: boolean; isScreenSharing: boolean };

class MeetingManager {
  private static instance: MeetingManager;
  private peer: Peer | null = null;
  private localStream: MediaStream | null = null;
  private screenStream: MediaStream | null = null;
  private connections: Map<string, DataConnection> = new Map(); // peerId -> conn
  private calls: Map<string, MediaConnection> = new Map();
  private trackMonitoringIntervals: Map<string, NodeJS.Timeout> = new Map(); // peerId -> intervalId
  
  // State
  public state: {
    connectionState: ConnectionState;
    participants: Participant[];
    waitingPeers: { peerId: string; name: string; conn: DataConnection }[];
    messages: ChatMessage[];
    error: string | null;
    isAudioMuted: boolean;
    isVideoMuted: boolean;
    isScreenSharing: boolean;
  } = {
    connectionState: 'disconnected',
    participants: [],
    waitingPeers: [],
    messages: [],
    error: null,
    isAudioMuted: false,
    isVideoMuted: false,
    isScreenSharing: false
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
        
        this.updateLocalParticipantState();
        this.broadcastStatusUpdate();
        this.notify();
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
    // If screen sharing, stop it first to revert to camera
    if (this.state.isScreenSharing) {
      this.stopScreenShare();
      return;
    }

    if (this.localStream) {
      const videoTracks = this.localStream.getVideoTracks();
      if (videoTracks.length > 0) {
        const newEnabledState = !videoTracks[0].enabled;
        videoTracks.forEach(t => t.enabled = newEnabledState);
        this.state.isVideoMuted = !newEnabledState;
        
        this.updateLocalParticipantState();
        this.broadcastStatusUpdate();
        this.notify();
      }
    }
  }

  async startScreenShare() {
    try {
      if (this.state.isScreenSharing) return;

      this.screenStream = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: true });
      const screenVideoTrack = this.screenStream.getVideoTracks()[0];

      // Handle user clicking "Stop sharing" in browser UI
      screenVideoTrack.onended = () => {
        this.stopScreenShare();
      };

      // Replace video track in all active calls
      if (this.localStream) {
        // Replace in Peer Connections
        this.calls.forEach((call) => {
          const sender = call.peerConnection.getSenders().find((s) => s.track?.kind === "video");
          if (sender) {
            sender.replaceTrack(screenVideoTrack);
          }
        });
        
        // Update local state to show screen share
        this.state.isScreenSharing = true;
        this.state.isVideoMuted = false; // Video is technically "on" (it's the screen)

        this.updateLocalParticipantState();
        this.broadcastStatusUpdate();
        this.notify();
      }
    } catch (err) {
      console.error("Failed to share screen", err);
    }
  }

  stopScreenShare() {
    if (!this.state.isScreenSharing || !this.localStream) return;

    // Stop the screen share tracks
    this.screenStream?.getTracks().forEach(t => t.stop());
    this.screenStream = null;

    // Revert to camera track
    const cameraTrack = this.localStream.getVideoTracks()[0];
    
    // Ensure camera track respects previous mute state (or default to on if we want)
    if (cameraTrack) {
        // If the user had video MUTED before screen share, we might want to keep it muted.
        // For simplicity, let's enable it so they see themselves again.
        cameraTrack.enabled = true;
        this.state.isVideoMuted = false;

        this.calls.forEach((call) => {
        const sender = call.peerConnection.getSenders().find((s) => s.track?.kind === "video");
        if (sender) {
            sender.replaceTrack(cameraTrack);
        }
        });
    }

    this.state.isScreenSharing = false;
    this.updateLocalParticipantState();
    this.broadcastStatusUpdate();
    this.notify();
  }

  sendMessage(text: string) {
    const myId = this.getPeerId();
    if (!myId) return;

    // Find local name
    const localPart = this.state.participants.find(p => p.id === myId);
    const name = localPart?.name || 'Me';

    const message: Message = {
      type: 'chat-message',
      id: Date.now().toString(),
      senderName: name,
      text,
      timestamp: Date.now()
    };

    // Add to local state
    this.state.messages.push({
      id: message.id,
      senderId: myId,
      senderName: name,
      text: text,
      timestamp: message.timestamp
    });

    // Broadcast to all connected peers
    this.connections.forEach(conn => {
      if (conn.open) {
        conn.send(message);
      }
    });

    this.notify();
  }

  private handleDataMessage(data: unknown, peerId: string) {
    const msg = data as Message;

    if (msg.type === 'chat-message') {
      this.state.messages.push({
        id: msg.id,
        senderId: peerId,
        senderName: msg.senderName,
        text: msg.text,
        timestamp: msg.timestamp
      });
      this.notify();
    }
    else if (msg.type === 'status-update') {
      const participant = this.state.participants.find(p => p.id === peerId);
      if (participant) {
        participant.hasVideo = msg.hasVideo;
        participant.hasAudio = msg.hasAudio;
        participant.isScreenSharing = msg.isScreenSharing;
        this.notify();
      }
    }
  }

  private broadcastStatusUpdate() {
    const update: Message = {
      type: 'status-update',
      hasVideo: !this.state.isVideoMuted,
      hasAudio: !this.state.isAudioMuted,
      isScreenSharing: this.state.isScreenSharing
    };

    this.connections.forEach(conn => {
      if (conn.open) conn.send(update);
    });
  }

  private updateLocalParticipantState() {
    const myId = this.getPeerId();
    const localP = this.state.participants.find(p => p.id === myId);
    if (localP) {
      localP.hasAudio = !this.state.isAudioMuted;
      localP.hasVideo = !this.state.isVideoMuted;
      localP.isScreenSharing = this.state.isScreenSharing;
      
      // Important: If screen sharing, the stream source for local preview might change
      // dependent on UI implementation, but usually local preview stays as localStream (camera)
      // or we can switch it to screenStream.
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
        hasVideo: !this.state.isVideoMuted,
        isScreenSharing: false
      }];
      this.notify();
    });

    this.peer.on('connection', (conn) => {
      this.setupDataConnection(conn);
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
      hasVideo: true,
      isScreenSharing: false
    });
    
    this.addSystemMessage(`${waiter.name} joined the meeting`);
    
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
      this.setupDataConnection(conn, name);
    });

    // Wait for Host to call us (after approval)
    this.peer.on('call', (call) => {
      call.answer(this.localStream!);
      this.state.connectionState = 'active';
      this.setupCall(call, "Host");
      this.notify();
    });
  }

  private setupDataConnection(conn: DataConnection, joinName?: string) {
    conn.on('open', () => {
      if (joinName) {
        this.state.connectionState = 'waiting';
        this.notify();
        conn.send({ type: 'join-request', name: joinName });
      }
      // Send initial status
      this.broadcastStatusUpdate();
    });

    conn.on('data', (data: unknown) => {
      const msg = data as Message;
      
      // Handle handshake messages
      if (msg.type === 'join-request') {
        this.state.waitingPeers.push({ peerId: conn.peer, name: msg.name, conn });
        this.notify();
      } else if (msg.type === 'join-accepted') {
        this.state.connectionState = 'connected';
        this.notify();
      } else if (msg.type === 'join-rejected') {
        this.state.error = "Host rejected your request";
        this.state.connectionState = 'disconnected';
        this.notify();
        conn.close();
      } else {
        // Handle chat and status updates
        this.handleDataMessage(data, conn.peer);
      }
    });

    conn.on('close', () => {
       this.handlePeerDisconnection(conn.peer);
    });
    
    conn.on('error', () => {
       this.handlePeerDisconnection(conn.peer);
    });

    this.connections.set(conn.peer, conn);
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
          isScreenSharing: false,
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
      this.handlePeerDisconnection(call.peer);
    });
    
    call.on('error', () => {
      this.handlePeerDisconnection(call.peer);
    });

    this.calls.set(call.peer, call);
  }

  private checkTrackStatus(peerId: string, stream: MediaStream) {
     const participant = this.state.participants.find(p => p.id === peerId);
     if (participant) {
        const videoTrack = stream.getVideoTracks()[0];
        const audioTrack = stream.getAudioTracks()[0];
        
        // Only update if we haven't received a specific status update message overriding this
        // Note: For Avatar fix, strictly checking track.enabled is usually the source of truth
        const newVideoState = videoTrack && videoTrack.readyState === 'live' ? videoTrack.enabled : false;
        const newAudioState = audioTrack && audioTrack.readyState === 'live' ? audioTrack.enabled : false;
        
        let changed = false;
        // Logic: if track is disabled physically, update state.
        // If track is enabled physically, but our metadata says screen share, keep screen share true.
        if (participant.hasVideo !== newVideoState) {
            participant.hasVideo = newVideoState;
            changed = true;
        }
        if (participant.hasAudio !== newAudioState) {
            participant.hasAudio = newAudioState;
            changed = true;
        }
        if (changed) this.notify();
     }
  }

  private handlePeerDisconnection(peerId: string) {
      // Find name before removing
      const participant = this.state.participants.find(p => p.id === peerId);
      if (participant) {
        this.addSystemMessage(`${participant.name} left the meeting`);
      }

      // Cleanup lists
      this.state.participants = this.state.participants.filter(p => p.id !== peerId);
      this.state.waitingPeers = this.state.waitingPeers.filter(p => p.peerId !== peerId);
      
      // Cleanup maps and intervals
      this.connections.delete(peerId);
      this.calls.delete(peerId);
      
      const interval = this.trackMonitoringIntervals.get(peerId);
      if (interval) {
        clearInterval(interval);
        this.trackMonitoringIntervals.delete(peerId);
      }

      this.notify();
  }

  private addSystemMessage(text: string) {
      this.state.messages.push({
          id: Date.now().toString(),
          senderId: 'system',
          senderName: 'System',
          text,
          timestamp: Date.now(),
          isSystem: true
      });
      this.notify();
  }

  getLocalStream() {
      // Return screen stream if sharing, otherwise local camera
      return this.state.isScreenSharing && this.screenStream ? this.screenStream : this.localStream;
  }
  
  getPeerId() { return this.peer?.id; }

  leave() {
    // Notify others
    this.connections.forEach(conn => {
        if(conn.open) conn.close();
    });
    this.calls.forEach(call => {
        call.close();
    });

    this.trackMonitoringIntervals.forEach(intervalId => clearInterval(intervalId));
    this.trackMonitoringIntervals.clear();
    
    this.peer?.destroy();
    this.localStream?.getTracks().forEach(t => t.stop());
    this.screenStream?.getTracks().forEach(t => t.stop());
    
    this.state = {
      connectionState: 'disconnected',
      participants: [],
      waitingPeers: [],
      messages: [],
      error: null,
      isAudioMuted: false,
      isVideoMuted: false,
      isScreenSharing: false
    };
    // (MeetingManager as any).instance = null; // Optional: reset singleton
    this.notify();
  }
}

export default MeetingManager;