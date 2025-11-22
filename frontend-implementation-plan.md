# Frontend Implementation Plan for Meeting Room System

## Overview
This document outlines the complete frontend implementation for the new persistent meeting room system, replacing the current temporary short code interface.

## 1. New Page Structure

### Updated Route Structure
```
/                           # Main page - Create/Join rooms
/create                    # Room creation page (new)
/room/:roomId              # Room landing page (new)
/room/:roomId/manage       # Room management page (new)
/room/:roomId/join         # Join meeting page (updated)
/room/:roomId/meeting      # In-meeting interface (updated)
```

## 2. Main Page Redesign

### New Main Page Layout
```typescript
// app/[lang]/page.tsx - Updated main page
interface MainPageProps {
  params: Promise<{ lang: string }>;
}

export default async function MainPage({ params }: MainPageProps) {
  const { lang } = await params;
  const t = getTranslations(lang);
  
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-green-50">
      {/* Hero Section */}
      <section className="py-20 px-4">
        <div className="max-w-4xl mx-auto text-center">
          <h1 className="text-4xl md:text-6xl font-bold text-gray-900 mb-6">
            {t("main.title")}
          </h1>
          <p className="text-xl text-gray-600 mb-8">
            {t("main.description")}
          </p>
          
          {/* Action Buttons */}
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link
              href={`/${lang}/create`}
              className="bg-blue-600 text-white px-8 py-4 rounded-lg font-semibold hover:bg-blue-700 transition-colors"
            >
              {t("main.createRoom")}
            </Link>
            <Link
              href={`/${lang}/join`}
              className="bg-green-600 text-white px-8 py-4 rounded-lg font-semibold hover:bg-green-700 transition-colors"
            >
              {t("main.joinRoom")}
            </Link>
          </div>
        </div>
      </section>
      
      {/* Features Section */}
      <section className="py-16 px-4">
        <div className="max-w-6xl mx-auto">
          <h2 className="text-3xl font-bold text-center text-gray-900 mb-12">
            {t("main.features.title")}
          </h2>
          <div className="grid md:grid-cols-3 gap-8">
            <FeatureCard
              icon={<Calendar className="w-8 h-8" />}
              title={t("main.features.schedule.title")}
              description={t("main.features.schedule.description")}
            />
            <FeatureCard
              icon={<Lock className="w-8 h-8" />}
              title={t("main.features.secure.title")}
              description={t("main.features.secure.description")}
            />
            <FeatureCard
              icon={<Users className="w-8 h-8" />}
              title={t("main.features.multi.title")}
              description={t("main.features.multi.description")}
            />
          </div>
        </div>
      </section>
    </div>
  );
}
```

### Quick Join Section
```typescript
// Quick join component on main page
function QuickJoinSection({ lang }: { lang: string }) {
  const [roomId, setRoomId] = useState("");
  const [participantName, setParticipantName] = useState("");
  
  const handleQuickJoin = () => {
    if (roomId.trim() && participantName.trim()) {
      window.location.href = `/${lang}/room/${roomId}/join?name=${encodeURIComponent(participantName)}`;
    }
  };
  
  return (
    <section className="py-12 px-4 bg-gray-50">
      <div className="max-w-2xl mx-auto">
        <h3 className="text-2xl font-bold text-center text-gray-900 mb-6">
          Quick Join
        </h3>
        <div className="bg-white rounded-lg shadow-md p-6">
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Room ID
              </label>
              <input
                type="text"
                value={roomId}
                onChange={(e) => setRoomId(e.target.value.toUpperCase())}
                placeholder="Enter room ID (e.g., ABC123)"
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Your Name
              </label>
              <input
                type="text"
                value={participantName}
                onChange={(e) => setParticipantName(e.target.value)}
                placeholder="Enter your name"
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
            <button
              onClick={handleQuickJoin}
              disabled={!roomId.trim() || !participantName.trim()}
              className="w-full bg-green-600 text-white px-6 py-3 rounded-lg font-semibold hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Join Meeting
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}
```

## 3. Room Creation Page

