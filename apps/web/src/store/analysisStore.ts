import { create } from 'zustand';
import { Chess, Square } from 'chess.js';
import { stockfish, StockfishMove } from '../services/stockfish';
import { STARTING_FEN } from '@snapchess/shared';

export type AppStep = 'input' | 'confirm' | 'analyzing' | 'results';
export type BoardMode = 'view' | 'play' | 'edit';

interface CVDetection {
  fen: string;
  confidence: number;
  squareConfidences: Record<string, number>;
  lowConfidenceSquares: string[];
  needsReview: boolean;
  validationErrors: string[];
}

export interface MoveEntry {
  from: string;
  to: string;
  san: string;
  promotion?: string;
}

interface AnalysisState {
  // App flow
  step: AppStep;
  uploadedImageUrl: string | null;

  // CV detection
  detection: CVDetection | null;
  isDetecting: boolean;

  // Chess state
  fen: string;
  topMoves: StockfishMove[];
  isAnalyzing: boolean;
  depth: number;
  currentDepth: number;
  error: string | null;
  boardFlipped: boolean;

  // Board interaction
  boardMode: BoardMode;
  moveHistory: MoveEntry[];
  fenHistory: string[];
  currentMoveIndex: number;
  startingFen: string;
  selectedSquare: string | null;
  legalMovesForSelected: string[];
  lastMove: { from: string; to: string } | null;

  // Editor state
  editorSelectedPiece: string | null;
  editorPlaceMode: 'place' | 'remove';

  // Actions
  setFen: (fen: string) => void;
  analyze: (fen?: string) => Promise<void>;
  stopAnalysis: () => void;
  flipBoard: () => void;
  setDetection: (detection: CVDetection, imageUrl: string) => void;
  confirmPosition: (fen: string) => void;
  updateSquare: (square: string, piece: string | null) => void;
  reset: () => void;

  // Board interaction actions
  setBoardMode: (mode: BoardMode) => void;
  makeMove: (from: string, to: string, promotion?: string) => boolean;
  selectSquare: (square: string) => void;
  goToMove: (index: number) => void;
  undoMove: () => void;
  reanalyze: () => void;
  setFullFen: (fen: string) => void;
  setEditorPiece: (piece: string | null) => void;
  setEditorPlaceMode: (mode: 'place' | 'remove') => void;
  clearSelection: () => void;
}

