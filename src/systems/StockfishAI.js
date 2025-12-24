/**
 * StockfishAI - Chess AI opponent using Stockfish engine
 *
 * DESIGN PRINCIPLE: chess.js FEN is the single source of truth.
 * This class never modifies FEN - it just reads and responds to it.
 */
export class StockfishAI {
    constructor(gameState, difficulty = 'medium') {
        this.gameState = gameState;
        this.difficulty = difficulty;

        // Initialize Stockfish engine
        this.engine = null;
        this.engineReady = false;
        this.currentCallback = null;
        this.useFallback = false;

        this.initializeEngine();

        // Difficulty settings - using time-based search for more consistent performance
        // moveTime is in milliseconds - how long Stockfish is allowed to think
        // Note: AI parry behavior is controlled by GameConfig.DIFFICULTY_SETTINGS via CombatSystem
        this.difficultySettings = {
            easy: {
                skillLevel: 1,
                moveTime: 200       // 200ms thinking time
            },
            medium: {
                skillLevel: 5,
                moveTime: 500       // 500ms thinking time
            },
            hard: {
                skillLevel: 10,
                moveTime: 1000      // 1 second thinking time
            },
            expert: {
                skillLevel: 20,
                moveTime: 2000      // 2 seconds thinking time
            }
        };
    }

    async initializeEngine() {
        try {
            // Try to load Stockfish as a Web Worker
            // In production, use the copied files in assets folder
            // In development, use the node_modules path
            const isDev = import.meta.env.DEV;
            const workerPath = isDev
                ? new URL('stockfish.js/stockfish.wasm.js', import.meta.url)
                : new URL('./assets/stockfish.wasm.js', window.location.origin + window.location.pathname.replace(/\/[^/]*$/, '/'));

            this.engine = new Worker(workerPath);

            this.engine.onmessage = (event) => {
                const message = typeof event === 'string' ? event : event.data || event;
                this.handleEngineMessage(message);
            };

            this.engine.onerror = (error) => {
                console.warn('Stockfish worker error:', error);
                this.useFallback = true;
            };

            // Initialize UCI protocol
            this.sendCommand('uci');
        } catch (error) {
            console.error('Failed to initialize Stockfish:', error);
            console.warn('Stockfish not available - AI will use fallback move selection');
            this.engineReady = false;
            this.useFallback = true;
        }
    }

    handleEngineMessage(message) {
        if (typeof message !== 'string') {
            return;
        }

        console.log('Stockfish:', message);

        if (message === 'uciok') {
            this.engineReady = true;
            this.configureEngine();
        } else if (message.startsWith('bestmove')) {
            // Match moves including optional promotion piece (e.g., "e7e8q")
            const match = message.match(/bestmove ([a-h][1-8][a-h][1-8])([qrbn])?/);
            if (match && this.currentCallback) {
                const moveStr = match[1];
                const promotionChar = match[2] || null;
                this.currentCallback(moveStr, promotionChar);
                this.currentCallback = null;
            }
        }
    }

    configureEngine() {
        const settings = this.difficultySettings[this.difficulty];
        this.sendCommand('setoption name Skill Level value ' + settings.skillLevel);
        this.sendCommand('setoption name UCI_LimitStrength value true');
        this.sendCommand('isready');
    }

    /**
     * Pre-warm the engine by running a quick calculation on the starting position.
     * This ensures the WASM is fully loaded and compiled before the first real move.
     */
    prewarm() {
        if (this.engineReady && this.engine) {
            // Run a very quick calculation to warm up the engine
            this.sendCommand('position startpos');
            this.sendCommand('go movetime 1');
        }
    }

    sendCommand(cmd) {
        if (this.engine) {
            this.engine.postMessage(cmd);
        }
    }

    setDifficulty(difficulty) {
        this.difficulty = difficulty;
        if (this.engineReady) {
            this.configureEngine();
        }
    }

    /**
     * Get the best move for the current position.
     * IMPORTANT: This reads the turn from chess.js FEN - no color parameter needed.
     * The FEN is the single source of truth.
     */
    async getBestMove() {
        const fen = this.gameState.chess.fen();
        const currentTurn = this.gameState.chess.turn() === 'w' ? 'white' : 'black';

        if (this.useFallback) {
            return this.getFallbackMove(currentTurn);
        }

        if (!this.engineReady) {
            await this.waitForEngine();

            if (!this.engineReady) {
                return this.getFallbackMove(currentTurn);
            }
        }

        // Cancel any pending search
        this.sendCommand('stop');

        return new Promise((resolve) => {
            const settings = this.difficultySettings[this.difficulty];
            let resolved = false;
            let timeoutId = null;

            console.log(`StockfishAI: Getting move for ${currentTurn}, FEN: ${fen}`);

            this.currentCallback = (moveStr, promotionChar) => {
                if (resolved) return; // Prevent double-resolve
                resolved = true;
                if (timeoutId) clearTimeout(timeoutId);
                this.currentCallback = null;

                const move = this.convertStockfishMove(moveStr, promotionChar, currentTurn);
                if (!move) {
                    console.error('convertStockfishMove returned null, using fallback');
                    resolve(this.getFallbackMove(currentTurn));
                } else {
                    resolve(move);
                }
            };

            // Send the position and search command
            this.sendCommand('position fen ' + fen);
            this.sendCommand(`go movetime ${settings.moveTime}`);

            // Timeout fallback - give extra buffer over moveTime
            const timeoutMs = settings.moveTime + 5000;
            timeoutId = setTimeout(() => {
                if (resolved) return;
                resolved = true;
                console.warn(`StockfishAI: Timeout after ${timeoutMs}ms, using fallback move`);
                this.currentCallback = null;
                this.sendCommand('stop'); // Stop the search
                resolve(this.getFallbackMove(currentTurn));
            }, timeoutMs);
        });
    }

