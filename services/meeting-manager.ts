"use client";

import Peer, { DataConnection, MediaConnection } from "peerjs";
import { Participant, ConnectionState, ChatMessage } from "@/lib/types";

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
  private _isToggling: boolean = false;
  
  // FIX: Generation ID to handle async race conditions
  private _mediaGenerationId: number = 0;

  private connections: Map<string, DataConnection> = new Map();
  private calls: Map<string, MediaConnection> = new Map();
  private trackMonitoringIntervals: Map<string, NodeJS.Timeout> = new Map(); 

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

  // --- MEDIA MANAGEMENT ---

  private stopStream(stream: MediaStream | null) {
    if (stream) {
      stream.getTracks().forEach(track => {
        track.stop();
        track.enabled = false;
      });
    }
  }

  async initializeMedia() {
    // Increment ID to invalidate any previous pending requests
    const myGenerationId = ++this._mediaGenerationId;

    // 1. Stop any existing streams immediately
    this.stopStream(this.localStream);
    this.localStream = null;

    try {
      // 2. Request new stream
      const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
      
      // 3. Check if we were cleaned up/reset while awaiting
      if (this._mediaGenerationId !== myGenerationId) {
        console.warn("MeetingManager: Stream acquired after cleanup. Stopping track immediately.");
        this.stopStream(stream);
        return;
      }

      this.localStream = stream;
      this.attachLocalTrackListeners();
      
      // Reset mute states
      this.state.isAudioMuted = false;
      this.state.isVideoMuted = false;
      this.notify();
    } catch (e) {
      if (this._mediaGenerationId === myGenerationId) {
        console.error("Media error", e);
        this.state.error = "Could not access camera/microphone";
        this.notify();
      }
    }
  }

  private attachLocalTrackListeners() {
    if (!this.localStream) return;

    this.localStream.getVideoTracks().forEach(track => {
      track.onended = () => {
        console.log("Video track ended (Hardware/System)");
        this.state.isVideoMuted = true;
        this.broadcastStatusUpdate();
        this.notify();
      };
    });

    this.localStream.getAudioTracks().forEach(track => {
      track.onended = () => {
        console.log("Audio track ended (Hardware/System)");
        this.state.isAudioMuted = true;
        this.broadcastStatusUpdate();
        this.notify();
      };
    });
  }

  toggleAudio() {
    if (!this.localStream) return;
    const audioTrack = this.localStream.getAudioTracks()[0];
    
    if (audioTrack) {
      audioTrack.enabled = !audioTrack.enabled;
      this.state.isAudioMuted = !audioTrack.enabled;
      
      this.updateLocalParticipantState();
      this.broadcastStatusUpdate();
      this.notify();
    }
  }

  async toggleVideo() {
    if (this._isToggling) return;
    this._isToggling = true;
    const myGenerationId = this._mediaGenerationId;

    try {
      if (this.state.isScreenSharing) {
        await this.stopScreenShare();
        return;
      }

      if (!this.localStream) {
        await this.initializeMedia();
        return;
      }

      const videoTrack = this.localStream.getVideoTracks()[0];

      if (videoTrack) {
        // Soft toggle
        videoTrack.enabled = !videoTrack.enabled;
        this.state.isVideoMuted = !videoTrack.enabled;
        
        // Force React update by creating new stream reference with same tracks
        this.localStream = new MediaStream(this.localStream.getTracks());
        
        this.updateLocalParticipantState();
        this.broadcastStatusUpdate();
        this.notify();
      } else {
        // Fallback: acquire video track
        const newStream = await navigator.mediaDevices.getUserMedia({ video: true });
        
        // Race condition check
        if (this._mediaGenerationId !== myGenerationId) {
            this.stopStream(newStream);
            return;
        }

        const newTrack = newStream.getVideoTracks()[0];
        this.localStream.addTrack(newTrack);
        await this.replaceVideoTrack(newTrack);
        
        this.state.isVideoMuted = false;
        this.updateLocalParticipantState();
        this.broadcastStatusUpdate();
        this.notify();
      }
    } catch (e) {
      console.error("Toggle Video Error", e);
    } finally {
      this._isToggling = false;
    }
  }

  async startScreenShare() {
    if (this._isToggling) return;
    this._isToggling = true;
    const myGenerationId = this._mediaGenerationId;

    try {
      if (this.state.isScreenSharing) return;

      this.screenStream = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: true });
      
      // Race check
      if (this._mediaGenerationId !== myGenerationId) {
          this.stopStream(this.screenStream);
          this.screenStream = null;
          return;
      }

      const screenVideoTrack = this.screenStream.getVideoTracks()[0];

      screenVideoTrack.onended = () => {
        this.stopScreenShare();
      };

      await this.replaceVideoTrack(screenVideoTrack);
        
      this.state.isScreenSharing = true;
      this.state.isVideoMuted = false; 
      
      this.updateLocalParticipantState();
      this.broadcastStatusUpdate();
      this.notify();
      
    } catch (err) {
      console.error("Failed to share screen", err);
    } finally {
      this._isToggling = false;
    }
  }

  async stopScreenShare() {
    if (!this.state.isScreenSharing) return;

    this.stopStream(this.screenStream);
    this.screenStream = null;

    try {
        if (this.localStream) {
            const camTrack = this.localStream.getVideoTracks()[0];
            if (camTrack) {
                camTrack.enabled = true;
                await this.replaceVideoTrack(camTrack);
                this.state.isVideoMuted = false;
            } else {
                await this.initializeMedia();
            }
        }
    } catch (e) {
        console.error("Failed to revert to camera", e);
    }

    this.state.isScreenSharing = false;
    this.updateLocalParticipantState();
    this.broadcastStatusUpdate();
    this.notify();
  }

  private async replaceVideoTrack(newTrack: MediaStreamTrack) {
    if (this.localStream) {
        const audioTracks = this.localStream.getAudioTracks();
        this.localStream = new MediaStream([...audioTracks, newTrack]);
    }

    const replacePromises = Array.from(this.calls.values()).map(async (call) => {
      const pc = call.peerConnection;
      if (!pc || pc.connectionState === 'closed') return;

      const senders = pc.getSenders();
      const videoSender = senders.find(s => s.track?.kind === 'video') 
                          || senders.find(s => s.track?.kind !== 'audio');

      if (videoSender) {
        try {
          await videoSender.replaceTrack(newTrack);
        } catch (e) {
          console.error(`Failed to replace track for peer ${call.peer}`, e);
        }
      }
    });

    await Promise.all(replacePromises);
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
      if (conn.open) conn.send(message);
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
            if (conn.peer !== peerId && conn.open) conn.send(msg);
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

  // --- CONNECTION LOGIC ---

  async startHosting(roomId: string, authToken: string, name: string, isApiKey: boolean = false) {
    if (!this.localStream) await this.initializeMedia();

    this.peer = new Peer({ config: { iceServers: ICE_SERVERS } });

    this.peer.on('open', async (id) => {
        try {
            const body = isApiKey 
                ? { hostPeerId: id } 
                : { password: authToken, hostPeerId: id };
            
            const headers: HeadersInit = { 'Content-Type': 'application/json' };
            if (isApiKey) headers['Authorization'] = `Bearer ${authToken}`;

            await fetch(`/api/rooms/${roomId}`, { method: 'POST', headers, body: JSON.stringify(body) });
        } catch(e) { console.error(e); }

        this.state.connectionState = 'active';
        this.state.participants = [{
            id, name, role: 'host', status: 'connected',
            hasAudio: !this.state.isAudioMuted, hasVideo: !this.state.isVideoMuted, isScreenSharing: false
        }];
        this.notify();
    });

    this.peer.on('connection', (conn) => this.setupDataConnection(conn));
    this.peer.on('call', (call) => {
        call.answer(this.localStream!);
        this.setupCall(call);
    });
  }

  async joinRoom(hostPeerId: string, name: string) {
    if (!this.localStream) await this.initializeMedia();
    
    this.peer = new Peer({ config: { iceServers: ICE_SERVERS } });
    this.state.connectionState = 'connecting';
    this.notify();

    this.peer.on('open', () => {
      const conn = this.peer!.connect(hostPeerId);
      this.setupDataConnection(conn, name);
    });

    this.peer.on('call', (call) => {
      call.answer(this.localStream!);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const callerName = (call.metadata as any)?.name || "Participant";
      this.setupCall(call, callerName);
      if (this.state.connectionState !== 'active') this.state.connectionState = 'active';
      this.notify();
    });
  }

  approveParticipant(peerId: string) {
    const waiterIndex = this.state.waitingPeers.findIndex(w => w.peerId === peerId);
    if (waiterIndex === -1) return;
    const waiter = this.state.waitingPeers[waiterIndex];

    if (!this.state.participants.some(p => p.id === peerId)) {
      this.state.participants.push({
        id: peerId, name: waiter.name, role: 'participant', status: 'connecting',
        hasAudio: true, hasVideo: true, isScreenSharing: false
      });
    }

    waiter.conn.send({ type: 'join-accepted' });

    const existingPeers = this.state.participants
        .filter(p => p.id !== this.getPeerId() && p.id !== peerId)
        .map(p => ({ id: p.id, name: p.name }));

    if (existingPeers.length > 0) {
        setTimeout(() => { if (waiter.conn.open) waiter.conn.send({ type: 'active-peers', peers: existingPeers }); }, 500);
    }

    const myName = this.getMyName();
    const call = this.peer!.call(peerId, this.localStream!, { metadata: { name: myName } });
    this.setupCall(call, waiter.name);

    const p = this.state.participants.find(p => p.id === peerId);
    if (p) { p.role = 'participant'; p.status = 'connected'; }
    
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

  connectToPeer(peerId: string, name: string) {
    if (!this.localStream || !this.peer || this.calls.has(peerId)) return;
    const myName = this.getMyName();
    const call = this.peer.call(peerId, this.localStream, { metadata: { name: myName } });
    this.setupCall(call, name);
  }

  private setupDataConnection(conn: DataConnection, joinName?: string) {
    conn.on('open', () => {
      if (joinName) {
        this.state.connectionState = 'waiting';
        this.notify();
        conn.send({ type: 'join-request', name: joinName });
      } else {
        this.broadcastStatusUpdate();
      }
    });

    conn.on('data', (data) => {
        const msg = data as Message;
        if (msg.type === 'join-request') {
            this.state.waitingPeers.push({ peerId: conn.peer, name: msg.name, conn });
            this.notify();
        } else if (msg.type === 'join-accepted') {
            this.state.connectionState = 'connected';
            if (!this.state.participants.some(p => p.id === conn.peer)) {
                this.state.participants.push({
                    id: conn.peer, name: "Host", role: 'host', status: 'connected',
                    hasAudio: true, hasVideo: true, isScreenSharing: false
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

    conn.on('close', () => this.handlePeerDisconnection(conn.peer));
    conn.on('error', (e) => { console.error(e); this.handlePeerDisconnection(conn.peer); });
    this.connections.set(conn.peer, conn);
  }

  private setupCall(call: MediaConnection, nameOverride?: string) {
    let participant = this.state.participants.find(p => p.id === call.peer);
    if (!participant) {
        participant = {
            id: call.peer, name: nameOverride || "User", role: 'participant', status: 'connected',
            hasAudio: true, hasVideo: true, isScreenSharing: false
        };
        this.state.participants.push(participant);
    } else if (nameOverride) participant.name = nameOverride;

    call.on('stream', (remoteStream) => {
      const p = this.state.participants.find(part => part.id === call.peer);
      if (p) {
        p.stream = remoteStream;
        this.notify();
      }
    });

    call.on('close', () => this.handlePeerDisconnection(call.peer));
    call.on('error', (e) => { console.error(e); this.handlePeerDisconnection(call.peer); });
    this.calls.set(call.peer, call);
    this.notify();
  }

  private handlePeerDisconnection(peerId: string) {
      if (this.isHost()) {
          this.connections.forEach(conn => {
              if (conn.open && conn.peer !== peerId) conn.send({ type: 'peer-left', peerId });
          });
      }
      const p = this.state.participants.find(part => part.id === peerId);
      if (p) this.addSystemMessage(`${p.name} left the meeting`);

      this.state.participants = this.state.participants.filter(part => part.id !== peerId);
      this.state.waitingPeers = this.state.waitingPeers.filter(w => w.peerId !== peerId);
      this.connections.delete(peerId);
      this.calls.delete(peerId);
      
      const interval = this.trackMonitoringIntervals.get(peerId);
      if (interval) { clearInterval(interval); this.trackMonitoringIntervals.delete(peerId); }
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
          id: Date.now().toString(), senderId: 'system', senderName: 'System', text, timestamp: Date.now(), isSystem: true
      });
      this.notify();
  }

  getLocalStream() {
      if (this.state.isScreenSharing && this.screenStream) return this.screenStream;
      return this.localStream;
  }
  
  getPeerId() { return this.peer?.id; }
  
  getMyName() { return this.state.participants.find(p => p.id === this.getPeerId())?.name || "Me"; }

  isHost() { return this.state.participants.find(p => p.id === this.getPeerId())?.role === 'host'; }

  leave() {
    // FIX: Increment generation ID to invalidate any pending async media requests
    this._mediaGenerationId++;

    if (this.isHost()) {
      const myId = this.getPeerId();
      this.connections.forEach(conn => { if (conn.open) conn.send({ type: 'peer-left', peerId: myId || '' }); });
    }
    this.connections.forEach(c => c.close());
    this.calls.forEach(c => c.close());
    this.trackMonitoringIntervals.forEach(i => clearInterval(i));
    this.trackMonitoringIntervals.clear();
    
    this.peer?.destroy();

    // FIX: Explicitly stop all tracks
    this.stopStream(this.localStream);
    this.stopStream(this.screenStream);
    this.localStream = null;
    this.screenStream = null;
    
    this.connections.clear();
    this.calls.clear();
    this.state = {
      connectionState: 'disconnected', participants: [], waitingPeers: [], messages: [], error: null,
      isAudioMuted: false, isVideoMuted: false, isScreenSharing: false
    };
    this.notify();
  }
}

export default MeetingManager;