### New Room Creation Form
```typescript
// app/[lang]/create/page.tsx - New room creation page
export default async function CreateRoomPage({ params }: CreateRoomPageProps) {
  const { lang } = await params;
  const t = getTranslations(lang);
  
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-green-50">
      <Header lang={lang} />
      
      <main className="max-w-2xl mx-auto px-4 py-8">
        <div className="bg-white rounded-xl shadow-lg border border-gray-200 p-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            {t("create.title")}
          </h1>
          <p className="text-gray-600 mb-8">
            {t("create.description")}
          </p>
          
          <RoomCreationForm lang={lang} />
        </div>
      </main>
    </div>
  );
}

function RoomCreationForm({ lang }: { lang: string }) {
  const [formData, setFormData] = useState({
    title: "",
    description: "",
    meetingDate: "",
    meetingTime: "",
    password: "",
    confirmPassword: "",
    maxParticipants: "",
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone
  });
  
  const [isCreating, setIsCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [createdRoom, setCreatedRoom] = useState<any>(null);
  
  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };
  
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsCreating(true);
    
    try {
      // Validate passwords match
      if (formData.password !== formData.confirmPassword) {
        throw new Error("Passwords do not match");
      }
      
      // Create room
      const response = await fetch("/api/rooms", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: formData.title,
          description: formData.description,
          meetingDate: formData.meetingDate,
          meetingTime: formData.meetingTime,
          password: formData.password,
          maxParticipants: formData.maxParticipants ? parseInt(formData.maxParticipants) : undefined,
          timezone: formData.timezone
        })
      });
      
      const result = await response.json();
      
      if (result.success) {
        setCreatedRoom(result);
      } else {
        throw new Error(result.error || "Failed to create room");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setIsCreating(false);
    }
  };
  
  if (createdRoom) {
    return <RoomCreatedSuccess room={createdRoom} lang={lang} />;
  }
  
  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Room Title */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Room Title *
        </label>
        <input
          type="text"
          value={formData.title}
          onChange={(e) => handleInputChange("title", e.target.value)}
          placeholder="e.g., Team Standup, Client Review"
          className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          required
        />
      </div>
      
      {/* Description */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Description
        </label>
        <textarea
          value={formData.description}
          onChange={(e) => handleInputChange("description", e.target.value)}
          placeholder="Optional meeting description"
          rows={3}
          className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
        />
      </div>
      
      {/* Date and Time */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Meeting Date *
          </label>
          <input
            type="date"
            value={formData.meetingDate}
            onChange={(e) => handleInputChange("meetingDate", e.target.value)}
            min={new Date().toISOString().split('T')[0]}
            className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            required
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Meeting Time *
          </label>
          <input
            type="time"
            value={formData.meetingTime}
            onChange={(e) => handleInputChange("meetingTime", e.target.value)}
            className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            required
          />
        </div>
      </div>
      
      {/* Password */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Admin Password *
          </label>
          <input
            type="password"
            value={formData.password}
            onChange={(e) => handleInputChange("password", e.target.value)}
            placeholder="Manage room settings"
            className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            required
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Confirm Password *
          </label>
          <input
            type="password"
            value={formData.confirmPassword}
            onChange={(e) => handleInputChange("confirmPassword", e.target.value)}
            placeholder="Re-enter password"
            className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            required
          />
        </div>
      </div>
      
      {/* Advanced Options */}
      <details className="border border-gray-200 rounded-lg">
        <summary className="px-4 py-3 cursor-pointer hover:bg-gray-50">
          Advanced Options
        </summary>
        <div className="p-4 space-y-4 border-t">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Maximum Participants
            </label>
            <input
              type="number"
              value={formData.maxParticipants}
              onChange={(e) => handleInputChange("maxParticipants", e.target.value)}
              placeholder="Optional limit"
              min="2"
              max="50"
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Timezone
            </label>
            <select
              value={formData.timezone}
              onChange={(e) => handleInputChange("timezone", e.target.value)}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="UTC">UTC</option>
              <option value="America/New_York">Eastern Time</option>
              <option value="America/Los_Angeles">Pacific Time</option>
              <option value="Europe/London">London</option>
              <option value="Asia/Tokyo">Tokyo</option>
              <option value="Asia/Shanghai">Shanghai</option>
            </select>
          </div>
        </div>
      </details>
      
      {/* Error Display */}
      {error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
          {error}
        </div>
      )}
      
      {/* Submit Button */}
      <button
        type="submit"
        disabled={isCreating}
        className="w-full bg-blue-600 text-white px-6 py-3 rounded-lg font-semibold hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {isCreating ? "Creating Room..." : "Create Room"}
      </button>
    </form>
  );
}
```

