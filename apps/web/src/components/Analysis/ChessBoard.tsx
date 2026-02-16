import { useMemo, useState, useCallback, useRef } from 'react';
import { Chess, Square } from 'chess.js';
import { useAnalysisStore } from '../../store/analysisStore';
import { getPieceSvg } from './pieces';
import { PromotionPicker } from './PromotionPicker';
import styles from './ChessBoard.module.css';

const FILES = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'];
const RANKS = [8, 7, 6, 5, 4, 3, 2, 1];

interface SquareData {
  square: string;
  piece: string | null; // e.g. "wk", "bp"
  isLight: boolean;
  row: number;
  col: number;
}

function squareToCoords(square: string, flipped: boolean): { x: number; y: number } {
  const file = square.charCodeAt(0) - 97;
  const rank = parseInt(square[1]) - 1;
  const col = flipped ? 7 - file : file;
  const row = flipped ? rank : 7 - rank;
  return { x: col * 12.5 + 6.25, y: row * 12.5 + 6.25 };
}

interface DragState {
  piece: string;
  fromSquare: string;
  currentX: number;
  currentY: number;
}

export function ChessBoard() {
  const {
    fen, boardFlipped, topMoves, boardMode,
    selectedSquare, legalMovesForSelected, lastMove,
    selectSquare, makeMove, clearSelection,
  } = useAnalysisStore();

  const svgRef = useRef<SVGSVGElement>(null);
  const [dragging, setDragging] = useState<DragState | null>(null);
  const [promotionPending, setPromotionPending] = useState<{ from: string; to: string } | null>(null);

  const squares: SquareData[] = useMemo(() => {
    const chess = new Chess();
    try {
      chess.load(fen);
    } catch {
      return [];
    }

    const result: SquareData[] = [];
    const ranks = boardFlipped ? [...RANKS].reverse() : RANKS;
    const files = boardFlipped ? [...FILES].reverse() : FILES;

    ranks.forEach((rank, row) => {
      files.forEach((file, col) => {
        const square = `${file}${rank}`;
        const piece = chess.get(square as any);
        const isLight = (rank + file.charCodeAt(0)) % 2 === 1;

        result.push({
          square,
          piece: piece ? `${piece.color}${piece.type}` : null,
          isLight,
          row,
          col,
        });
      });
    });

    return result;
  }, [fen, boardFlipped]);

  // Convert SVG pointer coordinates to square name
  const pointerToSquare = useCallback((clientX: number, clientY: number): string | null => {
    const svg = svgRef.current;
    if (!svg) return null;
    const rect = svg.getBoundingClientRect();
    const x = ((clientX - rect.left) / rect.width) * 100;
    const y = ((clientY - rect.top) / rect.height) * 100;
    const col = Math.floor(x / 12.5);
    const row = Math.floor(y / 12.5);
    if (col < 0 || col > 7 || row < 0 || row > 7) return null;

    const file = boardFlipped ? 7 - col : col;
    const rank = boardFlipped ? row : 7 - row;
    return `${String.fromCharCode(97 + file)}${rank + 1}`;
  }, [boardFlipped]);

  // Convert client coordinates to SVG viewBox coordinates
  const clientToSvg = useCallback((clientX: number, clientY: number): { x: number; y: number } => {
    const svg = svgRef.current;
    if (!svg) return { x: 0, y: 0 };
    const rect = svg.getBoundingClientRect();
    return {
      x: ((clientX - rect.left) / rect.width) * 100,
      y: ((clientY - rect.top) / rect.height) * 100,
    };
  }, []);

  const handlePointerDown = useCallback((e: React.PointerEvent) => {
    if (boardMode === 'view') return;
    if (promotionPending) return;

    const square = pointerToSquare(e.clientX, e.clientY);
    if (!square) return;

    if (boardMode === 'edit') {
      selectSquare(square);
      return;
    }

    // Play mode — start drag if it's a piece
    const chess = new Chess(fen);
    const piece = chess.get(square as Square);

    if (piece && piece.color === chess.turn()) {
      const svgCoords = clientToSvg(e.clientX, e.clientY);
      setDragging({
        piece: `${piece.color}${piece.type}`,
        fromSquare: square,
        currentX: svgCoords.x,
        currentY: svgCoords.y,
      });
      (e.target as Element).setPointerCapture(e.pointerId);

      // Also select the square for legal move dots
      selectSquare(square);
    } else if (selectedSquare) {
      // Clicking a target square while a piece is selected
      handleTargetClick(square);
    }
  }, [boardMode, fen, selectedSquare, promotionPending, pointerToSquare, clientToSvg, selectSquare]);

  const handlePointerMove = useCallback((e: React.PointerEvent) => {
    if (!dragging) return;
    const svgCoords = clientToSvg(e.clientX, e.clientY);
    setDragging((prev) => prev ? { ...prev, currentX: svgCoords.x, currentY: svgCoords.y } : null);
  }, [dragging, clientToSvg]);

  const handlePointerUp = useCallback((e: React.PointerEvent) => {
    if (!dragging) return;

    const targetSquare = pointerToSquare(e.clientX, e.clientY);
    setDragging(null);

    if (!targetSquare || targetSquare === dragging.fromSquare) {
      // Dropped on same square or outside — keep selection for click-click
      return;
    }

    // Check if it's a promotion
    const chess = new Chess(fen);
    const piece = chess.get(dragging.fromSquare as Square);
    if (piece?.type === 'p' && (targetSquare[1] === '8' || targetSquare[1] === '1')) {
      setPromotionPending({ from: dragging.fromSquare, to: targetSquare });
      clearSelection();
      return;
    }

    makeMove(dragging.fromSquare, targetSquare);
  }, [dragging, fen, pointerToSquare, makeMove, clearSelection]);

  const handleTargetClick = useCallback((square: string) => {
    if (!selectedSquare) return;

    // Check for promotion
    const chess = new Chess(fen);
    const piece = chess.get(selectedSquare as Square);
    if (piece?.type === 'p' && (square[1] === '8' || square[1] === '1')) {
      // Check it's actually a legal move
      const moves = chess.moves({ square: selectedSquare as Square, verbose: true });
      if (moves.some((m) => m.to === square)) {
        setPromotionPending({ from: selectedSquare, to: square });
        clearSelection();
        return;
      }
    }

    selectSquare(square);
  }, [selectedSquare, fen, selectSquare, clearSelection]);

  const handlePromotion = useCallback((piece: string) => {
    if (!promotionPending) return;
    makeMove(promotionPending.from, promotionPending.to, piece);
    setPromotionPending(null);
  }, [promotionPending, makeMove]);

  // Arrows — show only when no user moves have been made
  const bestMove = topMoves[0]?.bestMove;
  const secondMove = topMoves[1]?.bestMove;
  const showArrows = boardMode === 'view' || (boardMode === 'play' && topMoves.length > 0);

  const arrows = useMemo(() => {
    if (!showArrows) return [];
    const result: { from: string; to: string; color: string; opacity: number }[] = [];
    if (bestMove) {
      result.push({
        from: bestMove.slice(0, 2),
        to: bestMove.slice(2, 4),
        color: '#4ecdc4',
        opacity: 0.85,
      });
    }
    if (secondMove) {
      result.push({
        from: secondMove.slice(0, 2),
        to: secondMove.slice(2, 4),
        color: '#e94560',
        opacity: 0.5,
      });
    }
    return result;
  }, [bestMove, secondMove, showArrows]);

  // Determine active turn color for promotion picker
  const turnColor = useMemo(() => {
    try {
      const chess = new Chess(fen);
      return chess.turn();
    } catch {
      return 'w';
    }
  }, [fen]);

  const isInteractive = boardMode === 'play' || boardMode === 'edit';
  const cursorClass = boardMode === 'edit' ? styles.editCursor : boardMode === 'play' ? styles.playCursor : '';

  return (
    <div className={styles.boardContainer} style={{ position: 'relative' }}>
      <svg
        ref={svgRef}
        viewBox="0 0 100 100"
        className={`${styles.board} ${cursorClass}`}
        onPointerDown={isInteractive ? handlePointerDown : undefined}
        onPointerMove={isInteractive ? handlePointerMove : undefined}
        onPointerUp={isInteractive ? handlePointerUp : undefined}
      >
        <defs>
          <marker id="arrowhead-best" markerWidth="4" markerHeight="3" refX="3.5" refY="1.5" orient="auto">
            <polygon points="0 0, 4 1.5, 0 3" fill="#4ecdc4" />
          </marker>
          <marker id="arrowhead-alt" markerWidth="4" markerHeight="3" refX="3.5" refY="1.5" orient="auto">
            <polygon points="0 0, 4 1.5, 0 3" fill="#e94560" />
          </marker>
        </defs>

        {/* Squares */}
        {squares.map((sq) => (
          <rect
            key={sq.square}
            x={sq.col * 12.5}
            y={sq.row * 12.5}
            width="12.5"
            height="12.5"
            fill={sq.isLight ? 'var(--board-light)' : 'var(--board-dark)'}
          />
        ))}

        {/* Last move highlight */}
        {lastMove && boardMode === 'play' && (
          <>
            <rect
              x={squareToCoords(lastMove.from, boardFlipped).x - 6.25}
              y={squareToCoords(lastMove.from, boardFlipped).y - 6.25}
              width="12.5" height="12.5"
              fill="rgba(255, 255, 0, 0.2)"
            />
            <rect
              x={squareToCoords(lastMove.to, boardFlipped).x - 6.25}
              y={squareToCoords(lastMove.to, boardFlipped).y - 6.25}
              width="12.5" height="12.5"
              fill="rgba(255, 255, 0, 0.2)"
            />
          </>
        )}

        {/* Selected square highlight */}
        {selectedSquare && (
          <rect
            x={squareToCoords(selectedSquare, boardFlipped).x - 6.25}
            y={squareToCoords(selectedSquare, boardFlipped).y - 6.25}
            width="12.5" height="12.5"
            fill="rgba(255, 255, 0, 0.4)"
          />
        )}

        {/* Highlight best move squares */}
        {showArrows && bestMove && (
          <>
            <rect
              x={squareToCoords(bestMove.slice(0, 2), boardFlipped).x - 6.25}
              y={squareToCoords(bestMove.slice(0, 2), boardFlipped).y - 6.25}
              width="12.5" height="12.5"
              fill="rgba(78, 205, 196, 0.3)"
            />
            <rect
              x={squareToCoords(bestMove.slice(2, 4), boardFlipped).x - 6.25}
              y={squareToCoords(bestMove.slice(2, 4), boardFlipped).y - 6.25}
              width="12.5" height="12.5"
              fill="rgba(78, 205, 196, 0.3)"
            />
          </>
        )}

        {/* Legal move dots */}
        {selectedSquare && legalMovesForSelected.map((target) => {
          const coords = squareToCoords(target, boardFlipped);
          const targetSquareData = squares.find((s) => s.square === target);
          const isCapture = targetSquareData?.piece != null;

          return isCapture ? (
            <circle
              key={`legal-${target}`}
              cx={coords.x}
              cy={coords.y}
              r="5.5"
              fill="none"
              stroke="rgba(0, 0, 0, 0.3)"
              strokeWidth="1.2"
            />
          ) : (
            <circle
              key={`legal-${target}`}
              cx={coords.x}
              cy={coords.y}
              r="1.8"
              fill="rgba(0, 0, 0, 0.3)"
            />
          );
        })}

        {/* Pieces */}
        {squares.map((sq) => {
          if (!sq.piece) return null;
          // Hide piece at drag origin
          if (dragging && sq.square === dragging.fromSquare) return null;
          const svgContent = getPieceSvg(sq.piece);
          if (!svgContent) return null;

          return (
            <g
              key={`piece-${sq.square}`}
              transform={`translate(${sq.col * 12.5 + 0.5}, ${sq.row * 12.5 + 0.5}) scale(${11.5 / 45})`}
              dangerouslySetInnerHTML={{ __html: svgContent }}
            />
          );
        })}

        {/* Floating drag piece */}
        {dragging && (() => {
          const svgContent = getPieceSvg(dragging.piece);
          if (!svgContent) return null;
          const scale = 13 / 45; // Slightly larger than board pieces
          const offset = (13 / 2);
          return (
            <g
              transform={`translate(${dragging.currentX - offset}, ${dragging.currentY - offset}) scale(${scale})`}
              dangerouslySetInnerHTML={{ __html: svgContent }}
              style={{ pointerEvents: 'none' }}
              opacity={0.9}
            />
          );
        })()}

        {/* Move arrows */}
        {arrows.map((arrow, i) => {
          const from = squareToCoords(arrow.from, boardFlipped);
          const to = squareToCoords(arrow.to, boardFlipped);
          return (
            <line
              key={`arrow-${i}`}
              x1={from.x} y1={from.y}
              x2={to.x} y2={to.y}
              stroke={arrow.color}
              strokeWidth="1.8"
              strokeLinecap="round"
              opacity={arrow.opacity}
              markerEnd={`url(#arrowhead-${i === 0 ? 'best' : 'alt'})`}
            />
          );
        })}

        {/* Coordinate labels */}
        {(boardFlipped ? [...FILES].reverse() : FILES).map((file, i) => (
          <text
            key={`file-${file}`}
            x={i * 12.5 + 11.5}
            y="99"
            fontSize="2.8"
            fill="rgba(0,0,0,0.5)"
            fontWeight="bold"
            fontFamily="sans-serif"
          >
            {file}
          </text>
        ))}
        {(boardFlipped ? [...RANKS].reverse() : RANKS).map((rank, i) => (
          <text
            key={`rank-${rank}`}
            x="0.8"
            y={i * 12.5 + 4}
            fontSize="2.8"
            fill="rgba(0,0,0,0.5)"
            fontWeight="bold"
            fontFamily="sans-serif"
          >
            {rank}
          </text>
        ))}
      </svg>

      {/* Promotion picker overlay */}
      {promotionPending && (
        <PromotionPicker
          color={turnColor as 'w' | 'b'}
          square={promotionPending.to}
          boardFlipped={boardFlipped}
          onSelect={handlePromotion}
          onCancel={() => setPromotionPending(null)}
        />
      )}
    </div>
  );
}