export const useAnalysisStore = create<AnalysisState>((set, get) => ({
  step: 'input',
  uploadedImageUrl: null,
  detection: null,
  isDetecting: false,
  fen: STARTING_FEN,
  topMoves: [],
  isAnalyzing: false,
  depth: 18,
  currentDepth: 0,
  error: null,
  boardFlipped: false,

  // Board interaction defaults
  boardMode: 'view',
  moveHistory: [],
  fenHistory: [],
  currentMoveIndex: -1,
  startingFen: STARTING_FEN,
  selectedSquare: null,
  legalMovesForSelected: [],
  lastMove: null,

  // Editor defaults
  editorSelectedPiece: null,
  editorPlaceMode: 'place',

  setFen: (fen: string) => set({ fen, topMoves: [], error: null, currentDepth: 0 }),

  analyze: async (fenOverride?: string) => {
    const fen = fenOverride || get().fen;
    set({ isAnalyzing: true, error: null, topMoves: [], currentDepth: 0, fen, step: 'analyzing' });

    try {
      const moves = await stockfish.analyze(fen, get().depth, (progressMoves) => {
        if (progressMoves.length > 0) {
          set({
            topMoves: progressMoves,
            currentDepth: progressMoves[0].depth,
          });
        }
      });
      set({
        topMoves: moves,
        isAnalyzing: false,
        step: 'results',
        boardMode: 'play',
        startingFen: fen,
        fenHistory: [fen],
        moveHistory: [],
        currentMoveIndex: 0,
        selectedSquare: null,
        legalMovesForSelected: [],
        lastMove: null,
      });
    } catch (e) {
      set({
        error: e instanceof Error ? e.message : 'Analysis failed',
        isAnalyzing: false,
        step: 'results',
      });
    }
  },

  stopAnalysis: () => {
    stockfish.stop();
    set({ isAnalyzing: false, step: 'results' });
  },

  flipBoard: () => set((s) => ({ boardFlipped: !s.boardFlipped })),

  setDetection: (detection: CVDetection, imageUrl: string) =>
    set({
      detection,
      fen: detection.fen,
      uploadedImageUrl: imageUrl,
      step: 'confirm',
      topMoves: [],
      error: null,
    }),

  confirmPosition: (fen: string) => {
    set({ fen });
    get().analyze(fen);
  },

  updateSquare: (square: string, piece: string | null) => {
    const { fen } = get();
    const newFen = updateFenSquare(fen, square, piece);
    set({ fen: newFen });
  },

  reset: () =>
    set({
      step: 'input',
      uploadedImageUrl: null,
      detection: null,
      isDetecting: false,
      fen: STARTING_FEN,
      topMoves: [],
      isAnalyzing: false,
      error: null,
      currentDepth: 0,
      boardMode: 'view',
      moveHistory: [],
      fenHistory: [],
      currentMoveIndex: -1,
      startingFen: STARTING_FEN,
      selectedSquare: null,
      legalMovesForSelected: [],
      lastMove: null,
      editorSelectedPiece: null,
      editorPlaceMode: 'place',
    }),

  setBoardMode: (mode: BoardMode) => {
    const state = get();
    if (mode === 'play' && state.boardMode !== 'play') {
      // Initialize play mode from current FEN
      set({
        boardMode: 'play',
        startingFen: state.fen,
        fenHistory: [state.fen],
        moveHistory: [],
        currentMoveIndex: 0,
        selectedSquare: null,
        legalMovesForSelected: [],
        lastMove: null,
      });
    } else if (mode === 'edit') {
      set({
        boardMode: 'edit',
        selectedSquare: null,
        legalMovesForSelected: [],
        lastMove: null,
      });
    } else {
      set({
        boardMode: mode,
        selectedSquare: null,
        legalMovesForSelected: [],
      });
    }
  },

  makeMove: (from: string, to: string, promotion?: string) => {
    const state = get();
    const chess = new Chess(state.fen);

    try {
      const move = chess.move({
        from: from as Square,
        to: to as Square,
        promotion: promotion as any,
      });
      if (!move) return false;

      // Truncate forward history if we navigated back
      const truncatedMoveHistory = state.moveHistory.slice(0, state.currentMoveIndex);
      const truncatedFenHistory = state.fenHistory.slice(0, state.currentMoveIndex + 1);

      const newFen = chess.fen();
      set({
        fen: newFen,
        moveHistory: [...truncatedMoveHistory, { from, to, san: move.san, promotion }],
        fenHistory: [...truncatedFenHistory, newFen],
        currentMoveIndex: truncatedMoveHistory.length + 1,
        selectedSquare: null,
        legalMovesForSelected: [],
        lastMove: { from, to },
        topMoves: [],
      });
      return true;
    } catch {
      return false;
    }
  },

  selectSquare: (square: string) => {
    const state = get();

    if (state.boardMode === 'edit') {
      if (state.editorPlaceMode === 'remove') {
        get().updateSquare(square, null);
      } else if (state.editorSelectedPiece) {
        get().updateSquare(square, state.editorSelectedPiece);
      }
      return;
    }

    if (state.boardMode !== 'play') return;

    const chess = new Chess(state.fen);

    // If a square is already selected, try to move there
    if (state.selectedSquare) {
      if (state.selectedSquare === square) {
        // Deselect
        set({ selectedSquare: null, legalMovesForSelected: [] });
        return;
      }

      // Check if this is a legal move target
      if (state.legalMovesForSelected.includes(square)) {
        // Check for promotion
        const piece = chess.get(state.selectedSquare as Square);
        const targetRank = square[1];
        if (piece?.type === 'p' && (targetRank === '8' || targetRank === '1')) {
          // Promotion — don't execute yet, let the UI handle it
          set({ selectedSquare: state.selectedSquare, legalMovesForSelected: [square] });
          return;
        }
        get().makeMove(state.selectedSquare, square);
        return;
      }

      // Clicking a different own piece — select it instead
      const clickedPiece = chess.get(square as Square);
      if (clickedPiece && clickedPiece.color === chess.turn()) {
        const moves = chess.moves({ square: square as Square, verbose: true });
        set({
          selectedSquare: square,
          legalMovesForSelected: moves.map((m) => m.to),
        });
        return;
      }

      // Invalid move — deselect
      set({ selectedSquare: null, legalMovesForSelected: [] });
      return;
    }

    // No square selected — select if it's our piece
    const piece = chess.get(square as Square);
    if (piece && piece.color === chess.turn()) {
      const moves = chess.moves({ square: square as Square, verbose: true });
      set({
        selectedSquare: square,
        legalMovesForSelected: moves.map((m) => m.to),
      });
    }
  },

  goToMove: (index: number) => {
    const state = get();
    if (index < 0 || index >= state.fenHistory.length) return;
    const lastMoveEntry = index > 0 ? state.moveHistory[index - 1] : null;
    set({
      fen: state.fenHistory[index],
      currentMoveIndex: index,
      selectedSquare: null,
      legalMovesForSelected: [],
      topMoves: [],
      lastMove: lastMoveEntry ? { from: lastMoveEntry.from, to: lastMoveEntry.to } : null,
    });
  },

  undoMove: () => {
    const state = get();
    if (state.currentMoveIndex > 0) {
      get().goToMove(state.currentMoveIndex - 1);
    }
  },

  reanalyze: () => {
    const state = get();
    get().analyze(state.fen);
  },

  setFullFen: (fen: string) => {
    try {
      new Chess(fen); // Validate
      set({
        fen,
        selectedSquare: null,
        legalMovesForSelected: [],
        topMoves: [],
        lastMove: null,
      });
    } catch {
      // Invalid FEN — ignore
    }
  },

  setEditorPiece: (piece: string | null) => set({ editorSelectedPiece: piece, editorPlaceMode: 'place' }),

  setEditorPlaceMode: (mode: 'place' | 'remove') => {
    set({ editorPlaceMode: mode });
    if (mode === 'remove') set({ editorSelectedPiece: null });
  },

  clearSelection: () => set({ selectedSquare: null, legalMovesForSelected: [] }),
}));

