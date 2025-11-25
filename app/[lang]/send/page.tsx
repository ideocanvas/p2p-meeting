"use client";

import { useState, useEffect, Suspense } from "react";
import { useSearchParams, useParams } from "next/navigation";
import { ArrowLeft, Video, Phone, Mic, MicOff, VideoOff } from "lucide-react";
import Link from "next/link";
import { ConnectionStatus } from "@/components/connection-status";
import { ConnectionLogger, LogEntry } from "@/components/connection-logger";
import MeetingManager from "@/services/meeting-manager";
import { ConnectionState, Participant } from "@/lib/types";
import { LanguageSwitcher } from "@/components/language-switcher";
import { getTranslations } from "@/lib/client-i18n";
import BuyMeACoffee from "@/components/BuyMeACoffee";
import { VideoPlayer } from "@/components/video-player";

function JoinPageContent() {
  const searchParams = useSearchParams();
  const params = useParams();
  const lang = (params.lang === "zh" ? "zh" : "en") as "en" | "zh";
  const t = getTranslations(lang);
  
  const roomId = searchParams?.get("room");
  const [manualCode, setManualCode] = useState<string>("");
  const [participantName, setParticipantName] = useState<string>("");
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [connectionState, setConnectionState] = useState<ConnectionState>("waiting");
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [verificationCode, setVerificationCode] = useState<string | null>(null);
  const [isVerified, setIsVerified] = useState(false);
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [isAudioEnabled, setIsAudioEnabled] = useState(true);
  const [isVideoEnabled, setIsVideoEnabled] = useState(true);

  const handleLog = (log: LogEntry) => {
    setLogs((prev) => [...prev, log]);
  };

  useEffect(() => {
    if (!roomId) return;

    const meetingManager = MeetingManager.getInstance();
    
    // Subscribe to state changes
    const unsubscribe = meetingManager.subscribe(() => {
      setConnectionState(meetingManager.state.connectionState);
      setParticipants(meetingManager.state.participants);
      setError(meetingManager.state.error);
      setLocalStream(meetingManager.getLocalStream());
    });

    const joinMeeting = async () => {
      try {
        // Check if roomId is a short code (6 characters alphanumeric)
        if (roomId.length === 6 && /^[A-Z0-9]{6}$/i.test(roomId)) {
          // Lookup room ID from short code
          handleLog({ timestamp: new Date(), level: "info", message: "Looking up room ID from short code", details: `Code: ${roomId}` });
          const response = await fetch(`/api/meetings?shortCode=${roomId}`);
          const data = await response.json();
          
          if (data.success) {
            handleLog({ timestamp: new Date(), level: "success", message: "Found room ID from short code", details: `Room ID: ${data.roomId}` });
            // Join using the full room ID
            await meetingManager.joinRoom(data.roomId, participantName || "Anonymous");
          } else {
            handleLog({ timestamp: new Date(), level: "error", message: "Failed to lookup short code", details: data.error });
            setError("Invalid meeting code - please check and try again");
            return;
          }
        } else {
          // Assume it's a full room ID (backward compatibility)
          handleLog({ timestamp: new Date(), level: "info", message: "Using direct room ID connection" });
          await meetingManager.joinRoom(roomId, participantName || "Anonymous");
        }
      } catch (err) {
        console.error("Failed to join meeting:", err);
        setError("Failed to join meeting");
      }
    };

    // Enable media first
    meetingManager.initializeMedia().then(() => {
      joinMeeting();
    }).catch((err: unknown) => {
      console.error("Failed to enable media:", err);
      setError("Failed to enable camera and microphone");
    });

    return () => {
      unsubscribe();
    };
  }, [roomId, participantName]);

  const handleManualCodeSubmit = () => {
    if (manualCode.trim() && participantName.trim()) {
      window.location.href = `/${lang}/join?room=${manualCode.toLowerCase()}&name=${encodeURIComponent(participantName)}`;
    }
  };

  const handleToggleAudio = async () => {
    const meetingManager = MeetingManager.getInstance();
    await meetingManager.toggleAudio();
    setIsAudioEnabled(!isAudioEnabled);
  };

  const handleToggleVideo = async () => {
    const meetingManager = MeetingManager.getInstance();
    await meetingManager.toggleVideo();
    setIsVideoEnabled(!isVideoEnabled);
  };

  const handleLeaveMeeting = () => {
    const meetingManager = MeetingManager.getInstance();
    meetingManager.leave();
    window.location.href = `/${lang}`;
  };

  if (!roomId) {
    return (
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <div className="text-center">
            <Video className="w-16 h-16 text-green-600 mx-auto mb-4" />
            <h2 className="text-2xl font-bold text-gray-900 mb-4">{t("join.connectToHost")}</h2>
            <p className="text-gray-600 mb-8">
              {t("join.enterMeetingCode")}
            </p>

            <div className="max-w-md mx-auto">
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Your Name
                </label>
                <input
                  type="text"
                  value={participantName}
                  onChange={(e) => setParticipantName(e.target.value)}
                  placeholder="Enter your name"
                  className="w-full px-4 py-3 text-center border-2 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500"
                />
              </div>
              <div className="mb-6">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  {t("join.meetingCode")}
                </label>
                <input
                  type="text"
                  value={manualCode}
                  onChange={(e) => setManualCode(e.target.value.replace(/[^a-zA-Z0-9]/g, ""))}
                  placeholder={t("join.enterCodeFromHost")}
                  className="w-full px-4 py-3 text-center text-xl font-mono uppercase border-2 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500"
                />
              </div>
              <button
                onClick={handleManualCodeSubmit}
                disabled={!manualCode.trim() || !participantName.trim()}
                className="w-full bg-green-600 text-white px-6 py-3 rounded-lg font-semibold disabled:opacity-50 disabled:cursor-not-allowed hover:bg-green-700 transition-colors mb-4"
              >
                {t("join.connect")}
              </button>

              <div className="relative my-6">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-gray-300"></div>
                </div>
                <div className="relative flex justify-center text-sm">
                  <span className="px-2 bg-white text-gray-500">{t("common.or")}</span>
                </div>
              </div>

              <Link href={`/${lang}`} className="text-green-600 hover:text-green-700 font-medium">
                ← {t("common.scanQRCodeInstead")}
              </Link>
            </div>
          </div>
        </div>
        <div className="lg:col-span-1">
          <ConnectionLogger logs={logs} maxHeight="400px" />
        </div>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      <div className="lg:col-span-2">
        <ConnectionStatus state={connectionState} role="participant" participantsCount={participants.length} />

        {error && (
          <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
            {error}
          </div>
        )}

        <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-lg text-blue-700 text-sm">
          <strong>{t("common.connectionMethod")}:</strong> {t("common.webrtcPeerJS")}
        </div>

        {/* Connecting */}
        {connectionState === "connecting" && (
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-600 mx-auto mb-4"></div>
            <h2 className="text-2xl font-bold text-gray-900 mb-4">{t("join.connectingToHost")}</h2>
            <p className="text-gray-600">{t("join.establishingConnection")}</p>
          </div>
        )}

        {/* Verifying */}
        {connectionState === "verifying" && (
          <div className="text-center py-8">
            <div className="max-w-md mx-auto bg-yellow-50 border-2 border-yellow-300 rounded-lg p-8">
              <h2 className="text-2xl font-bold text-gray-900 mb-4">{t("common.verificationRequired")}</h2>
              <p className="text-gray-600 mb-6">
                {t("join.shareCodeForVerification")}
              </p>
              <div className="bg-white border-4 border-yellow-400 rounded-lg p-6 mb-4">
                <div className="text-4xl font-bold text-gray-900 tracking-widest">
                  {verificationCode ? (
                    verificationCode
                  ) : (
                    <div className="animate-pulse text-gray-400">{t("common.generating")}</div>
                  )}
                </div>
              </div>
              {verificationCode && (
                <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded-lg">
                  <p className="text-sm text-green-700">
                    ✅ {t("join.verificationCodeSent")}
                  </p>
                </div>
              )}
              <p className="text-sm text-gray-600">
                {t("join.hostMustApprove")}
              </p>
            </div>
          </div>
        )}

        {/* Connected and in meeting */}
        {(connectionState === "connected" || connectionState === "active") && (
          <div className="mt-6">
            <h3 className="text-lg font-semibold mb-4">Meeting in Progress</h3>
            
            {/* Video preview area */}
            <div className="bg-gray-900 rounded-lg p-4 mb-4">
              <VideoPlayer
                stream={localStream}
                isLocal={true}
                name="You"
                isVideoEnabled={isVideoEnabled} // Pass local video state
              />
            </div>

            {/* Meeting controls */}
            <div className="flex justify-center space-x-4 mb-6">
              <button
                onClick={handleToggleAudio}
                className={`p-4 rounded-full transition-colors ${
                  isAudioEnabled
                    ? "bg-blue-600 hover:bg-blue-700 text-white"
                    : "bg-red-600 hover:bg-red-700 text-white"
                }`}
              >
                {isAudioEnabled ? <Mic className="w-6 h-6" /> : <MicOff className="w-6 h-6" />}
              </button>
              <button
                onClick={handleToggleVideo}
                className={`p-4 rounded-full transition-colors ${
                  isVideoEnabled
                    ? "bg-blue-600 hover:bg-blue-700 text-white"
                    : "bg-red-600 hover:bg-red-700 text-white"
                }`}
              >
                {isVideoEnabled ? <Video className="w-6 h-6" /> : <VideoOff className="w-6 h-6" />}
              </button>
              <button
                onClick={handleLeaveMeeting}
                className="p-4 bg-red-600 hover:bg-red-700 text-white rounded-full transition-colors"
              >
                <Phone className="w-6 h-6 transform rotate-135" />
              </button>
            </div>

            {/* Participants list */}
            <div className="bg-gray-50 rounded-lg p-4">
              <h4 className="font-semibold mb-3">Participants ({participants.length + 1})</h4>
              <div className="space-y-2">
                <div className="flex items-center space-x-3 p-2 bg-white rounded">
                  <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
                    <span className="text-blue-600 font-semibold text-sm">You</span>
                  </div>
                  <span className="font-medium">{participantName || "You"}</span>
                </div>
                {participants.map((participant) => (
                  <div key={participant.id} className="flex items-center space-x-3 p-2 bg-white rounded">
                    <div className="w-8 h-8 bg-gray-100 rounded-full flex items-center justify-center">
                      <span className="text-gray-600 font-semibold text-sm">
                        {participant.name.charAt(0).toUpperCase()}
                      </span>
                    </div>
                    <span className="font-medium">{participant.name}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Disconnected */}
        {connectionState === "disconnected" && (
          <div className="text-center">
            <div className="mb-6">
              <h2 className="text-2xl font-bold text-gray-900 mb-4">{t("common.connectionClosed")}</h2>
              <p className="text-gray-600 mb-8">
                {t("join.connectionTerminated")}
              </p>
            </div>
            <Link
              href={`/${lang}`}
              className="inline-block bg-blue-600 text-white px-6 py-3 rounded-lg font-semibold hover:bg-blue-700 transition-colors"
            >
              {t("common.backToHome")}
            </Link>
          </div>
        )}
      </div>

      <div className="lg:col-span-1">
        <ConnectionLogger logs={logs} maxHeight="600px" />
      </div>
    </div>
  );
}

export default async function JoinPage({ params }: { params: Promise<{ lang: string }> }) {
  const { lang } = await params;
  const validLang = (lang === "zh" ? "zh" : "en") as "en" | "zh";
  const t = getTranslations(validLang);

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 via-white to-blue-50">
      <header className="sticky top-0 z-50 bg-white/80 backdrop-blur-sm border-b border-gray-200">
        <div className="max-w-6xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <Link
              href={`/${validLang}`}
              className="flex items-center space-x-2 text-gray-600 hover:text-gray-900 transition-colors"
            >
              <ArrowLeft className="w-5 h-5" />
              <span>{t("common.backToHome")}</span>
            </Link>
            <h1 className="text-xl font-bold text-gray-900">{t("join.title")}</h1>
            <LanguageSwitcher currentLocale={validLang} />
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-8">
        <Suspense fallback={<div>{t("common.loading")}</div>}>
          <JoinPageContent />
        </Suspense>
        
        <BuyMeACoffee language={validLang === "zh" ? "zh-TW" : "en"} />
      </main>
    </div>
  );
}