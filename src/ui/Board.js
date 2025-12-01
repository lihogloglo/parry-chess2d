import Phaser from 'phaser';
import { POSTURE_LIMITS } from '../data/CombatData.js';

/**
 * Board - 2D Chess board rendering and piece management
 */
export class Board {
    constructor(scene, x, y, size) {
        this.scene = scene;
        this.x = x;
        this.y = y;
        this.size = size;
        this.squareSize = size / 8;

        // Colors
        this.lightColor = 0xF0D9B5;  // Light squares
        this.darkColor = 0xB58863;   // Dark squares
        this.highlightColor = 0x7FFF7F;  // Valid move highlight
        this.selectedColor = 0xAAFF00;   // Selected piece highlight (green-yellow)

        // Piece data
        this.pieces = [];
        this.squares = [];
        this.highlights = [];

        // Graphics containers
        this.boardContainer = scene.add.container(x, y);
        this.pieceContainer = scene.add.container(x, y);
        this.highlightContainer = scene.add.container(x, y);

        // Ensure proper layering
        this.highlightContainer.setDepth(1);
        this.pieceContainer.setDepth(2);

        // Captured pieces display (top and bottom of board)
        this.capturedContainerTop = scene.add.container(0, 0);
        this.capturedContainerBottom = scene.add.container(0, 0);
        this.capturedSprites = { white: [], black: [] };

        this.createBoard();
        this.createCapturedPanels();
        this.setupInitialPosition();
    }

    createCapturedPanels() {
        const panelWidth = this.size;
        const panelHeight = 40;
        const capturedPieceSize = this.squareSize * 0.5;

        // Top panel - pieces captured BY black (white pieces lost)
        const topPanelX = this.x + this.size / 2;
        const topPanelY = this.y - panelHeight / 2 - 5;

        this.capturedContainerTop.setPosition(topPanelX, topPanelY);

        // Label for top panel
        const topLabel = this.scene.add.text(-panelWidth / 2 + 5, 0, 'BLACK:', {
            font: '11px monospace',
            color: '#888888'
        }).setOrigin(0, 0.5);
        this.capturedContainerTop.add(topLabel);

        // Bottom panel - pieces captured BY white (black pieces lost)
        const bottomPanelX = this.x + this.size / 2;
        const bottomPanelY = this.y + this.size + panelHeight / 2 + 5;

        this.capturedContainerBottom.setPosition(bottomPanelX, bottomPanelY);

        // Label for bottom panel
        const bottomLabel = this.scene.add.text(-panelWidth / 2 + 5, 0, 'WHITE:', {
            font: '11px monospace',
            color: '#888888'
        }).setOrigin(0, 0.5);
        this.capturedContainerBottom.add(bottomLabel);

        // Store size for later use
        this.capturedPieceSize = capturedPieceSize;
        this.capturedPanelWidth = panelWidth;
        this.labelOffset = 55; // Space after label for pieces
    }

    updateCapturedPieces(capturedPieces) {
        // Clear existing captured piece sprites
        this.capturedSprites.white.forEach(s => s.destroy());
        this.capturedSprites.black.forEach(s => s.destroy());
        this.capturedSprites = { white: [], black: [] };

        const startX = -this.capturedPanelWidth / 2 + this.labelOffset;
        const spacing = this.capturedPieceSize + 3;

        // Pieces captured by white (black pieces) - bottom panel
        capturedPieces.white.forEach((pieceType, index) => {
            const x = startX + index * spacing;

            const assetKey = `B_${pieceType.charAt(0).toUpperCase() + pieceType.slice(1)}`;
            const sprite = this.scene.add.image(x, 0, assetKey);
            const scale = this.capturedPieceSize / sprite.width;
            sprite.setScale(scale);
            sprite.setAlpha(0.9);

            this.capturedContainerBottom.add(sprite);
            this.capturedSprites.white.push(sprite);
        });

        // Pieces captured by black (white pieces) - top panel
        capturedPieces.black.forEach((pieceType, index) => {
            const x = startX + index * spacing;

            const assetKey = `W_${pieceType.charAt(0).toUpperCase() + pieceType.slice(1)}`;
            const sprite = this.scene.add.image(x, 0, assetKey);
            const scale = this.capturedPieceSize / sprite.width;
            sprite.setScale(scale);
            sprite.setAlpha(0.9);

            this.capturedContainerTop.add(sprite);
            this.capturedSprites.black.push(sprite);
        });
    }

