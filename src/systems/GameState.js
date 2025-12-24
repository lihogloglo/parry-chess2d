import { Chess } from 'chess.js';

/**
 * GameState - Pure chess logic, no rendering dependencies
 *
 * DESIGN PRINCIPLE: chess.js is the single source of truth for game state.
 * - Turn management: chess.turn() (not a separate currentPlayer field)
 * - Board position: chess.fen()
 * - Move validation: chess.moves() and chess.move()
 *
 * The visual board (Board.js) mirrors the chess.js state.
 */
export class GameState {
    constructor() {
        this.inCombat = false;
        this.moveHistory = [];
        this.capturedPieces = { white: [], black: [] };

        // Board reference (set by GameScene)
        this.board = null;

        // chess.js is the single source of truth
        this.chess = new Chess();
    }

    setBoard(board) {
        this.board = board;
    }

    reset() {
        this.inCombat = false;
        this.moveHistory = [];
        this.capturedPieces = { white: [], black: [] };
        this.chess.reset();
    }

    /**
     * Get the current player's turn - derived from chess.js (single source of truth)
     */
    get currentPlayer() {
        return this.chess.turn() === 'w' ? 'white' : 'black';
    }

    // Convert our row/col format to chess.js algebraic notation
    positionToSquare(row, col) {
        const files = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'];
        const rank = 8 - row; // Chess ranks go from 8 (top) to 1 (bottom)
        return files[col] + rank;
    }

    // Convert algebraic notation to our row/col format
    squareToPosition(square) {
        const files = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'];
        const col = files.indexOf(square[0]);
        const row = 8 - parseInt(square[1]);
        return { row, col };
    }

    getValidMoves(piece) {
        const { row, col } = piece.position;
        const square = this.positionToSquare(row, col);

        // Get all legal moves from chess.js for this square
        const legalMoves = this.chess.moves({ square, verbose: true });

        // Convert chess.js moves to our format
        return legalMoves.map(move => this.squareToPosition(move.to));
    }

    // Update chess.js board state when pieces move
    makeChessMove(from, to, promotion = 'q') {
        const fromSquare = this.positionToSquare(from.row, from.col);
        const toSquare = this.positionToSquare(to.row, to.col);

        try {
            const move = this.chess.move({ from: fromSquare, to: toSquare, promotion });
            return move;
        } catch (error) {
            console.error('Invalid chess move:', error);
            return null;
        }
    }

    // Check if a move would be a pawn promotion
    isPawnPromotion(piece, targetRow) {
        if (piece.type !== 'pawn') return false;

        // White pawn reaching row 0 (rank 8) or black pawn reaching row 7 (rank 1)
        return (piece.color === 'white' && targetRow === 0) ||
               (piece.color === 'black' && targetRow === 7);
    }

    isInCheck(color) {
        return this.chess.inCheck() && this.chess.turn() === (color === 'white' ? 'w' : 'b');
    }

    isCheckmate(color) {
        return this.chess.isCheckmate() && this.chess.turn() === (color === 'white' ? 'w' : 'b');
    }

    isStalemate() {
        return this.chess.isStalemate();
    }

    isGameOver() {
        // Check if a king was captured (combat system allows king capture)
        if (this.isKingCaptured('white') || this.isKingCaptured('black')) {
            return true;
        }
        return this.chess.isGameOver();
    }

    isKingCaptured(color) {
        // Check if the king of this color has been captured
        return this.capturedPieces[color === 'white' ? 'black' : 'white'].includes('king');
    }

    getWinner() {
        // Returns the color of the winner, or null if no winner yet
        if (this.isKingCaptured('white')) return 'black';
        if (this.isKingCaptured('black')) return 'white';
        if (this.chess.isCheckmate()) {
            return this.chess.turn() === 'w' ? 'black' : 'white';
        }
        return null;
    }

    recordCapture(piece) {
        const opponent = piece.color === 'white' ? 'black' : 'white';
        this.capturedPieces[opponent].push(piece.type);
    }

    getPieceSymbol(type) {
        const symbols = {
            'pawn': '♟',
            'rook': '♜',
            'knight': '♞',
            'bishop': '♝',
            'queen': '♛',
            'king': '♚'
        };
        return symbols[type] || type;
    }

    getAllValidMoves(color) {
        if (!this.board) return [];

        // Get all valid moves for all pieces of a given color
        const moves = [];
        const pieces = this.board.getPiecesByColor(color);

        pieces.forEach(piece => {
            const validMoves = this.getValidMoves(piece);
            validMoves.forEach(move => {
                moves.push({
                    piece: piece,
                    from: { ...piece.position },
                    to: { ...move }
                });
            });
        });

        return moves;
    }

    /**
     * Complete a move after makeChessMove() has been called.
     * NOTE: The turn has already been switched by chess.move() in makeChessMove().
     * This function only handles capture bookkeeping.
     *
     * @param {Object} options - { capturedPiece: piece object or null }
     */
    completeMove(options = {}) {
        const { capturedPiece = null } = options;

        if (capturedPiece) {
            this.recordCapture(capturedPiece);
        }

        // Turn is already switched by chess.js in makeChessMove()
        // No need to call switchTurn() or sync FEN here
    }

