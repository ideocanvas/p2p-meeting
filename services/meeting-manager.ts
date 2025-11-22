"use client";

import Peer, { DataConnection } from "peerjs";
import { ICE_SERVERS } from "@/lib/connection-strategies";
import { LogEntry } from "@/components/connection-logger";
import { Participant, MeetingRoom, WebRTCMessage, ConnectionState, IMediaStream } from "@/lib/types";

interface MeetingManagerCallbacks {
  onConnectionStateChange: (state: ConnectionState) => void;
  onParticipantJoined?: (participant: Participant) => void;
  onParticipantLeft?: (participantId: string) => void;
  onLog?: (log: LogEntry) => void;
}

const MEETING_TIMEOUT = 2 * 60 * 60 * 1000; // 2 hours
const MAX_PARTICIPANTS = 10;

class MeetingManager {
  private static instance: MeetingManager;
  private peer: Peer;
  private connections: Map<string, DataConnection> = new Map();
  private mediaConnections: Map<string, RTCPeerConnection> = new Map();
  private remoteStreams: Map<string, IMediaStream> = new Map();
  private roomId: string = '';
  private role: 'host' | 'participant' = 'host';
  private callbacks: MeetingManagerCallbacks[] = [];
  private peerId: string | null = null;
  private localStream: IMediaStream | null = null;

  // State management
  private connectionState: ConnectionState = "waiting";
  private participants: Participant[] = [];
  private error: string | null = null;
  private verificationCode: string | null = null;
  private isVerified: boolean = false;
  private meetingRoom: MeetingRoom | null = null;

  // Refs for cleanup
  private timeoutRef: NodeJS.Timeout | null = null;
  private pendingVerifications: Map<string, string> = new Map(); // participantId -> verificationCode

  static getInstance(): MeetingManager {
    if (!MeetingManager.instance) {
      MeetingManager.instance = new MeetingManager();
    }
    return MeetingManager.instance;
  }

  private constructor() {
    // Create global Peer instance once
    this.peer = new Peer({
      debug: 1,
      config: { iceServers: ICE_SERVERS },
      host: "0.peerjs.com",
      port: 443,
      secure: true,
      path: "/",
    });

    this.peer.on('open', (id) => {
      console.log('Global Peer instance ready with ID:', id);
      this.peerId = id;
    });

    this.peer.on('error', (err) => {
      console.error('Global Peer error:', err);
    });

    this.peer.on('connection', (conn) => {
      this.handleIncomingConnection(conn);
    });
  }

  subscribe(callbacks: MeetingManagerCallbacks): () => void {
    this.callbacks.push(callbacks);

    // Immediately notify of current state
    callbacks.onConnectionStateChange(this.connectionState);

    return () => {
      this.callbacks = this.callbacks.filter(cb => cb !== callbacks);
    };
  }

  private setConnectionState(state: ConnectionState) {
    this.connectionState = state;
    this.callbacks.forEach(cb => cb.onConnectionStateChange(state));
  }

  private log(level: LogEntry["level"], message: string, details?: string) {
    const entry: LogEntry = {
      timestamp: new Date(),
      level,
      message,
      details,
    };

    this.callbacks.forEach(cb => cb.onLog?.(entry));
    console.log(`[${level.toUpperCase()}] ${message}`, details || "");
  }

  private resetTimeout() {
    if (this.timeoutRef) {
      clearTimeout(this.timeoutRef);
    }

    this.timeoutRef = setTimeout(() => {
      if (this.connectionState !== "disconnected") {
        this.log("warning", "Meeting timed out after 2 hours");
        this.error = "Meeting timed out";
        this.setConnectionState("disconnected");
        this.cleanup();
      }
    }, MEETING_TIMEOUT);
  }

  private cleanup() {
    if (this.timeoutRef) clearTimeout(this.timeoutRef);

    // Close all connections
    this.connections.forEach(conn => conn.close());
    this.connections.clear();
    
    // Close all media connections
    this.mediaConnections.forEach(conn => conn.close());
    this.mediaConnections.clear();
    
    // Clear remote streams
    this.remoteStreams.clear();

    // Stop local stream
    if (this.localStream) {
      this.localStream.getTracks().forEach((track: any) => track.stop());
      this.localStream = null;
    }

    // Don't destroy the global peer instance, just close connections
    this.pendingVerifications.clear();
  }