### Room Creation Success Component
```typescript
function RoomCreatedSuccess({ room, lang }: { room: any; lang: string }) {
  const [copied, setCopied] = useState(false);
  
  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(room.roomUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error("Failed to copy link:", err);
    }
  };
  
  return (
    <div className="text-center">
      <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
        <Check className="w-8 h-8 text-green-600" />
      </div>
      
      <h2 className="text-2xl font-bold text-gray-900 mb-2">
        Room Created Successfully!
      </h2>
      
      <div className="bg-gray-50 rounded-lg p-6 mb-6">
        <div className="mb-4">
          <p className="text-sm text-gray-600 mb-1">Room ID</p>
          <p className="text-2xl font-bold font-mono text-blue-600">{room.roomId}</p>
        </div>
        
        <div className="mb-4">
          <p className="text-sm text-gray-600 mb-1">Room Link</p>
          <div className="flex items-center space-x-2">
            <input
              type="text"
              value={room.roomUrl}
              readOnly
              className="flex-1 px-3 py-2 bg-white border border-gray-300 rounded-lg text-sm"
            />
            <button
              onClick={handleCopyLink}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              {copied ? "Copied!" : "Copy"}
            </button>
          </div>
        </div>
        
        <div>
          <p className="text-sm text-gray-600 mb-1">Expires on</p>
          <p className="text-sm font-medium">{new Date(room.expiryDate).toLocaleString()}</p>
        </div>
      </div>
      
      <div className="space-y-3">
        <Link
          href={`/${lang}/room/${room.roomId}`}
          className="block w-full bg-blue-600 text-white px-6 py-3 rounded-lg font-semibold hover:bg-blue-700 transition-colors"
        >
          View Room Page
        </Link>
        
        <Link
          href={`/${lang}`}
          className="block w-full bg-gray-200 text-gray-800 px-6 py-3 rounded-lg font-semibold hover:bg-gray-300 transition-colors"
        >
          Create Another Room
        </Link>
      </div>
      
      <div className="mt-6 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
        <p className="text-sm text-yellow-800">
          <strong>Important:</strong> Save your admin password securely. You'll need it to manage room settings.
        </p>
      </div>
    </div>
  );
}
```

## 4. Room Landing Page

