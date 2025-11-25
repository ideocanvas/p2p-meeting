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
  | { type: 'active-peers'; peers: { id: string; name: string }[] }
  | { type: 'peer-left'; peerId: string }
  | { type: 'chat-message'; id: string; senderId?: string; senderName: string; text: string; timestamp: number }
  | { type: 'status-update'; hasVideo: boolean; hasAudio: boolean; isScreenSharing: boolean };

class MeetingManager {
  private static instance: MeetingManager;
  private peer: Peer | null = null;
  private localStream: MediaStream | null = null;
  private screenStream: MediaStream | null = null;
  
  // Keep track of all connections
  private connections: Map<string, DataConnection> = new Map();
  private calls: Map<string, MediaConnection> = new Map();
  private trackMonitoringIntervals: Map<string, NodeJS.Timeout> = new Map(); 
  
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
      this.state.isAudioMuted = false;
      this.state.isVideoMuted = false;
      this.notify();
    } catch (e) {
      console.error("Media error", e);
      this.state.error = "Could not access camera/microphone";
      this.notify();
    }
  }

  // --- MEDIA CONTROLS ---

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

  toggleVideo() {
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

      screenVideoTrack.onended = () => {
        this.stopScreenShare();
      };

      if (this.localStream) {
        this.calls.forEach((call) => {
          const sender = call.peerConnection.getSenders().find((s) => s.track?.kind === "video");
          if (sender) {
            sender.replaceTrack(screenVideoTrack);
          }
        });
        
        this.state.isScreenSharing = true;
        this.state.isVideoMuted = false; 
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

    this.screenStream?.getTracks().forEach(t => t.stop());
    this.screenStream = null;

    const cameraTrack = this.localStream.getVideoTracks()[0];
    
    if (cameraTrack) {
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

  // --- MESSAGING ---

  sendMessage(text: string) {
    const myId = this.getPeerId();
    if (!myId) return;

    const localPart = this.state.participants.find(p => p.id === myId);
    const name = localPart?.name || 'Me';

    const message: Message = {
      type: 'chat-message',
      id: Date.now().toString(),
      senderId: myId,
      senderName: name,
      text,
      timestamp: Date.now()
    };

    this.state.messages.push({
      id: message.id,
      senderId: myId,
      senderName: name,
      text: text,
      timestamp: message.timestamp
    });

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
        senderId: msg.senderId || peerId,
        senderName: msg.senderName,
        text: msg.text,
        timestamp: msg.timestamp
      });
      this.notify();

      if (this.isHost()) {
        this.connections.forEach(conn => {
            if (conn.peer !== peerId && conn.open) {
                conn.send(msg);
            }
        });
      }
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
    else if (msg.type === 'active-peers') {
        console.log("Received active peers list:", msg.peers);
        msg.peers.forEach(p => {
            if (p.id !== this.getPeerId()) {
                this.connectToPeer(p.id, p.name);
            }
        });
    }
    else if (msg.type === 'peer-left') {
        this.handlePeerDisconnection(msg.peerId);
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

  // --- HOST LOGIC ---

  async startHosting(roomId: string, authToken: string, name: string, isApiKey: boolean = false) {
    if (!this.localStream) await this.initializeMedia();

    this.peer = new Peer({ config: { iceServers: ICE_SERVERS } });

    this.peer.on('open', async (id) => {
      try {
        if (isApiKey) {
            await fetch(`/api/rooms/${roomId}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${authToken}`
            },
            body: JSON.stringify({ hostPeerId: id })
            });
        } else {
            await fetch(`/api/rooms/${roomId}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ password: authToken, hostPeerId: id })
            });
        }
      } catch (e) {
          console.error("Failed to register host", e);
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

    // 2. Prepare list of EXISTING peers to send to the NEW guy
    const existingPeers = this.state.participants
        .filter(p => p.id !== this.getPeerId() && p.id !== peerId)
        .map(p => ({ id: p.id, name: p.name }));

    // 3. Send the list so New guy can call them (Mesh)
    if (existingPeers.length > 0) {
        setTimeout(() => {
            waiter.conn.send({ type: 'active-peers', peers: existingPeers });
        }, 500); 
    }

    // 4. Host initiates Call to New Guy
    const myName = this.state.participants.find(p => p.id === this.getPeerId())?.name || "Host";
    const call = this.peer!.call(peerId, this.localStream!, {
        metadata: { name: myName }
    });
    
    // 5. Update state using setupCall to avoid duplicates
    this.setupCall(call, waiter.name);

    // 6. Ensure role is correct (setupCall defaults to participant, but just in case)
    const p = this.state.participants.find(p => p.id === peerId);
    if (p) {
        p.role = 'participant';
        p.status = 'connected';
    }
    
    this.addSystemMessage(`${waiter.name} joined the meeting`);
    
    this.state.waitingPeers.splice(waiterIndex, 1);
    this.notify();
  }

  rejectParticipant(peerId: string) {
    const waiterIndex = this.state.waitingPeers.findIndex(p => p.peerId === peerId);
    if (waiterIndex === -1) return;
    
    const waiter = this.state.waitingPeers[waiterIndex];
    waiter.conn.send({ type: 'join-rejected' });
    waiter.conn.close();
    
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

    this.peer.on('call', (call) => {
      call.answer(this.localStream!);
      
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const callerName = (call.metadata as any)?.name || "Participant";
      
      this.setupCall(call, callerName);
      
      if (this.state.connectionState !== 'active') {
          this.state.connectionState = 'active';
      }
      this.notify();
    });
  }

  connectToPeer(peerId: string, name: string) {
    if (!this.localStream || !this.peer) return;

    const myName = this.getMyName();
    
    const call = this.peer.call(peerId, this.localStream, {
        metadata: { name: myName }
    });
    
    this.setupCall(call, name);
  }

  // --- INTERNAL UTILS ---

  private setupDataConnection(conn: DataConnection, joinName?: string) {
    conn.on('open', () => {
      if (joinName) {
        this.state.connectionState = 'waiting';
        this.notify();
        conn.send({ type: 'join-request', name: joinName });
      }
      this.broadcastStatusUpdate();
    });

    conn.on('data', (data: unknown) => {
      const msg = data as Message;
      
      if (msg.type === 'join-request') {
        this.state.waitingPeers.push({ peerId: conn.peer, name: msg.name, conn });
        this.notify();
      } else if (msg.type === 'join-accepted') {
        this.state.connectionState = 'connected';
        // Check if Host entry exists before pushing to avoid duplicates
        if (!this.state.participants.some(p => p.id === conn.peer)) {
            this.state.participants.push({
                id: conn.peer,
                name: "Host", 
                role: 'host',
                status: 'connected',
                hasAudio: true,
                hasVideo: true,
                isScreenSharing: false
            });
        }
        this.notify();
      } else if (msg.type === 'join-rejected') {
        this.state.error = "Host rejected your request";
        this.state.connectionState = 'disconnected';
        this.notify();
        conn.close();
      } else {
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

  private setupCall(call: MediaConnection, nameOverride?: string) {
    let p = this.state.participants.find(p => p.id === call.peer);
    
    if (!p) {
        // Create new participant entry if one doesn't exist
        p = {
          id: call.peer,
          name: nameOverride || "User",
          role: 'participant',
          status: 'connected',
          hasAudio: true,
          hasVideo: true,
          isScreenSharing: false
        };
        this.state.participants.push(p);
    } else {
        // Update existing entry
        if (nameOverride) p.name = nameOverride;
        p.status = 'connected';
    }

    call.on('stream', (remoteStream) => {
      const participant = this.state.participants.find(p => p.id === call.peer);
      if (participant) {
        participant.stream = remoteStream;
        participant.hasVideo = remoteStream.getVideoTracks().length > 0 && remoteStream.getVideoTracks()[0].enabled;
        participant.hasAudio = remoteStream.getAudioTracks().length > 0 && remoteStream.getAudioTracks()[0].enabled;
        this.notify();
      }
    });

    call.on('close', () => {
      this.handlePeerDisconnection(call.peer);
    });
    
    call.on('error', (err) => {
      console.error("Call error", err);
      this.handlePeerDisconnection(call.peer);
    });

    this.calls.set(call.peer, call);
    this.notify();
  }

  private handlePeerDisconnection(peerId: string) {
      if (this.isHost()) {
          this.connections.forEach(conn => {
              if (conn.open && conn.peer !== peerId) {
                  conn.send({ type: 'peer-left', peerId });
              }
          });
      }

      const participant = this.state.participants.find(p => p.id === peerId);
      if (participant) {
        this.addSystemMessage(`${participant.name} left the meeting`);
      }

      this.state.participants = this.state.participants.filter(p => p.id !== peerId);
      this.state.waitingPeers = this.state.waitingPeers.filter(p => p.peerId !== peerId);
      
      this.connections.delete(peerId);
      this.calls.delete(peerId);
      
      const interval = this.trackMonitoringIntervals.get(peerId);
      if (interval) {
        clearInterval(interval);
        this.trackMonitoringIntervals.delete(peerId);
      }

      this.notify();
  }

  private updateLocalParticipantState() {
    const myId = this.getPeerId();
    const localP = this.state.participants.find(p => p.id === myId);
    if (localP) {
      localP.hasAudio = !this.state.isAudioMuted;
      localP.hasVideo = !this.state.isVideoMuted;
      localP.isScreenSharing = this.state.isScreenSharing;
    }
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
      return this.state.isScreenSharing && this.screenStream ? this.screenStream : this.localStream;
  }
  
  getPeerId() { return this.peer?.id; }
  
  getMyName() {
      return this.state.participants.find(p => p.id === this.getPeerId())?.name || "Me";
  }

  isHost() {
      return this.state.participants.find(p => p.id === this.getPeerId())?.role === 'host';
  }

  leave() {
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
    this.notify();
  }
}

export default MeetingManager;