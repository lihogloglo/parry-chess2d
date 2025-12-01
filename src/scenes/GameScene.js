import Phaser from 'phaser';
import { Board } from '../ui/Board.js';
import { GameState } from '../systems/GameState.js';
import { StockfishAI } from '../systems/StockfishAI.js';
import { CombatSystem } from '../systems/CombatSystem.js';
import { SoundManager } from '../systems/SoundManager.js';
import { getAIParrySettings, COMBAT_TIMING } from '../config/GameConfig.js';

export default class GameScene extends Phaser.Scene {
    constructor() {
        super({ key: 'GameScene' });
    }

    init(data) {
        this.difficulty = data?.difficulty || 'medium';
    }

    create() {
        const width = this.cameras.main.width;
        const height = this.cameras.main.height;

        // Calculate board size and position (centered, with space for captured pieces panels)
        const panelHeight = 50; // Space for top/bottom captured pieces panels
        const availableHeight = height - (panelHeight * 2) - 80; // Leave room for UI text too
        const boardSize = Math.min(width * 0.85, availableHeight);
        const boardX = (width - boardSize) / 2;
        const boardY = (height - boardSize) / 2;

        // Create game systems
        this.board = new Board(this, boardX, boardY, boardSize);
        this.gameState = new GameState();
        this.gameState.setBoard(this.board);

        // Initialize AI with difficulty
        this.ai = new StockfishAI(this.gameState, this.difficulty);

        // Initialize Combat System
        this.combatSystem = new CombatSystem(this, this.board);

        // Set AI parry settings based on difficulty (from GameConfig)
        this.combatSystem.setAIParrySettings(getAIParrySettings(this.difficulty));

        // Initialize Sound Manager
        this.soundManager = new SoundManager(this);
        this.soundManager.init();

        // Pass sound manager to combat system
        this.combatSystem.setSoundManager(this.soundManager);

        // Game state
        this.selectedPiece = null;
        this.validMoves = [];
        this.isPlayerTurn = true;
        this.isProcessing = false;
        this.inCombat = false;

        // Setup input
        this.setupInput();

        // Create UI
        this.createUI();

        console.log('GameScene created with difficulty:', this.difficulty);
    }

    setupInput() {
        this.input.on('pointerdown', (pointer) => {
            if (this.isProcessing || !this.isPlayerTurn || this.inCombat) return;

            const square = this.board.getSquareFromPointer(pointer);
            if (!square) return;

            this.handleSquareClick(square.row, square.col);
        });

        // Parry input (spacebar) - only when player is defending
        this.input.keyboard.on('keydown-SPACE', () => {
            if (this.inCombat && this.combatSystem && this.combatSystem.isPlayerDefending) {
                this.combatSystem.attemptParry();
            }
        });
    }

    handleSquareClick(row, col) {
        const clickedPiece = this.board.getPieceAt(row, col);

        if (this.selectedPiece) {
            // Check if clicking on valid move
            const isValidMove = this.validMoves.some(m => m.row === row && m.col === col);

            if (isValidMove) {
                this.executeMove(this.selectedPiece, row, col);
            } else if (clickedPiece && clickedPiece.color === this.gameState.currentPlayer) {
                // Select different piece of same color
                this.selectPiece(clickedPiece);
            } else {
                // Deselect
                this.deselectPiece();
            }
        } else {
            // Select piece if it belongs to current player
            if (clickedPiece && clickedPiece.color === this.gameState.currentPlayer) {
                this.selectPiece(clickedPiece);
            }
        }
    }

    selectPiece(piece) {
        this.deselectPiece();

        this.selectedPiece = piece;
        this.validMoves = this.gameState.getValidMoves(piece);

        // Highlight selected square
        this.board.highlightSquare(piece.position.row, piece.position.col);

        // Show valid moves
        this.board.showValidMoves(this.validMoves);
    }

    deselectPiece() {
        this.selectedPiece = null;
        this.validMoves = [];
        this.board.clearHighlights();
    }

