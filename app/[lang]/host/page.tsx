"use client";

import { useState, useEffect } from "react";
import { ArrowLeft, Video, VideoOff, Mic, Phone, Shield, Clock, Copy, Users } from "lucide-react";
import Link from "next/link";
import { QRCodeGenerator } from "@/components/qr-code-generator";
import { ConnectionStatus } from "@/components/connection-status";
import { ConnectionLogger, LogEntry } from "@/components/connection-logger";
import { toast } from "sonner";
import MeetingManager, { ConnectionState, Participant } from "@/services/meeting-manager";
import { LanguageSwitcher } from "@/components/language-switcher";
import { getTranslations } from "@/lib/client-i18n";
import BuyMeACoffee from "@/components/BuyMeACoffee";

function HostPageContent({ params }: { params: Promise<{ lang: string }> }) {
  const [lang, setLang] = useState<"en" | "zh">("en");
  const [t, setT] = useState(() => getTranslations("en"));
  
  useEffect(() => {
    const loadParams = async () => {
      const resolvedParams = await params;
      const validLang = resolvedParams.lang === "zh" ? "zh" : "en";
      setLang(validLang);
      setT(() => getTranslations(validLang));
    };
    loadParams();
  }, [params]);
  
  const [roomId, setRoomId] = useState<string>("");
  const [shortCode, setShortCode] = useState<string>("");
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [enteredCode, setEnteredCode] = useState<string>("");
  const [connectionState, setConnectionState] = useState<ConnectionState>("waiting");
  const [error, setError] = useState<string | null>(null);
  const [verificationCode, setVerificationCode] = useState<string | null>(null);
  const [isVerified, setIsVerified] = useState(false);
  const [copySuccess, setCopySuccess] = useState(false);
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);

  const handleLog = (log: LogEntry) => {
    setLogs((prev) => [...prev, log]);
  };

  const handleParticipantJoined = (participant: Participant) => {
    setParticipants((prev) => [...prev, participant]);
    toast.success(`${participant.name} joined the meeting`);
  };

  const handleParticipantLeft = (participantId: string) => {
    setParticipants((prev) => prev.filter(p => p.id !== participantId));
    const participant = participants.find(p => p.id === participantId);
    if (participant) {
      toast.success(`${participant.name} left the meeting`);
    }
  };

  useEffect(() => {
    const meetingManager = MeetingManager.getInstance();
    
    // Subscribe to state changes
    const unsubscribe = meetingManager.subscribe({
      onConnectionStateChange: (state: ConnectionState) => {
        setConnectionState(state);
        
        // Update other state from meeting manager
        const managerState = meetingManager.getState();
        setParticipants(managerState.participants);
        setError(managerState.error);
        setVerificationCode(managerState.verificationCode);
        setIsVerified(managerState.isVerified);
        
        // Update room ID when available
        if (managerState.roomId && !roomId) {
          setRoomId(managerState.roomId);
          
          // Register short code when room ID is available
          registerShortCode(managerState.roomId);
        }
      },
      onParticipantJoined: handleParticipantJoined,
      onParticipantLeft: handleParticipantLeft,
      onLog: handleLog,
    });

    // Initialize meeting as host with media
    const initializeMeeting = async () => {
      try {
        // Enable media first
        await meetingManager.enableMedia();
        
        // Create meeting
        const id = await meetingManager.createMeeting();
        console.log("Meeting created with room ID:", id);
        setRoomId(id);
        registerShortCode(id);
      } catch (err) {
        console.error("Failed to create meeting:", err);
        setError(t("host.connectionFailed"));
      }
    };
    
    initializeMeeting();

    return () => {
      unsubscribe();
    };
  }, []);

  const registerShortCode = async (roomId: string) => {
    try {
      const response = await fetch("/api/meetings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ roomId }),
      });
      
      const data = await response.json();
      
      if (data.success) {
        setShortCode(data.shortCode);
        handleLog({ timestamp: new Date(), level: "success", message: `${t("host.shortCodeGenerated")}: ${data.shortCode}` });
      } else {
        // Fallback to using room ID if short code generation fails
        setShortCode(roomId);
        handleLog({ timestamp: new Date(), level: "warning", message: t("host.shortCodeFailed"), details: data.error });
        handleLog({ timestamp: new Date(), level: "info", message: "Falling back to using room ID as meeting code" });
      }
    } catch (err) {
      // Fallback to using room ID if API call fails
      setShortCode(roomId);
      handleLog({ timestamp: new Date(), level: "warning", message: t("host.registerFailed"), details: String(err) });
      handleLog({ timestamp: new Date(), level: "info", message: "Falling back to using room ID as meeting code" });
    }
  };

  const handleVerificationSubmit = () => {
    if (enteredCode.trim().length === 6) {
      const meetingManager = MeetingManager.getInstance();
      const success = meetingManager.admitParticipant(enteredCode.trim());
      if (!success) {
        toast.error(t("host.verificationFailed"));
      }
    } else {
      toast.error(t("host.enter6DigitCode"));
    }
  }

  const connectionUrl = `${typeof window !== "undefined" ? window.location.origin : ""}/${lang}/join?room=${shortCode || roomId}`;

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(connectionUrl);
      setCopySuccess(true);
      setTimeout(() => setCopySuccess(false), 2000);
      toast.success(t("receive.linkCopied"));
    } catch (err) {
      toast.error(t("receive.copyFailed"));
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-green-50">
      <header className="sticky top-0 z-50 bg-white/80 backdrop-blur-sm border-b border-gray-200">
        <div className="max-w-6xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <Link
              href={`/${lang}`}
              className="flex items-center space-x-2 text-gray-600 hover:text-gray-900 transition-colors"
            >
              <ArrowLeft className="w-5 h-5" />
              <span>{t("common.backToHome")}</span>
            </Link>
            <h1 className="text-xl font-bold text-gray-900">{t("host.title")}</h1>
            <LanguageSwitcher currentLocale={lang} />
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main Content */}
          <div className="lg:col-span-2">
            <div className="bg-white rounded-xl shadow-lg border border-gray-200">
              <div className="p-8">
                <ConnectionStatus
                  state={connectionState}
                  role="host"
                  participantsCount={participants.length}
                />

                {error && (
                  <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
                    {error}
                  </div>
                )}

                <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-lg text-blue-700 text-sm">
                  <strong>{t("host.connectionMethod")}:</strong> WebRTC (PeerJS)
                </div>

                {/* Waiting for participants */}
                {(connectionState === "waiting" || connectionState === "connecting") && (
                  <div className="text-center">
                    {!roomId ? (
                      <div className="text-center py-8">
                        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
                        <p className="text-gray-600">{t("host.initializing")}</p>
                      </div>
                    ) : (
                      <>
                        <div className="mb-8">
                          <Video className="w-16 h-16 text-blue-600 mx-auto mb-4" />
                          <h2 className="text-2xl font-bold text-gray-900 mb-4">
                            {t("host.readyToHost")}
                          </h2>
                          <p className="text-gray-600 mb-8">
                            {t("host.askParticipants")}
                          </p>
                        </div>

                        <div className="max-w-sm mx-auto mb-8">
                          <QRCodeGenerator url={connectionUrl} />
                        </div>

                        {/* Copy Link Button */}
                        <div className="max-w-md mx-auto mb-6">
                          <button
                            onClick={handleCopyLink}
                            disabled={!roomId}
                            className="w-full flex items-center justify-center space-x-2 bg-blue-600 text-white px-4 py-3 rounded-lg font-semibold hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            <Copy className="w-4 h-4" />
                            <span>{copySuccess ? t("receive.copied") : t("receive.copyLink")}</span>
                          </button>
                          <p className="text-xs text-gray-600 text-center mt-2">
                            {t("receive.copyLinkDescription")}
                          </p>
                        </div>

                        <div className="bg-gradient-to-r from-blue-50 to-green-50 rounded-lg p-6 mb-6">
                          <p className="text-sm font-semibold text-gray-700 mb-3 text-center">
                            {t("host.meetingCode")}
                          </p>
                          <div className="bg-white border-2 border-blue-300 rounded-lg p-4 mb-3">
                            <p className="text-3xl font-bold text-center font-mono tracking-wider text-blue-600">
                              {shortCode ? shortCode : (roomId ? t("host.generating") : t("host.connecting"))}
                            </p>
                          </div>
                          <p className="text-xs text-gray-600 text-center">
                            {t("host.shareCode")}
                          </p>
                        </div>

                        <div className="flex items-center justify-center space-x-4 text-sm text-gray-500">
                          <div className="flex items-center space-x-2">
                            <Shield className="w-4 h-4" />
                            <span>{t("receive.encrypted")}</span>
                          </div>
                          <div className="flex items-center space-x-2">
                            <Clock className="w-4 h-4" />
                            <span>{t("receive.timeout")}</span>
                          </div>
                        </div>
                      </>
                    )}
                  </div>
                )}

                {/* Verifying */}
                {connectionState === "verifying" && (
                  <div className="text-center py-8">
                    <div className="max-w-md mx-auto bg-yellow-50 border-2 border-yellow-300 rounded-lg p-8">
                      <Shield className="w-16 h-16 text-yellow-600 mx-auto mb-4" />
                      <h2 className="text-2xl font-bold text-gray-900 mb-4">
                        {t("host.verificationRequired")}
                      </h2>

                      <p className="text-gray-600 mb-6">
                        {t("host.enterVerificationCode")}
                      </p>
                      
                      {verificationCode && (
                        <div className="mb-4 p-4 bg-white border-2 border-yellow-400 rounded-lg">
                          <p className="text-sm text-gray-600 mb-2">{t("host.participantVerificationCode")}:</p>
                          <div className="text-2xl font-bold font-mono tracking-widest text-yellow-600">
                            {verificationCode}
                          </div>
                        </div>
                      )}
                      
                      <div className="mb-6">
                        <input
                          type="text"
                          value={enteredCode}
                          onChange={(e) => {
                            const value = e.target.value.replace(/\D/g, '').slice(0, 6);
                            setEnteredCode(value);
                          }}
                          placeholder={t("host.codePlaceholder")}
                          maxLength={6}
                          className="w-full px-4 py-4 text-center text-4xl font-bold font-mono tracking-widest border-2 border-yellow-400 rounded-lg focus:ring-2 focus:ring-yellow-500 focus:border-yellow-500"
                        />
                      </div>
                      <button
                        onClick={handleVerificationSubmit}
                        disabled={enteredCode.length !== 6}
                        className="w-full bg-yellow-600 text-white px-6 py-3 rounded-lg font-semibold hover:bg-yellow-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {t("host.verifyConnection")}
                      </button>

                      <p className="text-sm text-gray-600 mt-4">
                        {t("host.verificationDescription")}
                      </p>
                    </div>
                  </div>
                )}

                {/* Meeting in progress */}
                {(connectionState === "connected" || connectionState === "active") && (
                  <div className="mt-6">
                    <h3 className="text-lg font-semibold mb-4">{t("host.meetingInProgress")}</h3>
                    
                    {/* Video Grid for meeting */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                      {/* Local video */}
                      <div className="bg-gray-900 rounded-lg p-2">
                        <div className="aspect-video bg-gray-800 rounded-lg flex items-center justify-center">
                          {localStream ? (
                            <video
                              autoPlay
                              muted
                              playsInline
                              className="w-full h-full object-cover rounded-lg"
                              ref={(videoElement) => {
                                if (videoElement && localStream) {
                                  videoElement.srcObject = localStream;
                                }
                              }}
                            />
                          ) : (
                            <div className="text-center">
                              <VideoOff className="w-16 h-16 text-gray-600 mx-auto mb-2" />
                              <p className="text-gray-400">Your camera is off</p>
                            </div>
                          )}
                        </div>
                        <div className="text-center mt-2">
                          <p className="text-white text-sm">You (Host)</p>
                        </div>
                      </div>
                      
                      {/* Remote videos */}
                      {participants.map((participant) => (
                        <div key={participant.id} className="bg-gray-900 rounded-lg p-2">
                          <div className="aspect-video bg-gray-800 rounded-lg flex items-center justify-center">
                            {participant.stream ? (
                              <video
                                autoPlay
                                playsInline
                                className="w-full h-full object-cover rounded-lg"
                                ref={(videoElement) => {
                                  if (videoElement && participant.stream) {
                                    videoElement.srcObject = participant.stream;
                                  }
                                }}
                              />
                            ) : (
                              <div className="text-center">
                                <VideoOff className="w-16 h-16 text-gray-600 mx-auto mb-2" />
                                <p className="text-gray-400">{participant.name}'s camera off</p>
                              </div>
                            )}
                          </div>
                          <div className="text-center mt-2">
                            <p className="text-white text-sm">{participant.name}</p>
                          </div>
                        </div>
                      ))}
                    </div>

                    {/* Meeting controls */}
                    <div className="flex justify-center space-x-4 mb-6">
                      <button
                        onClick={() => {
                          const meetingManager = MeetingManager.getInstance();
                          meetingManager.toggleAudio();
                        }}
                        className="p-4 bg-blue-600 hover:bg-blue-700 text-white rounded-full transition-colors"
                      >
                        <Mic className="w-6 h-6" />
                      </button>
                      <button
                        onClick={() => {
                          const meetingManager = MeetingManager.getInstance();
                          meetingManager.toggleVideo();
                        }}
                        className="p-4 bg-blue-600 hover:bg-blue-700 text-white rounded-full transition-colors"
                      >
                        <Video className="w-6 h-6" />
                      </button>
                      <button
                        onClick={() => window.location.reload()}
                        className="p-4 bg-red-600 hover:bg-red-700 text-white rounded-full transition-colors"
                      >
                        <Phone className="w-6 h-6 transform rotate-135" />
                      </button>
                    </div>

                    {participants.length === 0 ? (
                      <div className="text-center py-8 text-gray-500">
                        <p>{t("host.waitingForParticipants")}</p>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        <div className="flex items-center space-x-2 mb-4">
                          <Users className="w-5 h-5 text-blue-600" />
                          <span className="text-sm font-medium text-gray-700">
                            {participants.length} {participants.length === 1 ? "participant" : "participants"} in meeting
                          </span>
                        </div>
                        {participants.map((participant) => (
                          <div
                            key={participant.id}
                            className="border rounded-lg p-4 bg-gray-50"
                          >
                            <div className="flex justify-between items-center">
                              <div className="flex items-center space-x-3">
                                <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
                                  <span className="text-blue-600 font-semibold">
                                    {participant.name.charAt(0).toUpperCase()}
                                  </span>
                                </div>
                                <div>
                                  <span className="font-medium">{participant.name}</span>
                                  <div className="flex items-center space-x-2 text-xs text-gray-500">
                                    <span className={`w-2 h-2 rounded-full ${participant.status === 'connected' ? 'bg-green-500' : 'bg-yellow-500'}`}></span>
                                    <span>{participant.status}</span>
                                  </div>
                                </div>
                              </div>
                              <div className="flex items-center space-x-2">
                                {participant.hasVideo && (
                                  <div className="w-6 h-6 bg-green-100 rounded-full flex items-center justify-center">
                                    <Video className="w-3 h-3 text-green-600" />
                                  </div>
                                )}
                                {participant.hasAudio && (
                                  <div className="w-6 h-6 bg-blue-100 rounded-full flex items-center justify-center">
                                    <span className="text-blue-600 text-xs">🎤</span>
                                  </div>
                                )}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {/* Meeting ended */}
                {connectionState === "disconnected" && (
                  <div className="text-center">
                    <div className="mb-6">
                      <h2 className="text-2xl font-bold text-gray-900 mb-4">
                        {t("host.connectionClosed")}
                      </h2>
                      <p className="text-gray-600 mb-8">
                        {t("host.connectionTerminated")}
                      </p>
                    </div>
                    <button
                      onClick={() => window.location.reload()}
                      className="bg-blue-600 text-white px-6 py-3 rounded-lg font-semibold hover:bg-blue-700 transition-colors"
                    >
                      {t("host.startNewMeeting")}
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Connection Logs Sidebar */}
          <div className="lg:col-span-1">
            <ConnectionLogger logs={logs} maxHeight="600px" />
          </div>
        </div>
        
        <BuyMeACoffee language={lang === "zh" ? "zh-TW" : "en"} />
      </main>
    </div>
  );
}

export default async function HostPage({ params }: { params: Promise<{ lang: string }> }) {
  const { lang } = await params;
  const validLang = (lang === "zh" ? "zh" : "en") as "en" | "zh";

  return (
    <div>
      <HostPageContent params={Promise.resolve({ lang: validLang })} />
    </div>
  );
}