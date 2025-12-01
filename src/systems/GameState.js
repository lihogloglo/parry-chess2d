import { Chess } from 'chess.js';

/**
 * GameState - Pure chess logic, no rendering dependencies
 * Ported from 3D version with minimal changes
 */
export class GameState {
    constructor() {
        this.currentPlayer = 'white';
        this.inCombat = false;
        this.moveHistory = [];
        this.capturedPieces = { white: [], black: [] };

        // Board reference (set by GameScene)
        this.board = null;

        // Initialize chess.js engine for move validation
        this.chess = new Chess();
    }

    setBoard(board) {
        this.board = board;
    }

    reset() {
        this.currentPlayer = 'white';
        this.inCombat = false;
        this.moveHistory = [];
        this.capturedPieces = { white: [], black: [] };
        this.chess.reset();
    }

    switchTurn() {
        this.currentPlayer = this.currentPlayer === 'white' ? 'black' : 'white';
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
        return this.chess.isGameOver();
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

    // UNIFIED TURN MANAGEMENT - Single source of truth for all turn transitions
    completeMove(options = {}) {
        const { capturedPiece = null } = options;

        // Record any captures
        if (capturedPiece) {
            this.recordCapture(capturedPiece);
        }

        // Switch turn
        this.switchTurn();

        // Sync chess.js with visual board state
        const success = this.syncChessJsWithBoard();

        if (!success) {
            console.error('Failed to sync chess.js with board state');
            this.reconstructFEN();
        }

        return success;
    }

    // Sync chess.js engine with current visual board state
    syncChessJsWithBoard() {
        return this.reconstructFEN();
    }

    // Reconstruct FEN from current visual board state
    reconstructFEN() {
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
        const turn = this.currentPlayer === 'white' ? 'w' : 'b';

        // Reconstruct castling rights
        const castling = this.getCastlingRights(pieces);

        // En passant: Not available after combat resolution
        const enPassant = '-';
        const halfmove = '0';

        // Fullmove counter
        const oldFen = this.chess.fen();
        const oldParts = oldFen.split(' ');
        let fullmove = parseInt(oldParts[5]) || 1;
        if (turn === 'w') {
            fullmove++;
        }

        const newFen = `${boardFEN} ${turn} ${castling} ${enPassant} ${halfmove} ${fullmove}`;

        try {
            this.chess.load(newFen);
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
