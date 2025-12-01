# Parry Chess 2D - Development Progress

## Project Overview

A 2D version of Parry Chess - a chess-Sekiro hybrid where attacked pieces can parry incoming attacks. Built with Phaser 3 for cross-platform deployment (Web, Android, iOS, Desktop).

**Repository**: https://github.com/lihogloglo/parry-chess
**Original 3D Version**: `parry-chess/` (Three.js)
**2D Version**: `parry-chess2d/` (Phaser 3)

---

## Tech Stack

| Component | Technology | Purpose |
|-----------|------------|---------|
| Game Engine | Phaser 3.90.0 | 2D rendering, input, animations |
| Build Tool | Vite 7.2.6 | Fast dev server, bundling |
| Chess Logic | chess.js 1.4.0 | Move validation, game rules |
| AI | stockfish.js 10.0.2 | Chess AI opponent |
| Mobile | Capacitor (planned) | iOS/Android builds |
| Desktop | Electron (planned) | Windows/Mac/Linux builds |

---

## Architecture

```
parry-chess2d/
├── src/
│   ├── main.js              # Phaser game initialization
│   ├── scenes/
│   │   ├── BootScene.js     # Asset loading
│   │   ├── MenuScene.js     # Main menu with difficulty select
│   │   └── GameScene.js     # Main gameplay (board, pieces, turns)
│   ├── systems/
│   │   ├── GameState.js     # Chess logic (ported from 3D) ✅
│   │   ├── StockfishAI.js   # AI opponent (ported from 3D) ✅
│   │   └── CombatSystem.js  # Parry mechanics (TODO)
│   ├── data/
│   │   └── CombatData.js    # Attack patterns (ported from 3D) ✅
│   └── ui/
│       └── Board.js         # 2D board rendering ✅
├── public/
│   └── assets/              # Game assets (sprites, audio, effects)
├── index.html
├── vite.config.js
└── package.json
```

---

## Porting Strategy

### Phase 1: Core Setup ✅ COMPLETE
- [x] Initialize project with npm
- [x] Install dependencies (Phaser 3, chess.js, stockfish.js, Vite)
- [x] Create directory structure
- [x] Configure Vite
- [x] Create Phaser game config
- [x] Port pure JS modules (GameState, CombatData, StockfishAI)

### Phase 2: Basic Chess ✅ COMPLETE
- [x] 2D board rendering
- [x] Piece sprites (Unicode symbols - placeholder)
- [x] Click-to-select, click-to-move
- [x] Legal move highlighting
- [x] Turn management
- [x] Stockfish AI integration
- [x] Basic game flow (player → AI turns)

### Phase 3: Combat System ✅ COMPLETE
- [x] Combat overlay with timing bar
- [x] Attack animations (telegraph pullback + strike forward)
- [x] Parry input detection (spacebar)
- [x] Timing windows (perfect/normal parry with visual zones)
- [x] Posture system with damage
- [x] Counter-attack on perfect parry
- [x] AI parry with difficulty-based accuracy

### Phase 4: Polish
- [ ] Visual effects (screen shake, particles)
- [ ] Audio system
- [ ] UI/HUD (posture bars, captured pieces)
- [ ] Menu system improvements
- [ ] Custom piece sprites

### Phase 5: Deployment
- [ ] Web build optimization
- [ ] Capacitor setup for mobile
- [ ] Electron setup for desktop
- [ ] Testing on all platforms

---

## Files Ported from 3D Version

| Source File | Target File | Status | Changes Made |
|-------------|-------------|--------|--------------|
| `GameState.js` | `src/systems/GameState.js` | ✅ Done | Removed DOM dependencies, adapted for Board class |
| `CombatData.js` | `src/data/CombatData.js` | ✅ Done | Added POSTURE_LIMITS, adapted VFX for 2D |
| `StockfishAI.js` | `src/systems/StockfishAI.js` | ✅ Done | Updated worker path for Vite bundling |
| `ParryCombatSystem.js` | `src/systems/CombatSystem.js` | ✅ Done | Full 2D rewrite with timing bar UI |
| `AudioSystem.js` | `src/systems/AudioSystem.js` | ❌ Pending | Will use Phaser audio |

---

## Session Log

### Session 1 - 2025-12-01

**Goal**: Project initialization and PLAYABLE basic chess

**Completed**:
1. Project setup
   - Created `parry-chess2d/` directory
   - Initialized npm with Vite, Phaser 3, chess.js, stockfish.js
   - Created full directory structure

2. Core files created:
   - `index.html` - Game container
   - `vite.config.js` - Build configuration
   - `src/main.js` - Phaser game initialization

3. Scenes implemented:
   - `BootScene.js` - Loading screen with progress bar
   - `MenuScene.js` - Title, play button, difficulty selection
   - `GameScene.js` - Full chess gameplay with AI

4. Systems ported from 3D:
   - `GameState.js` - Chess logic, move validation, FEN sync
   - `CombatData.js` - Attack patterns, timing windows, posture limits
   - `StockfishAI.js` - Stockfish integration with fallback

5. UI components:
   - `Board.js` - 2D board rendering with:
     - Chess.com-style colors
     - Unicode piece symbols
     - Valid move highlighting (dots for moves, rings for captures)
     - Selected piece highlighting
     - Click-based interaction