    async executeMove(piece, toRow, toCol) {
        this.isProcessing = true;
        const fromPos = { ...piece.position };

        // Highlight the move (origin and destination)
        this.board.clearHighlights();
        this.board.highlightMove(fromPos.row, fromPos.col, toRow, toCol);

        this.selectedPiece = null;
        this.validMoves = [];

        // Detect special moves before making the move
        const specialMove = this.detectSpecialMove(piece, fromPos, toRow, toCol);

        let targetPiece = this.board.getPieceAt(toRow, toCol);
        let capturedPiece = null;

        // Handle en passant capture (captured pawn is not on target square)
        if (specialMove.type === 'enPassant') {
            const enPassantPawn = this.board.getPieceAt(specialMove.capturedPawnRow, toCol);
            if (enPassantPawn) {
                // En passant doesn't trigger combat - it's a surprise attack!
                capturedPiece = enPassantPawn;
                this.board.removePiece(enPassantPawn);
            }
            await this.performMove(piece, toRow, toCol);
        }
        // Check for regular capture
        else if (targetPiece && targetPiece.color !== piece.color) {
            // Player attacking AI piece - AI defends
            const combatResult = await this.initiateCombat(piece, targetPiece, false);
            capturedPiece = await this.resolveCombat(combatResult, piece, targetPiece, toRow, toCol);
        } else {
            // Regular move
            await this.performMove(piece, toRow, toCol);
        }

        // Handle castling - move the rook too
        if (specialMove.type === 'castling') {
            await this.handleCastlingRook(specialMove);
        }

        // Handle pawn promotion
        if (specialMove.type === 'promotion') {
            const promotionChoice = await this.showPromotionDialog(piece);
            this.board.promotePiece(piece, promotionChoice);
            // Make the move in chess.js with the promotion choice
            this.gameState.makeChessMove(fromPos, { row: toRow, col: toCol }, promotionChoice.charAt(0));
        } else {
            // Make the move in chess.js
            this.gameState.makeChessMove(fromPos, { row: toRow, col: toCol });
        }

        // Complete the turn
        this.gameState.completeMove({ capturedPiece });

        // Play capture sound if a piece was captured
        if (capturedPiece) {
            this.soundManager.playCapture();
        }

        // Update UI
        this.updateTurnIndicator();
        this.board.updateCapturedPieces(this.gameState.capturedPieces);

        // Check game end conditions
        if (this.gameState.isGameOver()) {
            this.handleGameOver();
            return;
        }

        // Play check sound if opponent is now in check
        if (this.gameState.isInCheck(this.gameState.currentPlayer)) {
            this.soundManager.playCheck();
        }

        // AI turn
        if (this.gameState.currentPlayer === 'black') {
            this.isPlayerTurn = false;
            await this.executeAITurn();
        } else {
            this.isPlayerTurn = true;
        }

        this.isProcessing = false;
    }

    /**
     * Detect if a move is a special move (castling, en passant, promotion)
     */
    detectSpecialMove(piece, fromPos, toRow, toCol) {
        // Castling detection: King moves 2 squares horizontally
        if (piece.type === 'king' && Math.abs(toCol - fromPos.col) === 2) {
            const isKingside = toCol > fromPos.col;
            return {
                type: 'castling',
                isKingside,
                rookFromCol: isKingside ? 7 : 0,
                rookToCol: isKingside ? 5 : 3,
                row: fromPos.row
            };
        }

        // Pawn promotion detection
        if (piece.type === 'pawn') {
            const isPromotion = (piece.color === 'white' && toRow === 0) ||
                               (piece.color === 'black' && toRow === 7);
            if (isPromotion) {
                return { type: 'promotion' };
            }

            // En passant detection: Pawn moves diagonally to empty square
            const isDiagonal = Math.abs(toCol - fromPos.col) === 1;
            const targetPiece = this.board.getPieceAt(toRow, toCol);
            if (isDiagonal && !targetPiece) {
                // This is en passant - the captured pawn is on our starting row
                return {
                    type: 'enPassant',
                    capturedPawnRow: fromPos.row
                };
            }
        }

        return { type: 'normal' };
    }

    /**
     * Handle castling rook movement
     */
    async handleCastlingRook(castlingInfo) {
        const rook = this.board.getPieceAt(castlingInfo.row, castlingInfo.rookFromCol);
        if (rook) {
            await this.performMove(rook, castlingInfo.row, castlingInfo.rookToCol);
        }
    }

    /**
     * Show promotion dialog and return player's choice
     */
    showPromotionDialog(piece) {
        return new Promise((resolve) => {
            const width = this.cameras.main.width;
            const height = this.cameras.main.height;

            // Create overlay
            const overlay = this.add.rectangle(width / 2, height / 2, width, height, 0x000000, 0.7);
            overlay.setDepth(20);

            // Title
            const title = this.add.text(width / 2, height / 2 - 80, 'Choose Promotion', {
                font: 'bold 24px monospace',
                color: '#ffffff'
            }).setOrigin(0.5).setDepth(21);

            const pieces = ['queen', 'rook', 'bishop', 'knight'];
            const colorPrefix = piece.color === 'white' ? 'W' : 'B';
            const buttons = [];
            const startX = width / 2 - 120;

            pieces.forEach((type, index) => {
                const x = startX + index * 80;
                const y = height / 2;

                // Button background
                const bg = this.add.rectangle(x, y, 70, 70, 0x444444);
                bg.setStrokeStyle(2, 0xc9a959);
                bg.setInteractive({ useHandCursor: true });
                bg.setDepth(21);

                // Piece sprite
                const assetKey = `${colorPrefix}_${type.charAt(0).toUpperCase() + type.slice(1)}`;
                const sprite = this.add.image(x, y, assetKey);
                sprite.setScale(0.8);
                sprite.setDepth(22);

                bg.on('pointerover', () => bg.setFillStyle(0x666666));
                bg.on('pointerout', () => bg.setFillStyle(0x444444));
                bg.on('pointerdown', () => {
                    // Clean up
                    overlay.destroy();
                    title.destroy();
                    buttons.forEach(b => {
                        b.bg.destroy();
                        b.sprite.destroy();
                    });
                    resolve(type);
                });

                buttons.push({ bg, sprite });
            });
        });
    }

