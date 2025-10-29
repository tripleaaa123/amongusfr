# Among Us PWA

A mobile-first Progressive Web App (PWA) for playing Among Us-style games with friends. Built with Remix, Firebase, and deployable to Vercel.

## Features

- **PWA Installable**: Works offline and installable on mobile devices
- **Real-time Gameplay**: Firebase RTDB for live game state
- **Multiple Roles**: Impostor, Crewmate, and Snitch roles
- **Task System**: Physical (QR-based) and digital mini-game tasks
- **Sabotage & Meetings**: Global interrupts with synchronized gameplay
- **Accessory Devices**: Master/Slave devices for enhanced gameplay
- **Photo Proofs**: Camera integration for task completion
- **Ghost Tasks**: Dead players can continue with digital tasks

## Setup

### 1. Firebase Setup

1. Create a Firebase project at https://console.firebase.google.com
2. Enable:
   - Realtime Database
   - Storage
   - Authentication (Anonymous)
   - Cloud Functions (Blaze plan required)

3. Copy Firebase config to `.env`:
   ```bash
   cp .env.example .env
   # Edit .env with your Firebase credentials
   ```

### 2. Install Dependencies

```bash
# Main app
npm install

# Firebase Functions
cd functions
npm install
cd ..
```

### 3. Deploy Firebase

```bash
# Deploy database rules, storage rules, and functions
firebase deploy
```

### 4. Generate QR Codes

```bash
# Generate QR codes for physical tasks
node scripts/generate-qr.js your-game-id

# This creates qr-codes/your-game-id/index.html
# Print this page for physical task locations
```

## Development

```bash
# Run development server
npm run dev

# Build for production
npm run build

# Type check
npm run typecheck
```

## Deployment to Vercel

1. Install Vercel CLI:
   ```bash
   npm i -g vercel
   ```

2. Deploy:
   ```bash
   vercel
   ```

3. Set environment variables in Vercel dashboard

## Game Flow

1. **Create Game**: Host creates game, gets game code + accessory code
2. **Join**: Players join with game code + nickname
3. **Configure**: Host adjusts settings (impostors, tasks, timers)
4. **Start**: Roles and tasks assigned randomly
5. **Play**:
   - Complete tasks (scan QR → take photo or play mini-game)
   - Impostors sabotage and eliminate players
   - Call meetings to vote out suspects
6. **Win Conditions**:
   - Impostors win: alive impostors ≥ alive crewmates
   - Crewmates win: all tasks complete or all impostors eliminated

## Task Types

- **Physical Tasks**: Scan QR code at location → take photo proof
- **Digital Tasks**: Complete mini-games (reaction test, wire matching)
- **Ghost Tasks**: Dead crewmates get digital versions of remaining tasks

## Accessory Devices

Use tablets/phones as accessory devices:

- **MASTER**: Controls meetings, plays alarm during sabotage
- **SLAVE**: Co-op partner for sabotage mini-games

## Configuration Options

- Number of impostors and snitches
- Task pool size and tasks per player
- Physical/digital task ratio
- Timer durations (sabotage, meeting, voting)
- Cooldown periods
- Voting policies (abstain allowed, tie resolution)

## Security

- Anonymous authentication only
- Server-side validation for all game-changing actions
- Signed JWT tokens for QR codes
- Role information hidden from other players

## License

MIT
# amongusfr