### Room Information Display
```typescript
// app/[lang]/room/[roomId]/page.tsx - Room landing page
export default async function RoomPage({ params }: RoomPageProps) {
  const { lang, roomId } = await params;
  
  // Fetch room information
  const roomResponse = await fetch(`${process.env.NEXT_PUBLIC_APP_URL}/api/rooms/${roomId}`);
  const roomData = await roomResponse.json();
  
  if (!roomData.success) {
    return <RoomNotFound lang={lang} />;
  }
  
  const room = roomData.room;
  const t = getTranslations(lang);
  
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-green-50">
      <Header lang={lang} />
      
      <main className="max-w-4xl mx-auto px-4 py-8">
        <div className="bg-white rounded-xl shadow-lg border border-gray-200 overflow-hidden">
          {/* Room Header */}
          <div className="bg-gradient-to-r from-blue-600 to-green-600 p-8 text-white">
            <div className="text-center">
              <h1 className="text-3xl font-bold mb-2">{room.title}</h1>
              <p className="text-blue-100">Room ID: {room.id}</p>
            </div>
          </div>
          
          {/* Room Details */}
          <div className="p-8">
            <div className="grid md:grid-cols-2 gap-8">
              <div>
                <h2 className="text-xl font-semibold text-gray-900 mb-4">Meeting Details</h2>
                <div className="space-y-3">
                  <div className="flex items-center space-x-3">
                    <Calendar className="w-5 h-5 text-gray-400" />
                    <div>
                      <p className="text-sm text-gray-600">Date</p>
                      <p className="font-medium">{formatDate(room.meetingDate)}</p>
                    </div>
                  </div>
                  <div className="flex items-center space-x-3">
                    <Clock className="w-5 h-5 text-gray-400" />
                    <div>
                      <p className="text-sm text-gray-600">Time</p>
                      <p className="font-medium">{room.meetingTime}</p>
                    </div>
                  </div>
                  <div className="flex items-center space-x-3">
                    <Users className="w-5 h-5 text-gray-400" />
                    <div>
                      <p className="text-sm text-gray-600">Max Participants</p>
                      <p className="font-medium">{room.maxParticipants || "Unlimited"}</p>
                    </div>
                  </div>
                  <div className="flex items-center space-x-3">
                    <Hourglass className="w-5 h-5 text-gray-400" />
                    <div>
                      <p className="text-sm text-gray-600">Expires in</p>
                      <p className="font-medium">{room.timeUntilExpiry} days</p>
                    </div>
                  </div>
                </div>
              </div>
              
              <div>
                <h2 className="text-xl font-semibold text-gray-900 mb-4">Actions</h2>
                <div className="space-y-3">
                  <Link
                    href={`/${lang}/room/${roomId}/join`}
                    className="block w-full bg-green-600 text-white px-6 py-3 rounded-lg font-semibold hover:bg-green-700 transition-colors text-center"
                  >
                    Join Meeting
                  </Link>
                  
                  <Link
                    href={`/${lang}/room/${roomId}/manage`}
                    className="block w-full bg-blue-600 text-white px-6 py-3 rounded-lg font-semibold hover:bg-blue-700 transition-colors text-center"
                  >
                    Manage Room
                  </Link>
                  
                  <button
                    onClick={() => navigator.share({ title: room.title, url: window.location.href })}
                    className="block w-full bg-gray-200 text-gray-800 px-6 py-3 rounded-lg font-semibold hover:bg-gray-300 transition-colors"
                  >
                    Share Room
                  </button>
                </div>
              </div>
            </div>
            
            {room.description && (
              <div className="mt-8 pt-8 border-t">
                <h2 className="text-xl font-semibold text-gray-900 mb-4">Description</h2>
                <p className="text-gray-600">{room.description}</p>
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
```

## 5. Room Management Page

### Room Settings Form
```typescript
// app/[lang]/room/[roomId]/manage/page.tsx - Room management page
function RoomManagementForm({ room, lang }: { room: any; lang: string }) {
  const [formData, setFormData] = useState({
    title: room.title,
    description: room.description || "",
    meetingDate: room.meetingDate,
    meetingTime: room.meetingTime,
    maxParticipants: room.maxParticipants?.toString() || "",
    timezone: room.timezone || "UTC"
  });
  
  const [password, setPassword] = useState("");
  const [isUpdating, setIsUpdating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  
  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsUpdating(true);
    
    try {
      const response = await fetch(`/api/rooms/${room.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          password,
          ...formData
        })
      });
      
      const result = await response.json();
      
      if (result.success) {
        setSuccess(true);
        setTimeout(() => setSuccess(false), 3000);
      } else {
        throw new Error(result.error || "Failed to update room");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setIsUpdating(false);
    }
  };
  
  return (
    <form onSubmit={handleUpdate} className="space-y-6">
      {/* Password verification */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Admin Password *
        </label>
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Enter admin password to make changes"
          className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          required
        />
      </div>
      
      {/* Room settings fields (similar to creation form) */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Room Title
        </label>
        <input
          type="text"
          value={formData.title}
          onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
          className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
        />
      </div>
      
      {/* Other form fields... */}
      
      {/* Success/Error messages */}
      {success && (
        <div className="p-4 bg-green-50 border border-green-200 rounded-lg text-green-700">
          Room updated successfully!
        </div>
      )}
      
      {error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
          {error}
        </div>
      )}
      
      <button
        type="submit"
        disabled={isUpdating}
        className="w-full bg-blue-600 text-white px-6 py-3 rounded-lg font-semibold hover:bg-blue-700 transition-colors disabled:opacity-50"
      >
        {isUpdating ? "Updating..." : "Update Room"}
      </button>
    </form>
  );
}
```

## 6. Updated Join Meeting Flow

### Enhanced Join Page
```typescript
// app/[lang]/room/[roomId]/join/page.tsx - Updated join page
export default async function JoinRoomPage({ params, searchParams }: JoinRoomPageProps) {
  const { lang, roomId } = await params;
  const resolvedParams = await searchParams;
  const participantName = resolvedParams?.name || "";
  
  // Fetch room information
  const roomResponse = await fetch(`${process.env.NEXT_PUBLIC_APP_URL}/api/rooms/${roomId}`);
  const roomData = await roomResponse.json();
  
  if (!roomData.success) {
    return <RoomNotFound lang={lang} />;
  }
  
  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 via-white to-blue-50">
      <Header lang={lang} />
      
      <main className="max-w-2xl mx-auto px-4 py-8">
        <div className="bg-white rounded-xl shadow-lg border border-gray-200 p-8">
          <RoomJoinInterface 
            room={roomData.room} 
            roomId={roomId}
            initialName={participantName}
            lang={lang} 
          />
        </div>
      </main>
    </div>
  );
}

