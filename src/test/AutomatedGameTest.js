/**
 * AutomatedGameTest - Runs AI vs AI games rapidly for bug detection
 *
 * Usage: Import and call AutomatedGameTest.run(scene, options) from console or test harness
 */
export class AutomatedGameTest {
    constructor(scene, options = {}) {
        this.scene = scene;
        this.options = {
            gamesCount: options.gamesCount || 10,
            maxMovesPerGame: options.maxMovesPerGame || 200,
            moveDelay: options.moveDelay || 50, // ms between moves (0 for instant)
            logMoves: options.logMoves ?? false,
            stopOnError: options.stopOnError ?? true,
            difficulty: options.difficulty || 'easy', // Use easy for faster games
            ...options
        };

        this.stats = {
            gamesPlayed: 0,
            whiteWins: 0,
            blackWins: 0,
            draws: 0,
            errors: [],
            averageMoves: 0,
            totalMoves: 0,
            kingCaptures: 0,
            checkmates: 0,
            stalemates: 0
        };

        this.isRunning = false;
        this.currentGame = 0;
        this.currentMove = 0;
    }

    async run() {
        console.log('='.repeat(60));
        console.log('AUTOMATED GAME TEST STARTING');
        console.log(`Running ${this.options.gamesCount} games, max ${this.options.maxMovesPerGame} moves each`);
        console.log('='.repeat(60));

        this.isRunning = true;
        const startTime = Date.now();

        for (let i = 0; i < this.options.gamesCount && this.isRunning; i++) {
            this.currentGame = i + 1;
            console.log(`\n--- Game ${this.currentGame}/${this.options.gamesCount} ---`);

            try {
                await this.runSingleGame();
                this.stats.gamesPlayed++;
            } catch (error) {
                console.error(`Game ${this.currentGame} crashed:`, error);
                this.stats.errors.push({
                    game: this.currentGame,
                    move: this.currentMove,
                    error: error.message,
                    stack: error.stack
                });

                if (this.options.stopOnError) {
                    console.log('Stopping due to error (stopOnError=true)');
                    break;
                }
            }

            // Reset for next game
            if (i < this.options.gamesCount - 1 && this.isRunning) {
                await this.resetGame();
            }
        }

        const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
        this.printResults(elapsed);
        this.isRunning = false;

        return this.stats;
    }

    async runSingleGame() {
        this.currentMove = 0;

        while (this.currentMove < this.options.maxMovesPerGame && this.isRunning) {
            // Check for game over
            if (this.scene.gameState.isGameOver()) {
                this.recordGameEnd();
                return;
            }

            // Get current turn from chess.js (single source of truth)
            const currentColor = this.scene.gameState.currentPlayer;

            // Get AI move (no color parameter - reads from chess.js)
            const move = await this.getAIMove();

            if (!move) {
                console.warn(`No valid move for ${currentColor} at move ${this.currentMove}`);
                // This might be checkmate/stalemate not detected
                this.stats.errors.push({
                    game: this.currentGame,
                    move: this.currentMove,
                    error: `No valid move for ${currentColor} but game not over`,
                    fen: this.scene.gameState.chess.fen()
                });
                return;
            }

            // Execute the move
            await this.executeMove(move, currentColor);

            this.currentMove++;
            this.stats.totalMoves++;

            if (this.options.logMoves) {
                console.log(`Move ${this.currentMove}: ${currentColor} ${move.algebraic || `${move.from.row},${move.from.col}->${move.to.row},${move.to.col}`}`);
            }

            // Turn is automatically switched by chess.js in makeChessMove()
            // No manual switching needed!

            // Small delay for visual feedback / preventing browser lock
            if (this.options.moveDelay > 0) {
                await this.delay(this.options.moveDelay);
            }
        }

        if (this.currentMove >= this.options.maxMovesPerGame) {
            console.log(`Game ${this.currentGame}: Max moves reached, counting as draw`);
            this.stats.draws++;
        }
    }

    async getAIMove() {
        // Use the existing AI system - no color parameter needed
        const ai = this.scene.ai;
        if (!ai) {
            throw new Error('AI not initialized in scene');
        }

        return await ai.getBestMove();
    }