6. **Build tested successfully!**
   - `npm run build` works
   - Bundle size: 1.26 MB (Phaser is large, expected)

**Current State**:
- ✅ You can play chess against Stockfish AI
- ✅ Pieces move correctly with animations
- ✅ Legal moves are validated by chess.js
- ✅ Turn switching works (player → AI → player)
- ✅ Check/Checkmate detection
- ✅ Game over screen with restart
- ❌ Combat system not yet implemented (captures are instant)

**To Run**:
```bash
cd parry-chess2d
npm run dev
```

**Next Session Goals**:
1. ~~Implement combat overlay scene~~ ✅ Done in Session 2
2. ~~Add attack animations~~ ✅ Done in Session 2
3. ~~Add parry timing system~~ ✅ Done in Session 2
4. Add posture bars to pieces (visual)

---

### Session 2 - 2025-12-01 (continued)

**Goal**: Fix issues and implement combat system

**Issues Fixed**:
1. **Blurry visuals**: Added `render.roundPixels: true` to Phaser config
2. **Missing animations**: Fixed tween timing - now waits for animation to complete
3. **No AI defense**: Implemented full combat system

**Combat System Implemented** (`src/systems/CombatSystem.js`):
- **Timing bar UI**: Visual indicator showing parry window timing
  - Gold zone = perfect parry window
  - Orange zone = normal parry window
  - Red cursor moves across bar
- **Attack phases**:
  1. Telegraph: Attacker pulls back, flashes red
  2. Strike: Attacker lunges toward defender
  3. Resolution: Parry result determined
- **Parry outcomes**:
  - **Perfect parry** (gold zone): Counter-attack! Attacker is captured
  - **Normal parry** (orange zone): Attack blocked, defender takes posture damage
  - **Missed parry**: Attack lands, defender is captured
- **AI defense**: AI attempts parry based on difficulty accuracy:
  - Easy: 30%
  - Medium: 60%
  - Hard: 80%
  - Sekiro: 95%
- **Posture system**: Defenders accumulate posture damage on normal parries. When posture breaks, next attack is unblockable.

**Current State**:
- ✅ Full parry combat system working
- ✅ Player can defend against AI attacks (press SPACE)
- ✅ AI defends against player attacks (with difficulty-based accuracy)
- ✅ Perfect parry = counter-attack
- ✅ Posture damage accumulates
- ✅ Difficulty selection affects AI parry accuracy

**Next Session Goals**:
1. Add posture bars under pieces
2. Add sound effects
3. Polish VFX (particles, better screen shake)
4. Show captured pieces on sides

---

## Key Decisions

### 1. Scene Architecture
- **Decision**: Combat as inline overlay (not separate scene)
- **Rationale**: Easier state management, pieces stay visible
- **Status**: ✅ Implemented

### 2. Piece Sprites
- **Decision**: Start with Unicode symbols, upgrade to sprites later
- **Rationale**: Get gameplay working first
- **Current**: Using ♔♕♖♗♘♙ (white) and ♚♛♜♝♞♟ (black)

### 3. Combat Visualization
- **Decision**: Attacking piece slides toward defender with telegraph
- **Options considered**:
  - ✅ Attacking piece slides toward defender with telegraph animation
  - ❌ Separate combat "zoom" view (too complex for 2D)
  - ❌ Quick-time event style overlay (loses chess context)

### 4. Stockfish Loading
- **Decision**: Use dynamic import with fallback
- **Rationale**: Stockfish WASM may not load in all environments
- **Fallback**: Simple heuristic AI (captures, center control, randomness)

---

## Known Issues

1. **Stockfish Worker Path**: May need adjustment for production builds
   - Current: Uses Vite's `import.meta.url` for worker path
   - Monitor: Test in production build

2. **Bundle Size Warning**: Phaser + Stockfish = 1.26MB
   - Not critical for desktop/web
   - May need code-splitting for mobile

---

## How to Continue Development

### Quick Start
```bash
cd "d:/Gamedev/Sekiro chess/parry-chess2d"
npm run dev
```

### Key Files to Edit

| Task | File(s) |
|------|---------|
| Combat system | Create `src/systems/CombatSystem.js`, modify `GameScene.js` |
| Attack animations | `src/ui/Board.js` (add tween methods) |
| Parry UI | Create `src/ui/ParryIndicator.js` |
| Posture bars | `src/ui/Board.js` or new `src/ui/PostureBar.js` |
| Sound effects | Create `src/systems/AudioSystem.js`, modify `BootScene.js` |
| Custom sprites | Add to `public/assets/pieces/`, modify `Board.js` |

### Reference: 3D Combat System
The original combat system in `parry-chess/src/ParryCombatSystem.js` shows:
- Attack phases (telegraph → strike)
- Collision timing calculation
- Parry window detection
- Posture damage application
- Counter-attack logic

---

## Resources

- [Phaser 3 Documentation](https://photonstorm.github.io/phaser3-docs/)
- [Phaser 3 Examples](https://phaser.io/examples)
- [chess.js Documentation](https://github.com/jhlywa/chess.js)
- [stockfish.js](https://github.com/nicfisher/stockfish.js)
- [Capacitor](https://capacitorjs.com/) - Mobile deployment
- [Electron](https://www.electronjs.org/) - Desktop deployment

---

## Contact

For questions about this project, refer to the original 3D repository or previous session logs in this document.