function RoomJoinInterface({ room, roomId, initialName, lang }: RoomJoinInterfaceProps) {
  const [participantName, setParticipantName] = useState(initialName);
  const [isJoining, setIsJoining] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const handleJoin = async () => {
    if (!participantName.trim()) {
      setError("Please enter your name");
      return;
    }
    
    setIsJoining(true);
    setError(null);
    
    try {
      const response = await fetch(`/api/rooms/${roomId}/join`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ participantName })
      });
      
      const result = await response.json();
      
      if (result.success) {
        // Redirect to meeting interface
        window.location.href = `/${lang}/room/${roomId}/meeting?name=${encodeURIComponent(participantName)}&meetingId=${result.meetingId}`;
      } else {
        throw new Error(result.error || "Failed to join room");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setIsJoining(false);
    }
  };
  
  return (
    <div>
      {/* Room info display */}
      <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
        <h3 className="font-semibold text-blue-900 mb-2">{room.title}</h3>
        <div className="text-sm text-blue-700 space-y-1">
          <p>Date: {formatDate(room.meetingDate)} at {room.meetingTime}</p>
          <p>Room ID: {roomId}</p>
        </div>
      </div>
      
      {/* Join form */}
      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Your Name *
          </label>
          <input
            type="text"
            value={participantName}
            onChange={(e) => setParticipantName(e.target.value)}
            placeholder="Enter your name"
            className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500"
          />
        </div>
        
        {error && (
          <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
            {error}
          </div>
        )}
        
        <button
          onClick={handleJoin}
          disabled={isJoining || !participantName.trim()}
          className="w-full bg-green-600 text-white px-6 py-3 rounded-lg font-semibold hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isJoining ? "Joining..." : "Join Meeting"}
        </button>
      </div>
    </div>
  );
}
```

## 7. Updated Meeting Interface

### Room-Based Meeting Component
```typescript
// app/[lang]/room/[roomId]/meeting/page.tsx - Updated meeting interface
export default async function MeetingPage({ params, searchParams }: MeetingPageProps) {
  const { lang, roomId } = await params;
  const resolvedParams = await searchParams;
  const participantName = resolvedParams?.name || "";
  const meetingId = resolvedParams?.meetingId || "";
  
  return (
    <div className="min-h-screen bg-gray-900">
      <MeetingInterface 
        roomId={roomId}
        meetingId={meetingId}
        participantName={participantName}
        lang={lang} 
      />
    </div>
  );
}

function MeetingInterface({ roomId, meetingId, participantName, lang }: MeetingInterfaceProps) {
  const [connectionState, setConnectionState] = useState<ConnectionState>("connecting");
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  
  useEffect(() => {
    // Initialize meeting with room-based system
    const meetingManager = MeetingManager.getInstance();
    
    // Join room-based meeting
    meetingManager.joinRoomMeeting(roomId, meetingId, participantName)
      .then(() => {
        setConnectionState("connected");
      })
      .catch((err) => {
        console.error("Failed to join meeting:", err);
        setConnectionState("error");
      });
    
    return () => {
      meetingManager.leaveMeeting();
    };
  }, [roomId, meetingId, participantName]);
  
  return (
    <div className="h-screen flex flex-col">
      {/* Meeting header */}
      <header className="bg-gray-800 px-4 py-3 flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <h1 className="text-white font-semibold">Room {roomId}</h1>
          <div className="flex items-center space-x-2 text-gray-300">
            <Users className="w-4 h-4" />
            <span className="text-sm">{participants.length + 1} participants</span>
          </div>
        </div>
        
        <MeetingControls />
      </header>
      
      {/* Video grid */}
      <div className="flex-1 p-4">
        <VideoGrid
          participants={participants}
          localStream={localStream}
          localParticipantName={participantName}
        />
      </div>
    </div>
  );
}
```

## 8. Utility Components

### Date/Time Formatting
```typescript
// lib/date-utils.ts
export function formatDate(dateString: string): string {
  const date = new Date(dateString);
  return date.toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });
}