    /**
     * Initiate combat between attacker and defender
     * @param {Object} attacker - Attacking piece
     * @param {Object} defender - Defending piece
     * @param {boolean} isPlayerDefending - True if player is defending
     */
    async initiateCombat(attacker, defender, isPlayerDefending) {
        this.inCombat = true;
        this.updateStatusText(isPlayerDefending ? 'DEFEND! Press SPACE to parry!' : 'AI defending...');

        const result = await this.combatSystem.startCombat(attacker, defender, isPlayerDefending);

        this.inCombat = false;
        return result;
    }

    /**
     * Resolve combat result and update board
     */
    async resolveCombat(combatResult, attacker, defender, toRow, toCol) {
        let capturedPiece = null;

        // Clear move highlights after combat ends
        this.board.clearHighlights();

        if (combatResult.attackerWins) {
            // Attacker wins - capture defender
            capturedPiece = defender;
            this.board.removePiece(defender);
            await this.performMove(attacker, toRow, toCol);
            this.updateStatusText('Attack successful!');
        } else if (combatResult.defenderWins) {
            // Perfect parry - defender counter-attacks and captures attacker!
            capturedPiece = attacker;
            this.board.removePiece(attacker);
            this.updateStatusText('Counter attack!');

            // Flash the defender gold
            this.tweens.add({
                targets: defender.sprite,
                alpha: 0.5,
                duration: 100,
                yoyo: true,
                repeat: 2
            });
        } else {
            // Defender survives - attacker doesn't move to that square
            // Move back or stay in place
            this.updateStatusText('Attack blocked!');
        }

        return capturedPiece;
    }

    async performMove(piece, toRow, toCol) {
        return new Promise(resolve => {
            const targetX = toCol * this.board.squareSize + this.board.squareSize / 2;
            const targetY = toRow * this.board.squareSize + this.board.squareSize / 2;

            // Animate the piece
            this.tweens.add({
                targets: piece.sprite,
                x: targetX,
                y: targetY,
                duration: 250,
                ease: 'Power2',
                onUpdate: () => {
                    // Update Z-order during animation
                    this.board.sortPiecesByDepth();
                },
                onComplete: () => {
                    // Play move sound when piece lands
                    this.soundManager.playMove();

                    // Update piece data after animation completes
                    piece.position.row = toRow;
                    piece.position.col = toCol;
                    piece.hasMoved = true;

                    // Ensure correct Z-order after move
                    this.board.sortPiecesByDepth();
                    resolve();
                }
            });
        });
    }