    async waitForEngine(maxWait = 5000) {
        const startTime = Date.now();
        while (!this.engineReady && Date.now() - startTime < maxWait) {
            await new Promise(resolve => setTimeout(resolve, 100));
        }
    }

    convertStockfishMove(moveStr, promotionChar = null, color = null) {
        const fromCol = moveStr.charCodeAt(0) - 'a'.charCodeAt(0);
        const fromRow = 8 - parseInt(moveStr[1]);
        const toCol = moveStr.charCodeAt(2) - 'a'.charCodeAt(0);
        const toRow = 8 - parseInt(moveStr[3]);

        console.log(`StockfishAI: Converting move ${moveStr} for ${color}`);
        console.log(`  from: (${fromRow}, ${fromCol}) to: (${toRow}, ${toCol})`);

        const piece = this.gameState.board?.getPieceAt(fromRow, fromCol);

        if (!piece) {
            console.error(`StockfishAI: No piece at (${fromRow}, ${fromCol})`);
            this.debugBoardState(color);
            return null;
        }

        // Validate the piece is the correct color
        if (color && piece.color !== color) {
            console.error(`StockfishAI: Piece at (${fromRow}, ${fromCol}) is ${piece.color}, expected ${color}`);
            this.debugBoardState(color);
            return null;
        }

        // Convert promotion character to full piece name
        const promotionMap = { q: 'queen', r: 'rook', b: 'bishop', n: 'knight' };
        const promotion = promotionChar ? promotionMap[promotionChar] : null;

        return {
            piece: piece,
            from: { row: fromRow, col: fromCol },
            to: { row: toRow, col: toCol },
            promotion: promotion,
            algebraic: moveStr + (promotionChar || '')
        };
    }

    debugBoardState(expectedColor) {
        console.log('=== BOARD STATE DEBUG ===');
        console.log('FEN:', this.gameState.chess.fen());
        console.log('chess.js turn:', this.gameState.chess.turn());
        console.log(`Expected color: ${expectedColor}`);
        console.log('Pieces on board:');
        this.gameState.board?.pieces?.forEach(p => {
            console.log(`  ${p.color} ${p.type} at (${p.position.row}, ${p.position.col})`);
        });
        console.log('=========================');
    }

    getFallbackMove(color) {
        const allMoves = this.gameState.getAllValidMoves(color);
        if (allMoves.length === 0) return null;

        const board = this.gameState.board;

        // Evaluate moves considering parry/combat system
        const evaluatedMoves = allMoves.map(move => {
            let score = 0;

            const targetPiece = board?.getPieceAt(move.to.row, move.to.col);

            // Check if it's a capture
            if (targetPiece && targetPiece.color !== color) {
                const pieceValues = { pawn: 1, knight: 3, bishop: 3, rook: 5, queen: 9, king: 100 };
                const baseValue = pieceValues[targetPiece.type] * 10;

                // Parry-aware evaluation
                const targetParriesLeft = board.getParriesRemaining(targetPiece);
                const targetPostureBroken = board.isPostureBroken(targetPiece);

                if (targetPostureBroken) {
                    // Broken posture = guaranteed capture, high priority
                    score += baseValue * 3;
                } else if (targetParriesLeft === 0) {
                    // No parries left = easier to capture
                    score += baseValue * 2;
                } else {
                    // Has parries - capture is risky, reduce priority
                    // But still consider piece value
                    score += baseValue * 0.5;
                }

                // Prefer attacking with expendable pieces when target can parry
                if (targetParriesLeft > 0) {
                    const attackerValue = pieceValues[move.piece.type];
                    // Penalty for risking high-value pieces against defended targets
                    score -= attackerValue * 2;
                }
            }

            // Bonus for center control
            if (move.to.row >= 3 && move.to.row <= 4 && move.to.col >= 3 && move.to.col <= 4) {
                score += 3;
            }

            // Small random factor for variety
            score += Math.random() * 2;

            return { move, score };
        });

        evaluatedMoves.sort((a, b) => b.score - a.score);
        return evaluatedMoves[0].move;
    }

    dispose() {
        if (this.engine) {
            this.sendCommand('quit');
            this.engine.terminate();
            this.engine = null;
        }
    }

    static getDifficultyName(difficulty) {
        const names = {
            easy: 'Easy',
            medium: 'Medium',
            hard: 'Hard',
            expert: 'Expert'
        };
        return names[difficulty] || 'Medium';
    }
}