    createBoard() {
        for (let row = 0; row < 8; row++) {
            this.squares[row] = [];
            for (let col = 0; col < 8; col++) {
                const isLight = (row + col) % 2 === 0;
                const color = isLight ? this.lightColor : this.darkColor;

                const square = this.scene.add.rectangle(
                    col * this.squareSize + this.squareSize / 2,
                    row * this.squareSize + this.squareSize / 2,
                    this.squareSize,
                    this.squareSize,
                    color
                );

                square.setStrokeStyle(1, 0x000000, 0.2);
                square.setInteractive();

                // Store position data
                square.boardRow = row;
                square.boardCol = col;

                this.squares[row][col] = square;
                this.boardContainer.add(square);
            }
        }
    }

    setupInitialPosition() {
        // Clear existing pieces
        this.pieces.forEach(p => p.sprite?.destroy());
        this.pieces = [];

        // Standard chess starting position
        const backRow = ['rook', 'knight', 'bishop', 'queen', 'king', 'bishop', 'knight', 'rook'];

        // Black pieces (top)
        for (let col = 0; col < 8; col++) {
            this.createPiece(backRow[col], 'black', 0, col);
            this.createPiece('pawn', 'black', 1, col);
        }

        // White pieces (bottom)
        for (let col = 0; col < 8; col++) {
            this.createPiece('pawn', 'white', 6, col);
            this.createPiece(backRow[col], 'white', 7, col);
        }
    }

    createPiece(type, color, row, col) {
        const piece = {
            type,
            color,
            position: { row, col },
            hasMoved: false,
            posture: 0,
            maxPosture: POSTURE_LIMITS[type] || 3,
            sprite: null,
        };

        // Create visual representation
        const x = col * this.squareSize + this.squareSize / 2;
        const y = row * this.squareSize + this.squareSize / 2;

        // Build asset key: W_Pawn, B_King, etc.
        const colorPrefix = color === 'white' ? 'W' : 'B';
        const typeName = type.charAt(0).toUpperCase() + type.slice(1);
        const assetKey = `${colorPrefix}_${typeName}`;

        // Create sprite from loaded asset
        const sprite = this.scene.add.image(x, y, assetKey);

        // Scale sprite uniformly to fit within square (16x32 pieces are taller than wide)
        // Use width-based scaling to fit horizontally, allowing height to extend
        const scale = (this.squareSize * 0.8) / sprite.width;
        sprite.setScale(scale);

        // Set origin to center horizontally, but lower vertically so piece sits on square
        // For 16x32 sprites, 0.5 horizontal and ~0.7 vertical centers the "body" of the piece
        sprite.setOrigin(0.5, 0.75);

        sprite.setInteractive();
        sprite.pieceData = piece;

        piece.sprite = sprite;
        this.pieces.push(piece);
        this.pieceContainer.add(sprite);

        // Sort pieces by Y position for correct render order
        this.sortPiecesByDepth();

        return piece;
    }

    sortPiecesByDepth() {
        // Sort container children by Y position (lower Y = rendered first = behind)
        this.pieceContainer.sort('y');
    }

    getPieceAt(row, col) {
        return this.pieces.find(p =>
            p.position.row === row && p.position.col === col
        );
    }

    getPiecesByColor(color) {
        return this.pieces.filter(p => p.color === color);
    }

    movePiece(piece, toRow, toCol, animate = true) {
        const targetX = toCol * this.squareSize + this.squareSize / 2;
        const targetY = toRow * this.squareSize + this.squareSize / 2;

        if (animate && piece.sprite) {
            this.scene.tweens.add({
                targets: piece.sprite,
                x: targetX,
                y: targetY,
                duration: 200,
                ease: 'Power2',
                onUpdate: () => this.sortPiecesByDepth(),
                onComplete: () => this.sortPiecesByDepth()
            });
        } else if (piece.sprite) {
            piece.sprite.x = targetX;
            piece.sprite.y = targetY;
            this.sortPiecesByDepth();
        }

        piece.position.row = toRow;
        piece.position.col = toCol;
        piece.hasMoved = true;
    }