    async executeAITurn() {
        this.updateStatusText('AI thinking...');

        // Small delay for visual feedback (from GameConfig)
        await new Promise(resolve => this.time.delayedCall(COMBAT_TIMING.aiThinkDelay, resolve));

        const move = await this.ai.getBestMove('black');

        if (!move) {
            console.error('AI could not find a move');
            this.isPlayerTurn = true;
            this.updateStatusText('Your turn');
            return;
        }

        const { piece, to, promotion } = move;
        const fromPos = { ...piece.position };

        // Highlight the AI's move (origin and destination)
        this.board.clearHighlights();
        this.board.highlightMove(fromPos.row, fromPos.col, to.row, to.col);

        // Detect special moves
        const specialMove = this.detectSpecialMove(piece, fromPos, to.row, to.col);

        let targetPiece = this.board.getPieceAt(to.row, to.col);
        let capturedPiece = null;

        // Handle en passant capture
        if (specialMove.type === 'enPassant') {
            const enPassantPawn = this.board.getPieceAt(specialMove.capturedPawnRow, to.col);
            if (enPassantPawn) {
                capturedPiece = enPassantPawn;
                this.board.removePiece(enPassantPawn);
            }
            await this.performMove(piece, to.row, to.col);
        }
        // Regular capture
        else if (targetPiece && targetPiece.color !== piece.color) {
            // AI attacking player's piece - player defends!
            const combatResult = await this.initiateCombat(piece, targetPiece, true);
            capturedPiece = await this.resolveCombat(combatResult, piece, targetPiece, to.row, to.col);
        } else {
            await this.performMove(piece, to.row, to.col);
        }

        // Handle castling - move the rook too
        if (specialMove.type === 'castling') {
            await this.handleCastlingRook(specialMove);
        }

        // Handle pawn promotion (AI always promotes to queen by default, or uses Stockfish choice)
        if (specialMove.type === 'promotion') {
            const promotionChoice = promotion || 'queen';
            this.board.promotePiece(piece, promotionChoice);
            this.gameState.makeChessMove(fromPos, to, promotionChoice.charAt(0));
        } else {
            // Make the move in chess.js
            this.gameState.makeChessMove(fromPos, to);
        }

        this.gameState.completeMove({ capturedPiece });

        // Play capture sound if a piece was captured
        if (capturedPiece) {
            this.soundManager.playCapture();
        }

        // Update UI
        this.updateTurnIndicator();
        this.board.updateCapturedPieces(this.gameState.capturedPieces);

        // Check game end
        if (this.gameState.isGameOver()) {
            this.handleGameOver();
            return;
        }

        // Play check sound if player is now in check
        if (this.gameState.isInCheck(this.gameState.currentPlayer)) {
            this.soundManager.playCheck();
        }

        this.isPlayerTurn = true;
        this.updateStatusText('Your turn');
    }

    createUI() {
        const width = this.cameras.main.width;

        // Turn indicator
        this.turnText = this.add.text(width / 2, 20, 'White to move', {
            font: '18px monospace',
            color: '#ffffff'
        }).setOrigin(0.5, 0);

        // Status text
        this.statusText = this.add.text(width / 2, this.cameras.main.height - 20, '', {
            font: '14px monospace',
            color: '#888888'
        }).setOrigin(0.5, 1);

        // Back button
        const backBtn = this.add.text(10, 10, '< Menu', {
            font: '14px monospace',
            color: '#666666'
        }).setInteractive({ useHandCursor: true });

        backBtn.on('pointerover', () => backBtn.setColor('#ffffff'));
        backBtn.on('pointerout', () => backBtn.setColor('#666666'));
        backBtn.on('pointerdown', () => {
            this.ai.dispose();
            this.scene.start('MenuScene');
        });

        // Difficulty indicator
        this.add.text(width - 10, 10, `Difficulty: ${this.difficulty}`, {
            font: '12px monospace',
            color: '#666666'
        }).setOrigin(1, 0);
    }

    updateTurnIndicator() {
        const turn = this.gameState.currentPlayer;
        this.turnText.setText(`${turn.charAt(0).toUpperCase() + turn.slice(1)} to move`);

        if (this.gameState.isInCheck(turn)) {
            this.turnText.setText(`${turn.charAt(0).toUpperCase() + turn.slice(1)} in CHECK!`);
            this.turnText.setColor('#ff4444');
        } else {
            this.turnText.setColor('#ffffff');
        }
    }

    updateStatusText(text) {
        this.statusText.setText(text);
    }

    handleGameOver() {
        let message = '';
        let playerWon = false;

        if (this.gameState.isCheckmate('white')) {
            message = 'Checkmate! Black wins!';
            playerWon = false; // Player is white, so they lost
        } else if (this.gameState.isCheckmate('black')) {
            message = 'Checkmate! White wins!';
            playerWon = true; // Player is white, so they won
        } else if (this.gameState.isStalemate()) {
            message = 'Stalemate! Draw!';
            playerWon = null; // Draw - no winner
        } else {
            message = 'Game Over!';
        }

        // Play victory or defeat sound
        if (playerWon === true) {
            this.soundManager.playVictory();
        } else if (playerWon === false) {
            this.soundManager.playDefeat();
        }

        // Show game over overlay
        const width = this.cameras.main.width;
        const height = this.cameras.main.height;

        this.add.rectangle(width / 2, height / 2, width, height, 0x000000, 0.7);

        this.add.text(width / 2, height / 2 - 30, message, {
            font: 'bold 32px monospace',
            color: '#ffffff'
        }).setOrigin(0.5);

        const restartBtn = this.add.text(width / 2, height / 2 + 40, '[ Play Again ]', {
            font: '20px monospace',
            color: '#c9a959'
        }).setOrigin(0.5).setInteractive({ useHandCursor: true });

        restartBtn.on('pointerdown', () => {
            this.ai.dispose();
            this.scene.restart();
        });
    }
}
