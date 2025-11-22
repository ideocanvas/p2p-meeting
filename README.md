# P2P Meeting

A secure peer-to-peer file sharing application that allows direct file transfers between devices without storing data on servers.

## Features

- **100% Private**: Files are transferred directly between devices. Nothing stored on our servers.
- **No Size Limits**: Send files of any size. Large videos, documents, archives - anything goes.
- **Easy Connection**: Just scan a QR code to connect. No accounts, no apps to download.
- **Secure Transfer**: All transfers are encrypted and secure.
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

1. **Receiver**: Generates a QR code and connection code
2. **Sender**: Scans the QR code or enters the connection code
3. **Verification**: Both parties verify the connection with a 6-digit code
4. **Transfer**: Files are transferred directly using WebRTC

## Security

- All connections use WebRTC with encryption
- Verification codes ensure you're connecting to the right person
- No files are stored on any servers
- Connections timeout after 15 minutes

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