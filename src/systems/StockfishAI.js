/**
 * StockfishAI - Chess AI opponent using Stockfish engine
 * Ported from 3D version with minor path adjustments
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
        this.difficultySettings = {
            easy: {
                skillLevel: 1,
                moveTime: 200,      // 200ms thinking time
                parryAccuracy: 0.30
            },
            medium: {
                skillLevel: 5,
                moveTime: 500,      // 500ms thinking time
                parryAccuracy: 0.60
            },
            hard: {
                skillLevel: 10,
                moveTime: 1000,     // 1 second thinking time
                parryAccuracy: 0.80
            },
            expert: {
                skillLevel: 20,
                moveTime: 2000,     // 2 seconds thinking time
                parryAccuracy: 0.95
            }
        };
    }

    async initializeEngine() {
        try {
            // Try to load Stockfish as a Web Worker
            // The path may need adjustment based on how stockfish.js is bundled
            this.engine = new Worker(new URL('stockfish.js/stockfish.wasm.js', import.meta.url));

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

    async getBestMove(color) {
        if (this.useFallback) {
            return this.getFallbackMove(color);
        }

        if (!this.engineReady) {
            await this.waitForEngine();

            if (!this.engineReady) {
                return this.getFallbackMove(color);
            }
        }

        return new Promise((resolve) => {
            const fen = this.gameState.chess.fen();
            const settings = this.difficultySettings[this.difficulty];

            this.sendCommand('position fen ' + fen);
            // Use time-based search for consistent, predictable performance
            this.sendCommand(`go movetime ${settings.moveTime}`);

            this.currentCallback = (moveStr, promotionChar) => {
                const move = this.convertStockfishMove(moveStr, promotionChar);
                resolve(move);
            };

            // Timeout fallback
            setTimeout(() => {
                if (this.currentCallback) {
                    this.currentCallback = null;
                    resolve(this.getFallbackMove(color));
                }
            }, 10000);
        });
    }

    async waitForEngine(maxWait = 5000) {
        const startTime = Date.now();
        while (!this.engineReady && Date.now() - startTime < maxWait) {
            await new Promise(resolve => setTimeout(resolve, 100));
        }
    }

    convertStockfishMove(moveStr, promotionChar = null) {
        const fromCol = moveStr.charCodeAt(0) - 'a'.charCodeAt(0);
        const fromRow = 8 - parseInt(moveStr[1]);
        const toCol = moveStr.charCodeAt(2) - 'a'.charCodeAt(0);
        const toRow = 8 - parseInt(moveStr[3]);

        const piece = this.gameState.board?.getPieceAt(fromRow, fromCol);

        if (!piece) {
            console.error('No piece found at source position:', fromRow, fromCol);
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

    getFallbackMove(color) {
        const allMoves = this.gameState.getAllValidMoves(color);
        if (allMoves.length === 0) return null;

        // Simple evaluation: prioritize captures and center control
        const evaluatedMoves = allMoves.map(move => {
            let score = 0;

            // Check if it's a capture
            const targetPiece = this.gameState.board?.getPieceAt(move.to.row, move.to.col);
            if (targetPiece && targetPiece.color !== color) {
                const pieceValues = { pawn: 1, knight: 3, bishop: 3, rook: 5, queen: 9, king: 100 };
                score += pieceValues[targetPiece.type] * 10;

                // Bonus for capturing pieces with broken posture
                if (targetPiece.isPostureBroken?.()) {
                    score += 50;
                }
            }

            // Bonus for center control
            if (move.to.row >= 3 && move.to.row <= 4 && move.to.col >= 3 && move.to.col <= 4) {
                score += 3;
            }

            // Random factor for variety
            score += Math.random() * 2;

            return { move, score };
        });

        evaluatedMoves.sort((a, b) => b.score - a.score);
        return evaluatedMoves[0].move;
    }

    calculateParryTiming(perfectParryTime, perfectParryWindow) {
        const settings = this.difficultySettings[this.difficulty];
        const accuracy = settings.parryAccuracy;

        const maxDeviation = perfectParryWindow * 2;
        const deviation = maxDeviation * (1 - accuracy) * (Math.random() - 0.5) * 2;

        return perfectParryTime + deviation;
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
