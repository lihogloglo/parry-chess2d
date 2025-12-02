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
        this.playerColor = data?.playerColor || 'white';
        this.opponentCharacter = data?.opponentCharacter || 'char_adult';
        this.opponentPortrait = data?.opponentPortrait || 'char_adult_portrait';
    }

    create() {
        const width = this.cameras.main.width;
        const height = this.cameras.main.height;

        // Detect mobile devices
        this.isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);

        // Calculate board size and position
        const uiHeight = 50; // Space for turn indicator and status text

        let boardSize;
        if (this.isMobile) {
            // On mobile, use full width
            const availableHeight = height - uiHeight - 40;
            boardSize = Math.min(width, availableHeight);
        } else {
            // On desktop, make board smaller to leave room for captured pieces on the right
            const availableHeight = height - uiHeight - 40;
            boardSize = Math.min(width * 0.65, availableHeight * 0.85);
        }

        // Center board horizontally and vertically
        const boardX = (width - boardSize) / 2;
        const boardY = uiHeight + (height - uiHeight - boardSize) / 2;

        // Store board position for portrait placement
        this.boardX = boardX;
        this.boardY = boardY;
        this.boardSize = boardSize;

        // Create game systems
        // Hide top/bottom captured panels - we show captured pieces next to portrait
        this.board = new Board(this, boardX, boardY, boardSize, { showCapturedPanels: false });
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
        this.isPlayerTurn = this.playerColor === 'white'; // Player goes first only if white
        this.isProcessing = false;
        this.inCombat = false;
        this.inPromotion = false;
        this.gameOver = false;

        // UI elements for parry display
        this.parryIndicator = null;

        // Setup input
        this.setupInput();

        // Create UI
        this.createUI();

        // Create portrait overlay on the board
        this.createPortraitOverlay();

        console.log('GameScene created with difficulty:', this.difficulty, 'playerColor:', this.playerColor);

        // If player is black, AI moves first
        if (this.playerColor === 'black') {
            this.time.delayedCall(500, () => {
                this.executeAITurn();
            });
        }
    }

    setupInput() {
        this.input.on('pointerdown', (pointer) => {
            // Handle parry on tap/click during combat (mobile-friendly)
            if (this.inCombat && this.combatSystem && this.combatSystem.isPlayerDefending) {
                this.combatSystem.attemptParry();
                return;
            }

            if (this.gameOver || this.isProcessing || !this.isPlayerTurn || this.inCombat || this.inPromotion) return;

            const square = this.board.getSquareFromPointer(pointer);
            if (!square) return;

            this.handleSquareClick(square.row, square.col);
        });

        // Parry input (spacebar) - only when player is defending (desktop)
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
            } else if (clickedPiece && clickedPiece.color === this.playerColor) {
                // Select different piece of same color
                this.selectPiece(clickedPiece);
            } else {
                // Deselect
                this.deselectPiece();
            }
        } else {
            // Select piece if it belongs to player
            if (clickedPiece && clickedPiece.color === this.playerColor) {
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

        // Show parries remaining above the piece
        this.showParryIndicator(piece);
    }

    deselectPiece() {
        this.selectedPiece = null;
        this.validMoves = [];
        this.board.clearHighlights();
        this.hideParryIndicator();
    }

    async executeMove(piece, toRow, toCol) {
        this.isProcessing = true;
        this.hideParryIndicator();
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
            // Move first, then remove the captured pawn for visual consistency
            await this.performMove(piece, toRow, toCol);
            const enPassantPawn = this.board.getPieceAt(specialMove.capturedPawnRow, toCol);
            if (enPassantPawn) {
                // En passant doesn't trigger combat - it's a surprise attack!
                capturedPiece = enPassantPawn;
                this.board.removePiece(enPassantPawn);
            }
        }
        // Check for regular capture
        else if (targetPiece && targetPiece.color !== piece.color) {
            // Player attacking AI piece - AI defends (player is never defending on their own turn)
            const isPlayerDefending = false;
            const combatResult = await this.initiateCombat(piece, targetPiece, isPlayerDefending);
            const result = await this.resolveCombat(combatResult, piece, targetPiece, toRow, toCol);
            capturedPiece = result.capturedPiece;

            // If move was blocked (defender survived or counter-attacked), sync board state and end turn
            if (result.moveBlocked) {
                this.gameState.syncChessJsWithBoard();
                this.gameState.completeMove({ capturedPiece });

                if (capturedPiece) {
                    this.soundManager.playCapture();
                }

                this.updateTurnIndicator();
                this.board.updateCapturedPieces(this.gameState.capturedPieces);
                this.updatePortraitCapturedPieces();

                if (this.gameState.isGameOver()) {
                    this.handleGameOver();
                    return;
                }

                // AI turn (opponent's color)
                const opponentColor = this.playerColor === 'white' ? 'black' : 'white';
                if (this.gameState.currentPlayer === opponentColor) {
                    this.isPlayerTurn = false;
                    await this.executeAITurn();
                } else {
                    this.isPlayerTurn = true;
                }

                this.isProcessing = false;
                return;
            }
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
        this.updatePortraitCapturedPieces();

        // Check game end conditions
        if (this.gameState.isGameOver()) {
            this.handleGameOver();
            return;
        }

        // Play check sound if opponent is now in check
        if (this.gameState.isInCheck(this.gameState.currentPlayer)) {
            this.soundManager.playCheck();
        }

        // AI turn (opponent's color)
        const opponentColor = this.playerColor === 'white' ? 'black' : 'white';
        if (this.gameState.currentPlayer === opponentColor) {
            this.isPlayerTurn = false;
            this.hideParryIndicator();
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
        // Pause the game while promotion dialog is open
        this.inPromotion = true;

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
                    // Resume the game
                    this.inPromotion = false;
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
        this.hideParryIndicator();
        this.updateStatusText(isPlayerDefending ? 'DEFEND! Press SPACE to parry!' : 'AI defending...');

        const result = await this.combatSystem.startCombat(attacker, defender, isPlayerDefending);

        this.inCombat = false;
        return result;
    }

    /**
     * Resolve combat result and update board
     * @returns {Object} { capturedPiece, moveBlocked } - moveBlocked is true if attacker failed to capture
     */
    async resolveCombat(combatResult, attacker, defender, toRow, toCol) {
        let capturedPiece = null;
        let moveBlocked = false;

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
            moveBlocked = true;
        } else {
            // Defender survives - attacker doesn't move to that square
            this.updateStatusText('Attack blocked!');
            moveBlocked = true;
        }

        return { capturedPiece, moveBlocked };
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

        // AI plays the opponent's color
        const aiColor = this.playerColor === 'white' ? 'black' : 'white';
        const move = await this.ai.getBestMove(aiColor);

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
            // Move first, then remove the captured pawn for visual consistency
            await this.performMove(piece, to.row, to.col);
            const enPassantPawn = this.board.getPieceAt(specialMove.capturedPawnRow, to.col);
            if (enPassantPawn) {
                capturedPiece = enPassantPawn;
                this.board.removePiece(enPassantPawn);
            }
        }
        // Regular capture
        else if (targetPiece && targetPiece.color !== piece.color) {
            // AI attacking player's piece - player defends!
            const combatResult = await this.initiateCombat(piece, targetPiece, true);
            const result = await this.resolveCombat(combatResult, piece, targetPiece, to.row, to.col);
            capturedPiece = result.capturedPiece;

            // If move was blocked (defender survived or counter-attacked), sync board state and end turn
            if (result.moveBlocked) {
                this.gameState.syncChessJsWithBoard();
                this.gameState.completeMove({ capturedPiece });
                if (capturedPiece) {
                    this.soundManager.playCapture();
                }
                this.updateTurnIndicator();
                this.board.updateCapturedPieces(this.gameState.capturedPieces);
                this.updatePortraitCapturedPieces();
                if (this.gameState.isGameOver()) {
                    this.handleGameOver();
                    return;
                }
                this.isPlayerTurn = true;
                this.updateStatusText('Your turn');
                return;
            }
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
        this.updatePortraitCapturedPieces();

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
        const initialTurnText = this.playerColor === 'white' ? 'Your turn' : 'Opponent\'s turn';
        this.turnText = this.add.text(width / 2, 20, initialTurnText, {
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

    createPortraitOverlay() {
        // Place portrait on the upper-left corner of the chessboard
        // Anchor at bottom-left so it sits on the board corner
        const squareSize = this.boardSize / 8;
        const portraitSize = squareSize * 1.5;

        // Position: top-left corner of the board
        const portraitX = this.boardX;
        const portraitY = this.boardY;

        // Create portrait container
        this.portraitContainer = this.add.container(portraitX, portraitY);
        this.portraitContainer.setDepth(1); // Below pieces (pieceContainer is depth 2)

        // Character portrait (no frame, just the image)
        // Anchor at bottom-left (0, 1) so portrait extends up and right from the board corner
        const portrait = this.add.image(0, 0, this.opponentPortrait);
        const scale = portraitSize / Math.max(portrait.width, portrait.height);
        portrait.setScale(scale);
        portrait.setOrigin(0, 1); // Bottom-left anchor
        this.portraitContainer.add(portrait);

        // Store portrait dimensions for captured pieces positioning
        const portraitWidth = portrait.width * scale;

        if (this.isMobile) {
            // Mobile: captured pieces to the right of portrait, above the board (top)
            const capturedX = portraitWidth + 5;
            const capturedY = -squareSize * 0.3;
            this.capturedPiecesContainer = this.add.container(capturedX, capturedY);
            this.portraitContainer.add(this.capturedPiecesContainer);
        } else {
            // Desktop: captured pieces on the right side of the board, bottom part
            // Position independently from portrait container
            const capturedX = this.boardX + this.boardSize + 15; // Right of the board
            const capturedY = this.boardY + this.boardSize - squareSize * 2; // Bottom area
            this.capturedPiecesContainer = this.add.container(capturedX, capturedY);
            this.capturedPiecesContainer.setDepth(1);
        }
    }

    updatePortraitCapturedPieces() {
        if (!this.capturedPiecesContainer) return;

        // Clear existing sprites
        this.capturedPiecesContainer.removeAll(true);

        // Get pieces captured by player
        const capturedByPlayer = this.gameState.capturedPieces[this.playerColor] || [];

        const squareSize = this.boardSize / 8;
        const pieceSize = squareSize * 0.4;

        if (this.isMobile) {
            // Mobile: horizontal layout (pieces per row)
            const piecesPerRow = 8;
            capturedByPlayer.forEach((pieceType, index) => {
                const row = Math.floor(index / piecesPerRow);
                const col = index % piecesPerRow;
                const x = col * pieceSize;
                const y = row * pieceSize;

                const sprite = this.createCapturedPieceSprite(pieceType, pieceSize);
                sprite.setPosition(x, y);
                this.capturedPiecesContainer.add(sprite);
            });
        } else {
            // Desktop: vertical layout on right side (2 columns, growing upward)
            const piecesPerCol = 8;
            capturedByPlayer.forEach((pieceType, index) => {
                const col = Math.floor(index / piecesPerCol);
                const row = index % piecesPerCol;
                const x = col * pieceSize;
                const y = -row * pieceSize; // Grow upward from bottom

                const sprite = this.createCapturedPieceSprite(pieceType, pieceSize);
                sprite.setPosition(x, y);
                this.capturedPiecesContainer.add(sprite);
            });
        }
    }

    createCapturedPieceSprite(pieceType, pieceSize) {
        // Captured pieces are opponent's color
        const opponentColor = this.playerColor === 'white' ? 'black' : 'white';
        const colorPrefix = opponentColor === 'white' ? 'W' : 'B';
        const assetKey = `${colorPrefix}_${pieceType.charAt(0).toUpperCase() + pieceType.slice(1)}`;

        const sprite = this.add.image(0, 0, assetKey);
        const scale = (pieceSize - 2) / sprite.width;
        sprite.setScale(scale);
        sprite.setAlpha(0.9);

        return sprite;
    }

    updateTurnIndicator() {
        const turn = this.gameState.currentPlayer;
        const isYourTurn = turn === this.playerColor;
        const turnLabel = isYourTurn ? 'Your turn' : 'Opponent\'s turn';

        if (this.gameState.isInCheck(turn)) {
            const checkLabel = isYourTurn ? 'You are in CHECK!' : 'Opponent in CHECK!';
            this.turnText.setText(checkLabel);
            this.turnText.setColor(isYourTurn ? '#ff4444' : '#ffaa00');
        } else {
            this.turnText.setText(turnLabel);
            this.turnText.setColor('#ffffff');
        }
    }

    updateStatusText(text) {
        this.statusText.setText(text);
    }

    showParryIndicator(piece) {
        this.hideParryIndicator();

        const parriesLeft = this.board.getParriesRemaining(piece);
        const maxParries = piece.maxParries;

        // Don't show for king (unlimited parries)
        if (maxParries >= 999) return;

        // Calculate position above the piece sprite
        const spriteX = this.board.x + piece.sprite.x;
        const spriteY = this.board.y + piece.sprite.y - this.board.squareSize * 0.6;

        // Create container for the indicator
        this.parryIndicator = this.add.container(spriteX, spriteY);
        this.parryIndicator.setDepth(50);

        // Draw flat segmented bar
        const barWidth = this.board.squareSize * 0.6;
        const barHeight = 6;
        const segmentGap = 2;
        const segmentWidth = (barWidth - (maxParries - 1) * segmentGap) / maxParries;

        // Background bar (dark)
        const bgBar = this.add.rectangle(0, 0, barWidth + 4, barHeight + 4, 0x000000);
        this.parryIndicator.add(bgBar);

        // Draw segments
        const startX = -barWidth / 2 + segmentWidth / 2;

        for (let i = 0; i < maxParries; i++) {
            const x = startX + i * (segmentWidth + segmentGap);
            const hasParry = i < parriesLeft;

            // Segment fill (orange if available, dark grey if used)
            const segmentColor = hasParry ? 0xFF8800 : 0x333333;
            const segment = this.add.rectangle(x, 0, segmentWidth, barHeight, segmentColor);
            this.parryIndicator.add(segment);
        }
    }

    hideParryIndicator() {
        if (this.parryIndicator) {
            this.tweens.killTweensOf(this.parryIndicator);
            this.parryIndicator.destroy();
            this.parryIndicator = null;
        }
    }

    handleGameOver() {
        // Stop the game completely
        this.isProcessing = true;
        this.isPlayerTurn = false;
        this.gameOver = true;

        let titleText = '';
        let subtitleText = '';
        let titleColor = '#ffffff';
        let playerWon = null;

        const opponentColor = this.playerColor === 'white' ? 'black' : 'white';
        if (this.gameState.isCheckmate(this.playerColor)) {
            titleText = 'DEFEAT';
            subtitleText = `Checkmate - ${opponentColor.charAt(0).toUpperCase() + opponentColor.slice(1)} wins`;
            titleColor = '#ff4444';
            playerWon = false;
        } else if (this.gameState.isCheckmate(opponentColor)) {
            titleText = 'VICTORY';
            subtitleText = `Checkmate - ${this.playerColor.charAt(0).toUpperCase() + this.playerColor.slice(1)} wins`;
            titleColor = '#ffd700';
            playerWon = true;
        } else if (this.gameState.isStalemate()) {
            titleText = 'DRAW';
            subtitleText = 'Stalemate';
            titleColor = '#888888';
            playerWon = null;
        } else {
            titleText = 'GAME OVER';
            subtitleText = '';
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

        // Dark overlay
        const overlay = this.add.rectangle(width / 2, height / 2, width, height, 0x000000, 0.85);
        overlay.setDepth(100);

        // Main title (VICTORY / DEFEAT / DRAW)
        const title = this.add.text(width / 2, height / 2 - 60, titleText, {
            font: 'bold 48px monospace',
            color: titleColor
        }).setOrigin(0.5).setDepth(101);

        // Subtitle
        if (subtitleText) {
            this.add.text(width / 2, height / 2 - 10, subtitleText, {
                font: '18px monospace',
                color: '#aaaaaa'
            }).setOrigin(0.5).setDepth(101);
        }

        // Play Again button
        const playAgainBtn = this.add.text(width / 2, height / 2 + 50, '[ Play Again ]', {
            font: '20px monospace',
            color: '#c9a959'
        }).setOrigin(0.5).setInteractive({ useHandCursor: true }).setDepth(101);

        playAgainBtn.on('pointerover', () => playAgainBtn.setColor('#ffffff'));
        playAgainBtn.on('pointerout', () => playAgainBtn.setColor('#c9a959'));
        playAgainBtn.on('pointerdown', () => {
            this.ai.dispose();
            this.scene.restart();
        });

        // Return to Menu button
        const menuBtn = this.add.text(width / 2, height / 2 + 90, '[ Main Menu ]', {
            font: '16px monospace',
            color: '#666666'
        }).setOrigin(0.5).setInteractive({ useHandCursor: true }).setDepth(101);

        menuBtn.on('pointerover', () => menuBtn.setColor('#ffffff'));
        menuBtn.on('pointerout', () => menuBtn.setColor('#666666'));
        menuBtn.on('pointerdown', () => {
            this.ai.dispose();
            this.scene.start('MenuScene');
        });

        // Animate the title
        this.tweens.add({
            targets: title,
            scale: { from: 0.5, to: 1 },
            alpha: { from: 0, to: 1 },
            duration: 500,
            ease: 'Back.easeOut'
        });
    }
}
