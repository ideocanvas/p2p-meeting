# P2P Meeting

A secure peer-to-peer video meeting application that allows direct video and audio communication between multiple participants without storing data on servers.

## Features

- **100% Private**: Video and audio are streamed directly between participants. Nothing stored on our servers.
- **Multi-Participant Support**: Connect with multiple people in a single meeting room.
- **Easy Connection**: Just scan a QR code or share a link to join a meeting. No accounts, no apps to download.
- **Secure Communication**: All video and audio streams are encrypted and secure.
- **Cross-platform**: Works on any modern browser with WebRTC support.

## Technology Stack

- **Next.js 15** - React framework with App Router
- **TypeScript** - Type-safe development
- **Tailwind CSS** - Utility-first CSS framework
- **PeerJS** - WebRTC peer-to-peer connections
- **Cloudflare Workers** - Serverless deployment

## Getting Started

### Prerequisites

- Node.js 18+ 
- pnpm package manager

### Installation

1. Clone the repository:
```bash
git clone https://github.com/yourusername/p2p-meeting.git
cd p2p-meeting
```

2. Install dependencies:
```bash
pnpm install
```

3. Start the development server:
```bash
./scripts/dev.sh
```

4. Open [http://localhost:3000](http://localhost:3000) in your browser.

## Development

### Scripts

- `./scripts/dev.sh` - Start the development server
- `./scripts/eslint.sh` - Run ESLint to check code quality
- `./scripts/prisma.sh` - Run Prisma commands (if using database)

### Project Structure

```
app/                 # Next.js app directory
├── [lang]/         # Internationalized routes
├── api/            # API routes
components/         # React components
hooks/             # Custom React hooks
lib/               # Utility libraries
locales/           # Translation files
public/            # Static assets
services/          # Business logic services
```

## Deployment

### Cloudflare Workers

1. Install Wrangler CLI:
```bash
pnpm install -g wrangler
```

2. Login to Cloudflare:
```bash
wrangler login
```

3. Deploy:
```bash
pnpm run deploy
```

## How It Works

1. **Host**: Creates a meeting room and gets a QR code and meeting link
2. **Participants**: Scan the QR code or click the meeting link to join
3. **Verification**: Host verifies participants with a 6-digit code (optional)
4. **Meeting**: Video and audio are streamed directly between all participants using WebRTC

## Security

- All connections use WebRTC with end-to-end encryption
- Meeting codes ensure only invited participants can join
- No video or audio data is stored on any servers
- Meeting rooms timeout after 2 hours

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Run the linter: `./scripts/eslint.sh`
5. Submit a pull request

## License

MIT License - see LICENSE file for details.

## Support

If you encounter any issues or have questions, please open an issue on GitHub.