    /**
     * Sync chess.js with visual board state after combat divergence.
     * Call this ONLY when the board state differs from what chess.js expects
     * (e.g., defender won and captured the attacker instead).
     *
     * @param {string} nextTurn - 'white' or 'black' - whose turn it should be after sync
     */
    syncChessJsWithBoard(nextTurn) {
        return this.reconstructFEN(nextTurn);
    }

    /**
     * Reconstruct FEN from current visual board state.
     * @param {string} nextTurn - 'white' or 'black' - whose turn it should be
     */
    reconstructFEN(nextTurn) {
        if (!this.board) return false;

        const pieces = [];
        for (let row = 0; row < 8; row++) {
            for (let col = 0; col < 8; col++) {
                const piece = this.board.getPieceAt(row, col);
                if (piece) {
                    pieces.push({ piece, row, col });
                }
            }
        }

        // Build board representation
        const board = Array(8).fill(null).map(() => Array(8).fill(null));
        pieces.forEach(({ piece, row, col }) => {
            board[row][col] = this.getPieceFENChar(piece);
        });

        // Convert to FEN notation
        const fenRows = [];
        for (let row = 0; row < 8; row++) {
            let fenRow = '';
            let emptyCount = 0;
            for (let col = 0; col < 8; col++) {
                if (board[row][col]) {
                    if (emptyCount > 0) {
                        fenRow += emptyCount;
                        emptyCount = 0;
                    }
                    fenRow += board[row][col];
                } else {
                    emptyCount++;
                }
            }
            if (emptyCount > 0) fenRow += emptyCount;
            fenRows.push(fenRow);
        }

        const boardFEN = fenRows.join('/');
        const turn = nextTurn === 'white' ? 'w' : 'b';

        // Reconstruct castling rights
        const castling = this.getCastlingRights(pieces);

        // En passant: Not available after combat resolution
        const enPassant = '-';
        const halfmove = '0';

        // Fullmove counter
        const oldFen = this.chess.fen();
        const oldParts = oldFen.split(' ');
        let fullmove = parseInt(oldParts[5]) || 1;

        const newFen = `${boardFEN} ${turn} ${castling} ${enPassant} ${halfmove} ${fullmove}`;

        try {
            this.chess.load(newFen);
            console.log(`GameState: Synced FEN to ${newFen}`);
            return true;
        } catch (error) {
            console.error('Failed to load reconstructed FEN:', error, newFen);
            return false;
        }
    }

    getCastlingRights(pieces) {
        let castling = '';

        const whiteKing = pieces.find(p => p.piece.type === 'king' && p.piece.color === 'white');
        const blackKing = pieces.find(p => p.piece.type === 'king' && p.piece.color === 'black');

        // White kingside castling
        const whiteKingsideRook = pieces.find(p =>
            p.piece.type === 'rook' && p.piece.color === 'white' && p.row === 7 && p.col === 7
        );
        if (whiteKing && whiteKing.row === 7 && whiteKing.col === 4 &&
            whiteKingsideRook && !whiteKing.piece.hasMoved && !whiteKingsideRook.piece.hasMoved) {
            castling += 'K';
        }

        // White queenside castling
        const whiteQueensideRook = pieces.find(p =>
            p.piece.type === 'rook' && p.piece.color === 'white' && p.row === 7 && p.col === 0
        );
        if (whiteKing && whiteKing.row === 7 && whiteKing.col === 4 &&
            whiteQueensideRook && !whiteKing.piece.hasMoved && !whiteQueensideRook.piece.hasMoved) {
            castling += 'Q';
        }

        // Black kingside castling
        const blackKingsideRook = pieces.find(p =>
            p.piece.type === 'rook' && p.piece.color === 'black' && p.row === 0 && p.col === 7
        );
        if (blackKing && blackKing.row === 0 && blackKing.col === 4 &&
            blackKingsideRook && !blackKing.piece.hasMoved && !blackKingsideRook.piece.hasMoved) {
            castling += 'k';
        }

        // Black queenside castling
        const blackQueensideRook = pieces.find(p =>
            p.piece.type === 'rook' && p.piece.color === 'black' && p.row === 0 && p.col === 0
        );
        if (blackKing && blackKing.row === 0 && blackKing.col === 4 &&
            blackQueensideRook && !blackKing.piece.hasMoved && !blackQueensideRook.piece.hasMoved) {
            castling += 'q';
        }

        return castling === '' ? '-' : castling;
    }

    getPieceFENChar(piece) {
        const charMap = {
            'pawn': 'p', 'knight': 'n', 'bishop': 'b',
            'rook': 'r', 'queen': 'q', 'king': 'k'
        };
        const char = charMap[piece.type];
        return piece.color === 'white' ? char.toUpperCase() : char;
    }
}