export function formatTime(timeString: string): string {
  const [hours, minutes] = timeString.split(':');
  const hour = parseInt(hours);
  const ampm = hour >= 12 ? 'PM' : 'AM';
  const displayHour = hour % 12 || 12;
  return `${displayHour}:${minutes} ${ampm}`;
}

export function getTimeUntilExpiry(expiryDate: string): string {
  const now = new Date();
  const expiry = new Date(expiryDate);
  const diffTime = expiry.getTime() - now.getTime();
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  
  if (diffDays < 0) return "Expired";
  if (diffDays === 0) return "Expires today";
  if (diffDays === 1) return "Expires tomorrow";
  return `Expires in ${diffDays} days`;
}
```

### QR Code Generation
```typescript
// components/room-qr-code.tsx
export function RoomQRCode({ roomId, roomUrl }: { roomId: string; roomUrl: string }) {
  const qrRef = useRef<HTMLDivElement>(null);
  
  useEffect(() => {
    if (qrRef.current) {
      // Generate QR code for room URL
      QRCode.toCanvas(qrRef.current, roomUrl, {
        width: 200,
        margin: 2,
        color: {
          dark: '#1f2937',
          light: '#ffffff'
        }
      });
    }
  }, [roomUrl]);
  
  return (
    <div className="text-center">
      <div ref={qrRef} className="inline-block" />
      <p className="text-sm text-gray-600 mt-2">Scan to join room</p>
    </div>
  );
}
```

## 9. Localization Updates

### New Translation Keys
```json
// locales/en/common.json
{
  "main": {
    "title": "P2P Meeting - Secure Video Meetings",
    "description": "Create and join secure video meetings with persistent rooms. Schedule meetings in advance and share permanent links.",
    "createRoom": "Create Room",
    "joinRoom": "Join Room",
    "features": {
      "title": "Why Choose P2P Meeting?",
      "schedule": {
        "title": "Schedule in Advance",
        "description": "Create persistent meeting rooms and share links before the meeting starts"
      },
      "secure": {
        "title": "Secure & Private",
        "description": "End-to-end encrypted video calls with no data stored on servers"
      },
      "multi": {
        "title": "Multiple Participants",
        "description": "Support for multiple participants with professional meeting controls"
      }
    }
  },
  "create": {
    "title": "Create Meeting Room",
    "description": "Set up a persistent meeting room that you can share with participants"
  },
  "room": {
    "notFound": "Room not found",
    "expired": "This room has expired",
    "join": "Join Meeting",
    "manage": "Manage Room",
    "share": "Share Room"
  }
}
```

## 10. Implementation Steps

### Phase 1: Backend Integration
1. Implement all API endpoints in `/api/rooms/`
2. Set up KV storage for meeting rooms
3. Add room validation and expiration logic
4. Test API endpoints with various scenarios

### Phase 2: Frontend Pages
1. Create room creation page (`/create`)
2. Implement room landing page (`/room/[roomId]`)
3. Build room management interface (`/room/[roomId]/manage`)
4. Update join meeting flow (`/room/[roomId]/join`)

### Phase 3: Meeting Integration
1. Update MeetingManager to use room-based system
2. Modify meeting interface to work with room IDs
3. Test complete room lifecycle
4. Add error handling and user feedback

### Phase 4: Polish & Testing
1. Add loading states and error handling
2. Implement responsive design
3. Add accessibility features
4. Test across different browsers and devices

This comprehensive frontend implementation plan provides a complete user experience for the new persistent meeting room system, with professional UI components and intuitive workflows.