function updateFenSquare(fen: string, square: string, piece: string | null): string {
  const file = square.charCodeAt(0) - 97; // 'a' = 0
  const rank = parseInt(square[1]) - 1; // '1' = 0
  const fenRank = 7 - rank; // FEN ranks go 8 to 1

  const parts = fen.split(' ');
  const rows = parts[0].split('/');

  // Expand the row to 8 characters
  let expanded = '';
  for (const ch of rows[fenRank]) {
    if (ch >= '1' && ch <= '8') {
      expanded += '.'.repeat(parseInt(ch));
    } else {
      expanded += ch;
    }
  }

  // Replace the character at the file position
  const pieceChar = piece ? fenPieceChar(piece) : '.';
  expanded = expanded.substring(0, file) + pieceChar + expanded.substring(file + 1);

  // Compress back to FEN
  let compressed = '';
  let emptyCount = 0;
  for (const ch of expanded) {
    if (ch === '.') {
      emptyCount++;
    } else {
      if (emptyCount > 0) {
        compressed += emptyCount.toString();
        emptyCount = 0;
      }
      compressed += ch;
    }
  }
  if (emptyCount > 0) compressed += emptyCount.toString();

  rows[fenRank] = compressed;
  parts[0] = rows.join('/');
  return parts.join(' ');
}

function fenPieceChar(piece: string): string {
  const map: Record<string, string> = {
    wp: 'P', wn: 'N', wb: 'B', wr: 'R', wq: 'Q', wk: 'K',
    bp: 'p', bn: 'n', bb: 'b', br: 'r', bq: 'q', bk: 'k',
  };
  return map[piece] || '.';
}