    async executeMove(move, color) {
        const { piece, to, promotion } = move;
        const fromPos = { ...piece.position };

        // Detect special moves
        const specialMove = this.scene.detectSpecialMove(piece, fromPos, to.row, to.col);

        let targetPiece = this.scene.board.getPieceAt(to.row, to.col);
        let capturedPiece = null;

        // Handle en passant
        if (specialMove.type === 'enPassant') {
            await this.scene.performMove(piece, to.row, to.col);
            const enPassantPawn = this.scene.board.getPieceAt(specialMove.capturedPawnRow, to.col);
            if (enPassantPawn) {
                capturedPiece = enPassantPawn;
                this.scene.board.removePiece(enPassantPawn);
            }
        }
        // Handle capture - simplified for testing (no combat, just capture)
        else if (targetPiece && targetPiece.color !== piece.color) {
            // Auto-resolve combat: attacker wins (simplified for speed)
            capturedPiece = targetPiece;
            this.scene.board.removePiece(targetPiece);
            await this.scene.performMove(piece, to.row, to.col);
        } else {
            await this.scene.performMove(piece, to.row, to.col);
        }

        // Handle castling
        if (specialMove.type === 'castling') {
            await this.scene.handleCastlingRook(specialMove);
        }

        // Handle promotion (always queen for AI)
        if (specialMove.type === 'promotion') {
            const promotionChoice = promotion || 'queen';
            this.scene.board.promotePiece(piece, promotionChoice);
            this.scene.gameState.makeChessMove(fromPos, to, promotionChoice.charAt(0));
        } else {
            this.scene.gameState.makeChessMove(fromPos, to);
        }

        // Complete the turn
        this.scene.gameState.completeMove({ capturedPiece });

        // Update UI
        this.scene.board.updateCapturedPieces(this.scene.gameState.capturedPieces);
    }

    recordGameEnd() {
        const winner = this.scene.gameState.getWinner();

        if (this.scene.gameState.isKingCaptured('white')) {
            this.stats.blackWins++;
            this.stats.kingCaptures++;
            console.log(`Game ${this.currentGame}: Black wins (king captured) in ${this.currentMove} moves`);
        } else if (this.scene.gameState.isKingCaptured('black')) {
            this.stats.whiteWins++;
            this.stats.kingCaptures++;
            console.log(`Game ${this.currentGame}: White wins (king captured) in ${this.currentMove} moves`);
        } else if (this.scene.gameState.isCheckmate('white')) {
            this.stats.blackWins++;
            this.stats.checkmates++;
            console.log(`Game ${this.currentGame}: Black wins (checkmate) in ${this.currentMove} moves`);
        } else if (this.scene.gameState.isCheckmate('black')) {
            this.stats.whiteWins++;
            this.stats.checkmates++;
            console.log(`Game ${this.currentGame}: White wins (checkmate) in ${this.currentMove} moves`);
        } else if (this.scene.gameState.isStalemate()) {
            this.stats.draws++;
            this.stats.stalemates++;
            console.log(`Game ${this.currentGame}: Draw (stalemate) in ${this.currentMove} moves`);
        } else {
            this.stats.draws++;
            console.log(`Game ${this.currentGame}: Draw (other) in ${this.currentMove} moves`);
        }
    }

    async resetGame() {
        // Reset game state
        this.scene.gameState.reset();

        // Clear and reinitialize board
        this.scene.board.clearPieces();
        this.scene.board.setupPieces();

        // Reset scene state
        this.scene.isPlayerTurn = true;
        this.scene.isProcessing = false;
        this.scene.gameOver = false;

        await this.delay(100);
    }

    printResults(elapsedSeconds) {
        console.log('\n' + '='.repeat(60));
        console.log('AUTOMATED TEST RESULTS');
        console.log('='.repeat(60));
        console.log(`Games played: ${this.stats.gamesPlayed}`);
        console.log(`White wins: ${this.stats.whiteWins}`);
        console.log(`Black wins: ${this.stats.blackWins}`);
        console.log(`Draws: ${this.stats.draws}`);
        console.log(`Total moves: ${this.stats.totalMoves}`);
        console.log(`Avg moves/game: ${(this.stats.totalMoves / Math.max(1, this.stats.gamesPlayed)).toFixed(1)}`);
        console.log(`King captures: ${this.stats.kingCaptures}`);
        console.log(`Checkmates: ${this.stats.checkmates}`);
        console.log(`Stalemates: ${this.stats.stalemates}`);
        console.log(`Errors: ${this.stats.errors.length}`);
        console.log(`Time: ${elapsedSeconds}s`);

        if (this.stats.errors.length > 0) {
            console.log('\nErrors encountered:');
            this.stats.errors.forEach((err, i) => {
                console.log(`  ${i + 1}. Game ${err.game}, Move ${err.move}: ${err.error}`);
                if (err.fen) console.log(`     FEN: ${err.fen}`);
            });
        }

        console.log('='.repeat(60));
    }

    stop() {
        console.log('Stopping automated test...');
        this.isRunning = false;
    }

    delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    /**
     * Static helper to run tests from browser console
     * Usage: AutomatedGameTest.runFromConsole(10)
     */
    static async runFromConsole(gamesCount = 5, options = {}) {
        // Find the Phaser game scene
        const game = window.game || window.phaserGame;
        if (!game) {
            console.error('Phaser game not found. Make sure window.game is set.');
            return null;
        }

        const scene = game.scene.getScene('GameScene');
        if (!scene) {
            console.error('GameScene not found');
            return null;
        }

        const tester = new AutomatedGameTest(scene, { gamesCount, ...options });
        window.currentTest = tester; // Allow stopping via window.currentTest.stop()

        return await tester.run();
    }
}

// Make available globally for console access
if (typeof window !== 'undefined') {
    window.AutomatedGameTest = AutomatedGameTest;
}