    removePiece(piece) {
        const index = this.pieces.indexOf(piece);
        if (index > -1) {
            this.pieces.splice(index, 1);
            if (piece.sprite) {
                piece.sprite.destroy();
            }
        }
    }

    showValidMoves(moves) {
        moves.forEach(move => {
            const x = move.col * this.squareSize + this.squareSize / 2;
            const y = move.row * this.squareSize + this.squareSize / 2;

            // Check if there's a piece to capture
            const targetPiece = this.getPieceAt(move.row, move.col);

            if (targetPiece) {
                // Capture indicator (ring)
                const ring = this.scene.add.circle(x, y, this.squareSize * 0.45, 0x000000, 0);
                ring.setStrokeStyle(4, this.highlightColor, 0.8);
                this.highlights.push(ring);
                this.highlightContainer.add(ring);
            } else {
                // Move indicator (dot)
                const dot = this.scene.add.circle(x, y, this.squareSize * 0.15, this.highlightColor, 0.6);
                this.highlights.push(dot);
                this.highlightContainer.add(dot);
            }
        });
    }

    highlightSquare(row, col, color = this.selectedColor) {
        const x = col * this.squareSize + this.squareSize / 2;
        const y = row * this.squareSize + this.squareSize / 2;

        const highlight = this.scene.add.rectangle(
            x, y,
            this.squareSize, this.squareSize,
            color, 0.4
        );

        this.highlights.push(highlight);
        this.highlightContainer.add(highlight);
    }

    clearHighlights() {
        this.highlights.forEach(h => h.destroy());
        this.highlights = [];
    }

    highlightMove(fromRow, fromCol, toRow, toCol, color = this.selectedColor) {
        this.highlightSquare(fromRow, fromCol, color);
        this.highlightSquare(toRow, toCol, color);
    }

    clearMoveHighlight() {
        // Alias for clearHighlights - used after move completes
        this.clearHighlights();
    }

    getSquareFromPointer(pointer) {
        // Convert pointer position to board coordinates
        const localX = pointer.x - this.x;
        const localY = pointer.y - this.y;

        if (localX < 0 || localY < 0 || localX >= this.size || localY >= this.size) {
            return null;
        }

        const col = Math.floor(localX / this.squareSize);
        const row = Math.floor(localY / this.squareSize);

        return { row, col };
    }

    // Posture system methods
    addPosture(piece, amount) {
        piece.posture = Math.min(piece.posture + amount, piece.maxPosture);
        return piece.posture >= piece.maxPosture;
    }

    resetPosture(piece) {
        piece.posture = 0;
    }

    isPostureBroken(piece) {
        return piece.posture >= piece.maxPosture;
    }

    reset() {
        this.clearHighlights();
        this.setupInitialPosition();
    }

    /**
     * Change a piece's type (used for pawn promotion)
     * @param {Object} piece - The piece to transform
     * @param {string} newType - The new type (queen, rook, bishop, knight)
     */
    promotePiece(piece, newType) {
        piece.type = newType;

        // Update sprite
        const colorPrefix = piece.color === 'white' ? 'W' : 'B';
        const typeName = newType.charAt(0).toUpperCase() + newType.slice(1);
        const assetKey = `${colorPrefix}_${typeName}`;

        // Store current position
        const x = piece.sprite.x;
        const y = piece.sprite.y;

        // Destroy old sprite and create new one
        this.pieceContainer.remove(piece.sprite);
        piece.sprite.destroy();

        const sprite = this.scene.add.image(x, y, assetKey);
        const scale = (this.squareSize * 0.8) / sprite.width;
        sprite.setScale(scale);
        sprite.setOrigin(0.5, 0.75);
        sprite.setInteractive();
        sprite.pieceData = piece;

        piece.sprite = sprite;
        this.pieceContainer.add(sprite);
        this.sortPiecesByDepth();
    }
}