  private generateVerificationCode(): string {
    return Math.floor(100000 + Math.random() * 900000).toString();
  }

  private generateParticipantId(): string {
    return `participant-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  private handleIncomingConnection(conn: DataConnection) {
    const participantId = conn.peer;
    this.log("info", "Incoming connection from participant", participantId);

    conn.on("open", () => {
      this.log("success", "Data channel open with participant", participantId);
      this.setupDataConnection(conn, participantId);
    });

    conn.on("data", async (data: unknown) => {
      await this.handleIncomingData(data, participantId);
    });

    conn.on("close", () => {
      this.log("info", "Connection closed", participantId);
      this.handleParticipantLeft(participantId);
    });

    conn.on("error", (err) => {
      this.log("error", "Connection error", `${participantId}: ${String(err)}`);
    });
  }

  private setupDataConnection(conn: DataConnection, participantId: string) {
    this.connections.set(participantId, conn);

    if (this.role === "host") {
      // Host generates verification code for new participant
      const code = this.generateVerificationCode();
      this.pendingVerifications.set(participantId, code);
      this.verificationCode = code;
      
      const message: WebRTCMessage = {
        type: "verification-request",
        verificationCode: code,
        participantId,
      };
      
      this.sendMessageToParticipant(participantId, message);
      this.log("info", "Verification code sent to participant", `Code: ${code}`);
    } else if (this.role === "participant") {
      // Participant sends join request
      const message: WebRTCMessage = {
        type: "join-request",
        participantId: this.peerId!,
        participantName: "Anonymous", // Will be updated from UI
      };
      
      this.sendMessageToParticipant(participantId, message);
    }
  }

  private async handleIncomingData(data: unknown, participantId: string) {
    if (typeof data !== "object" || data === null) return;

    const dataObj = data as Record<string, unknown>;

    switch (dataObj.type) {
      case "verification-request":
        this.handleVerificationRequest(dataObj, participantId);
        break;
      case "join-request":
        this.handleJoinRequest(dataObj, participantId);
        break;
      case "verification-response":
        await this.handleVerificationResponse(dataObj, participantId);
        break;
      case "join-accepted":
        await this.handleJoinAccepted(dataObj, participantId);
        break;
      case "join-rejected":
        this.handleJoinRejected(dataObj, participantId);
        break;
      case "participant-joined":
        this.handleParticipantJoined(dataObj);
        break;
      case "participant-left":
        this.handleParticipantLeft(dataObj.participantId as string);
        break;
      case "video-offer":
        await this.handleVideoOffer(dataObj, participantId);
        break;
      case "video-answer":
        await this.handleVideoAnswer(dataObj, participantId);
        break;
      case "ice-candidate":
        await this.handleIceCandidate(dataObj, participantId);
        break;
      case "audio-toggle":
      case "video-toggle":
        this.handleMediaToggle(dataObj, participantId);
        break;
      case "meeting-ended":
        this.handleMeetingEnded();
        break;
    }
  }

  private handleVerificationRequest(data: Record<string, unknown>, participantId: string) {
    if (this.role !== "participant") return;

    const verificationCode = data.verificationCode as string;
    this.verificationCode = verificationCode;
    this.setConnectionState("verifying");
    this.log("info", "Verification required", `Code: ${verificationCode}`);
  }

  private handleJoinRequest(data: Record<string, unknown>, participantId: string) {
    if (this.role !== "host") return;

    const participantName = data.participantName as string || "Anonymous";
    
    // Create participant entry
    const participant: Participant = {
      id: participantId,
      name: participantName,
      role: "participant",
      status: "connecting",
      hasVideo: false,
      hasAudio: false,
      joinedAt: Date.now(),
    };

    this.participants.push(participant);
    this.log("info", "Join request received", `${participantName} (${participantId})`);
  }

  private async handleVerificationResponse(data: Record<string, unknown>, participantId: string) {
    if (this.role !== "host") return;

    const enteredCode = data.verificationCode as string;
    const expectedCode = this.pendingVerifications.get(participantId);

    if (enteredCode === expectedCode) {
      // Verification successful, admit participant
      const participant = this.participants.find(p => p.id === participantId);
      if (participant) {
        participant.status = "connected";
        this.log("success", "Participant verified and admitted", participant.name);

        // Send acceptance
        const message: WebRTCMessage = {
          type: "join-accepted",
          participantId,
        };
        this.sendMessageToParticipant(participantId, message);

        // Notify all participants about new participant
        this.broadcastMessage({
          type: "participant-joined",
          participantId,
          participantName: participant.name,
        });

        this.callbacks.forEach(cb => cb.onParticipantJoined?.(participant));
        
        // Start video call with new participant
        await this.startVideoCall(participantId);
      }
    } else {
      // Verification failed
      this.log("error", "Participant verification failed", `Expected: ${expectedCode}, Got: ${enteredCode}`);
      
      const message: WebRTCMessage = {
        type: "join-rejected",
        participantId,
        error: "Incorrect verification code",
      };
      this.sendMessageToParticipant(participantId, message);
    }

    this.pendingVerifications.delete(participantId);
  }

  private async handleJoinAccepted(data: Record<string, unknown>, participantId: string) {
    if (this.role !== "participant") return;

    this.isVerified = true;
    this.setConnectionState("connected");
    this.log("success", "Successfully joined meeting");
    
    // Start video call after being accepted
    await this.startVideoCall(participantId);
  }

  private handleJoinRejected(data: Record<string, unknown>, participantId: string) {
    if (this.role !== "participant") return;

    this.error = data.error as string || "Join request rejected";
    this.log("error", "Join request rejected", this.error);
    this.setConnectionState("disconnected");
  }

  private handleParticipantJoined(data: Record<string, unknown>) {
    const participantId = data.participantId as string;
    const participantName = data.participantName as string;

    // Add participant to list if not already there
    if (!this.participants.find(p => p.id === participantId)) {
      const participant: Participant = {
        id: participantId,
        name: participantName,
        role: "participant",
        status: "connected",
        hasVideo: false,
        hasAudio: false,
        joinedAt: Date.now(),
      };

      this.participants.push(participant);
      this.callbacks.forEach(cb => cb.onParticipantJoined?.(participant));
    }
  }

  private handleParticipantLeft(participantId: string) {
    const index = this.participants.findIndex(p => p.id === participantId);
    if (index !== -1) {
      const participant = this.participants[index];
      this.participants.splice(index, 1);
      this.callbacks.forEach(cb => cb.onParticipantLeft?.(participantId));
    }

    // Remove connection
    this.connections.delete(participantId);
  }

  private async handleVideoOffer(data: Record<string, unknown>, participantId: string) {
    try {
      const offer = data.offer as RTCSessionDescriptionInit;
      
      // Create RTCPeerConnection for this participant
      const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });
      this.mediaConnections.set(participantId, pc);
      
      // Add local stream
      if (this.localStream) {
        this.localStream.getTracks().forEach((track: any) => {
          pc.addTrack(track, this.localStream as MediaStream);
        });
      }
      
      // Handle remote stream
      pc.ontrack = (event) => {
        const remoteStream = event.streams[0];
        this.remoteStreams.set(participantId, remoteStream);
        this.log("success", "Remote media stream received", participantId);
        
        // Update participant with media info
        const participant = this.participants.find(p => p.id === participantId);
        if (participant) {
          participant.hasVideo = remoteStream.getVideoTracks().length > 0;
          participant.hasAudio = remoteStream.getAudioTracks().length > 0;
          participant.stream = remoteStream;
        }
      };
      
      // Handle ICE candidates
      pc.onicecandidate = (event) => {
        if (event.candidate) {
          this.sendMessageToParticipant(participantId, {
            type: "ice-candidate",
            candidate: event.candidate,
          });
        }
      };
      
      // Set remote description and create answer
      await pc.setRemoteDescription(offer);
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);
      
      // Send answer back
      this.sendMessageToParticipant(participantId, {
        type: "video-answer",
        answer: answer,
      });
      
      this.log("success", "Video call established", participantId);
    } catch (err) {
      this.log("error", "Failed to handle video offer", `${participantId}: ${String(err)}`);
    }
  }

  private async handleVideoAnswer(data: Record<string, unknown>, participantId: string) {
    try {
      const answer = data.answer as RTCSessionDescriptionInit;
      const pc = this.mediaConnections.get(participantId);
      
      if (pc) {
        await pc.setRemoteDescription(answer);
        this.log("success", "Video answer processed", participantId);
      }
    } catch (err) {
      this.log("error", "Failed to handle video answer", `${participantId}: ${String(err)}`);
    }
  }

  private async handleIceCandidate(data: Record<string, unknown>, participantId: string) {
    try {
      const candidate = data.candidate as RTCIceCandidateInit;
      const pc = this.mediaConnections.get(participantId);
      
      if (pc) {
        await pc.addIceCandidate(candidate);
      }
    } catch (err) {
      this.log("error", "Failed to handle ICE candidate", `${participantId}: ${String(err)}`);
    }
  }

  private handleMediaToggle(data: Record<string, unknown>, participantId: string) {
    const participant = this.participants.find(p => p.id === participantId);
    if (participant) {
      if (data.type === "audio-toggle") {
        participant.hasAudio = data.hasAudio as boolean;
      } else if (data.type === "video-toggle") {
        participant.hasVideo = data.hasVideo as boolean;
      }
    }
  }

  private handleMeetingEnded() {
    this.log("info", "Meeting ended by host");
    this.setConnectionState("disconnected");
    this.cleanup();
  }

  private sendMessageToParticipant(participantId: string, message: WebRTCMessage) {
    const conn = this.connections.get(participantId);
    if (conn && conn.open) {
      try {
        conn.send(message);
      } catch (err) {
        this.log("error", "Failed to send message", `${participantId}: ${String(err)}`);
      }
    }
  }

  private broadcastMessage(message: WebRTCMessage) {
    this.connections.forEach((conn, participantId) => {
      this.sendMessageToParticipant(participantId, message);
    });
  }

  async createMeeting(): Promise<string> {
    this.role = "host";
    this.cleanup();

    return new Promise((resolve, reject) => {
      try {
        this.setConnectionState("connecting");
        this.log("info", "Creating meeting room");

        // Use the global peer instance
        const peer = this.peer;

        // Set connection timeout
        const connectionTimeoutRef = setTimeout(() => {
          this.log("warning", "Meeting creation timed out after 15s");
          this.error = "Meeting creation timeout";
          this.setConnectionState("disconnected");
          reject(new Error("Meeting creation timeout"));
        }, 15000);

        // Check if peer is already open
        if (this.peerId) {
          this.log("success", `PeerJS peer already open: ${this.peerId}`);
          this.resetTimeout();
          this.roomId = this.peerId;

          // Create meeting room
          this.meetingRoom = {
            id: this.roomId,
            hostId: this.peerId,
            status: "waiting",
            participants: [],
            createdAt: Date.now(),
            requiresVerification: true,
          };

          this.setConnectionState("waiting");
          clearTimeout(connectionTimeoutRef);
          resolve(this.roomId);
        } else {
          // Wait for peer to open
          const openHandler = (id: string) => {
            this.log("success", `PeerJS peer open: ${id}`);
            this.peerId = id;
            this.roomId = id;
            clearTimeout(connectionTimeoutRef);
            this.resetTimeout();

            // Create meeting room
            this.meetingRoom = {
              id: this.roomId,
              hostId: this.peerId,
              status: "waiting",
              participants: [],
              createdAt: Date.now(),
              requiresVerification: true,
            };

            this.setConnectionState("waiting");
            resolve(id);
          };

          peer.once("open", openHandler);
        }
      } catch (err) {
        this.log("error", "Failed to create meeting", String(err));
        this.error = "Failed to create meeting";
        this.setConnectionState("disconnected");
        reject(err);
      }
    });
  }

  async joinMeeting(roomId: string, participantName: string = "Anonymous"): Promise<void> {
    this.role = "participant";
    this.cleanup();

    return new Promise((resolve, reject) => {
      try {
        this.setConnectionState("connecting");
        this.log("info", "Joining meeting room", roomId);

        // Use the global peer instance
        const peer = this.peer;

        // Set connection timeout
        const connectionTimeoutRef = setTimeout(() => {
          this.log("warning", "Meeting join timed out after 15s");
          this.error = "Meeting join timeout";
          this.setConnectionState("disconnected");
          reject(new Error("Meeting join timeout"));
        }, 15000);

        // Check if peer is already open
        if (this.peerId) {
          this.log("success", `PeerJS peer already open: ${this.peerId}`);
          this.resetTimeout();

          // Connect to host
          setTimeout(() => {
            this.log("info", "Attempting to connect to meeting host...");
            const conn = peer.connect(roomId, {
              reliable: true,
              serialization: "binary",
            });

            const connectTimeout = setTimeout(() => {
              this.log("warning", "Connection attempt timed out");
              conn.close();
              this.error = "Connection timeout";
              this.setConnectionState("disconnected");
              reject(new Error("Connection timeout"));
            }, 8000);

            conn.on("open", () => {
              this.log("success", "Data connection established");
              clearTimeout(connectTimeout);
              this.setupDataConnection(conn, roomId);

              // Send join request
              const message: WebRTCMessage = {
                type: "join-request",
                participantId: this.peerId!,
                participantName,
              };
              this.sendMessageToParticipant(roomId, message);

              resolve();
            });

            conn.on("error", (err) => {
              this.log("error", "Connection error", String(err));
              clearTimeout(connectTimeout);
              this.error = "Connection failed";
              this.setConnectionState("disconnected");
              reject(err);
            });
          }, 1000);
        } else {
          // Wait for peer to open
          const openHandler = (id: string) => {
            this.log("success", `PeerJS peer open: ${id}`);
            this.peerId = id;
            clearTimeout(connectionTimeoutRef);
            this.resetTimeout();

            // Connect to host
            setTimeout(() => {
              this.log("info", "Attempting to connect to meeting host...");
              const conn = peer.connect(roomId, {
                reliable: true,
                serialization: "binary",
              });

              const connectTimeout = setTimeout(() => {
                this.log("warning", "Connection attempt timed out");
                conn.close();
                this.error = "Connection timeout";
                this.setConnectionState("disconnected");
                reject(new Error("Connection timeout"));
              }, 8000);

              conn.on("open", () => {
                this.log("success", "Data connection established");
                clearTimeout(connectTimeout);
                this.setupDataConnection(conn, roomId);

                // Send join request
                const message: WebRTCMessage = {
                  type: "join-request",
                  participantId: id,
                  participantName,
                };
                this.sendMessageToParticipant(roomId, message);

                resolve();
              });

              conn.on("error", (err) => {
                this.log("error", "Connection error", String(err));
                clearTimeout(connectTimeout);
                this.error = "Connection failed";
                this.setConnectionState("disconnected");
                reject(err);
              });
            }, 1000);
          };

          peer.once("open", openHandler);
        }
      } catch (err) {
        this.log("error", "Failed to join meeting", String(err));
        this.error = "Failed to join meeting";
        this.setConnectionState("disconnected");
        reject(err);
      }
    });
  }

  admitParticipant(verificationCode: string): boolean {
    if (this.role !== "host") {
      this.log("error", "Only host can admit participants");
      return false;
    }

    // Find participant with this verification code
    for (const [participantId, code] of this.pendingVerifications.entries()) {
      if (code === verificationCode) {
        const participant = this.participants.find(p => p.id === participantId);
        if (participant) {
          participant.status = "connected";
          this.log("success", "Participant admitted", participant.name);

          // Send acceptance
          const message: WebRTCMessage = {
            type: "join-accepted",
            participantId,
          };
          this.sendMessageToParticipant(participantId, message);

          // Notify all participants about new participant
          this.broadcastMessage({
            type: "participant-joined",
            participantId,
            participantName: participant.name,
          });

          this.callbacks.forEach(cb => cb.onParticipantJoined?.(participant));
          this.pendingVerifications.delete(participantId);
          return true;
        }
      }
    }

    this.log("error", "Invalid verification code");
    return false;
  }

  leaveMeeting(): void {
    if (this.role === "host") {
      // Host ending meeting
      this.broadcastMessage({ type: "meeting-ended" });
    }

    this.cleanup();
    this.setConnectionState("disconnected");
  }

  async toggleAudio(): Promise<void> {
    if (this.localStream) {
      const audioTracks = this.localStream.getAudioTracks();
      audioTracks.forEach((track: any) => {
        track.enabled = !track.enabled;
      });

      const hasAudio = audioTracks.some((track: any) => track.enabled);
      
      // Broadcast audio state change
      this.broadcastMessage({
        type: "audio-toggle",
        hasAudio,
      });

      this.log("info", `Audio ${hasAudio ? "enabled" : "disabled"}`);
    }
  }

  async toggleVideo(): Promise<void> {
    if (this.localStream) {
      const videoTracks = this.localStream.getVideoTracks();
      videoTracks.forEach((track: any) => {
        track.enabled = !track.enabled;
      });

      const hasVideo = videoTracks.some((track: any) => track.enabled);
      
      // Broadcast video state change
      this.broadcastMessage({
        type: "video-toggle",
        hasVideo,
      });

      this.log("info", `Video ${hasVideo ? "enabled" : "disabled"}`);
    }
  }

  async enableMedia(): Promise<void> {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: true,
        audio: true,
      });

      this.localStream = stream;
      this.log("success", "Camera and microphone enabled");
    } catch (err) {
      this.log("error", "Failed to enable camera and microphone", String(err));
      this.error = "Failed to enable camera and microphone";
    }
  }

  private async startVideoCall(participantId: string): Promise<void> {
    try {
      if (!this.localStream) {
        await this.enableMedia();
      }

      // Create RTCPeerConnection for this participant
      const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });
      this.mediaConnections.set(participantId, pc);

      // Add local stream to the connection
      if (this.localStream) {
        this.localStream.getTracks().forEach((track: any) => {
          pc.addTrack(track, this.localStream as MediaStream);
        });
      }

      // Handle remote stream
      pc.ontrack = (event) => {
        const remoteStream = event.streams[0];
        this.remoteStreams.set(participantId, remoteStream);
        this.log("success", "Remote media stream received", participantId);
        
        // Update participant with media info
        const participant = this.participants.find(p => p.id === participantId);
        if (participant) {
          participant.hasVideo = remoteStream.getVideoTracks().length > 0;
          participant.hasAudio = remoteStream.getAudioTracks().length > 0;
          participant.stream = remoteStream;
        }
      };

      // Handle ICE candidates
      pc.onicecandidate = (event) => {
        if (event.candidate) {
          this.sendMessageToParticipant(participantId, {
            type: "ice-candidate",
            candidate: event.candidate,
          });
        }
      };

      // Create and send offer
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      
      this.sendMessageToParticipant(participantId, {
        type: "video-offer",
        offer: offer,
      });

      this.log("success", "Video call initiated", participantId);
    } catch (err) {
      this.log("error", "Failed to start video call", `${participantId}: ${String(err)}`);
    }
  }

  getState() {
    return {
      connectionState: this.connectionState,
      participants: [...this.participants],
      error: this.error,
      verificationCode: this.verificationCode,
      isVerified: this.isVerified,
      roomId: this.roomId,
      role: this.role,
      localStream: this.localStream,
      remoteStreams: new Map(this.remoteStreams),
    };
  }
}

export default MeetingManager;
export type { ConnectionState, Participant };