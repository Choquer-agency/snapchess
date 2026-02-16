import { useState } from 'react';
import { useAnalysisStore } from '../../store/analysisStore';
import styles from './ManualCorrection.module.css';

const PIECES = [
  { id: 'wk', label: '\u2654', name: 'White King' },
  { id: 'wq', label: '\u2655', name: 'White Queen' },
  { id: 'wr', label: '\u2656', name: 'White Rook' },
  { id: 'wb', label: '\u2657', name: 'White Bishop' },
  { id: 'wn', label: '\u2658', name: 'White Knight' },
  { id: 'wp', label: '\u2659', name: 'White Pawn' },
  { id: 'bk', label: '\u265A', name: 'Black King' },
  { id: 'bq', label: '\u265B', name: 'Black Queen' },
  { id: 'br', label: '\u265C', name: 'Black Rook' },
  { id: 'bb', label: '\u265D', name: 'Black Bishop' },
  { id: 'bn', label: '\u265E', name: 'Black Knight' },
  { id: 'bp', label: '\u265F', name: 'Black Pawn' },
];

const FILES = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'];
const RANKS = [8, 7, 6, 5, 4, 3, 2, 1];

export function ManualCorrection() {
  const { detection, updateSquare, fen, confirmPosition, reset } = useAnalysisStore();
  const [selectedPiece, setSelectedPiece] = useState<string | null>(null);
  const [mode, setMode] = useState<'place' | 'remove'>('place');

  if (!detection) return null;

  const handleSquareClick = (square: string) => {
    if (mode === 'remove') {
      updateSquare(square, null);
    } else if (selectedPiece) {
      updateSquare(square, selectedPiece);
    }
  };

  const lowConfSet = new Set(detection.lowConfidenceSquares);

  return (
    <div className={styles.container}>
      <h3 className={styles.title}>Edit Position</h3>
      <p className={styles.hint}>Select a piece, then click squares to place it. Highlighted squares have low confidence.</p>

      <div className={styles.toolbar}>
        <div className={styles.modeButtons}>
          <button
            className={`${styles.modeBtn} ${mode === 'place' ? styles.active : ''}`}
            onClick={() => setMode('place')}
          >
            Place
          </button>
          <button
            className={`${styles.modeBtn} ${mode === 'remove' ? styles.active : ''}`}
            onClick={() => {
              setMode('remove');
              setSelectedPiece(null);
            }}
          >
            Remove
          </button>
        </div>

        <div className={styles.palette}>
          {PIECES.map((piece) => (
            <button
              key={piece.id}
              className={`${styles.pieceBtn} ${selectedPiece === piece.id ? styles.selected : ''}`}
              onClick={() => {
                setSelectedPiece(piece.id);
                setMode('place');
              }}
              title={piece.name}
            >
              {piece.label}
            </button>
          ))}
        </div>
      </div>

      <div className={styles.editBoard}>
        {RANKS.map((rank) =>
          FILES.map((file) => {
            const square = `${file}${rank}`;
            const isLight = (rank + file.charCodeAt(0)) % 2 === 1;
            const isLowConf = lowConfSet.has(square);
            const piece = getPieceAtSquare(fen, square);

            return (
              <div
                key={square}
                className={`${styles.square} ${isLight ? styles.light : styles.dark} ${isLowConf ? styles.lowConf : ''}`}
                onClick={() => handleSquareClick(square)}
                title={square}
              >
                {piece && <span className={styles.piece}>{piece}</span>}
              </div>
            );
          }),
        )}
      </div>

      <div className={styles.actions}>
        <button className={styles.confirmBtn} onClick={() => confirmPosition(fen)}>
          Confirm & Analyze
        </button>
        <button className={styles.cancelBtn} onClick={reset}>
          Cancel
        </button>
      </div>
    </div>
  );
}

function getPieceAtSquare(fen: string, square: string): string | null {
  const PIECE_UNICODE: Record<string, string> = {
    K: '\u2654', Q: '\u2655', R: '\u2656', B: '\u2657', N: '\u2658', P: '\u2659',
    k: '\u265A', q: '\u265B', r: '\u265C', b: '\u265D', n: '\u265E', p: '\u265F',
  };

  const file = square.charCodeAt(0) - 97;
  const rank = parseInt(square[1]) - 1;
  const fenRank = 7 - rank;

  const rows = fen.split(' ')[0].split('/');
  if (fenRank < 0 || fenRank >= rows.length) return null;

  let col = 0;
  for (const ch of rows[fenRank]) {
    if (ch >= '1' && ch <= '8') {
      col += parseInt(ch);
    } else {
      if (col === file) return PIECE_UNICODE[ch] || null;
      col++;
    }
  }
  return null;
}
