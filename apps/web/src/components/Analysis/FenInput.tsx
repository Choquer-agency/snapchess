import { useState } from 'react';
import { Chess } from 'chess.js';
import { useAnalysisStore } from '../../store/analysisStore';
import { useUserStore } from '../../store/userStore';
import styles from './FenInput.module.css';

/**
 * Normalize a potentially incomplete FEN string by filling in missing fields.
 * chess.js requires all 6 fields: pieces, turn, castling, en-passant, halfmove, fullmove.
 */
function normalizeFen(input: string): string {
  const parts = input.trim().split(/\s+/);
  if (parts.length >= 6) return parts.join(' ');

  // Fill in defaults for missing fields
  const defaults = [
    '', // [0] piece placement (always provided by user)
    'w', // [1] active color
    '-', // [2] castling availability
    '-', // [3] en passant target
    '0', // [4] halfmove clock
    '1', // [5] fullmove number
  ];

  for (let i = parts.length; i < 6; i++) {
    parts.push(defaults[i]);
  }

  return parts.join(' ');
}

interface FenInputProps {
  onLimitReached?: () => void;
}

export function FenInput({ onLimitReached }: FenInputProps) {
  const { fen, setFen, analyze, isAnalyzing, stopAnalysis, flipBoard } = useAnalysisStore();
  const canAnalyze = useUserStore((s) => s.canAnalyze());
  const [inputValue, setInputValue] = useState(fen);
  const [error, setError] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!canAnalyze) {
      onLimitReached?.();
      return;
    }

    const normalizedFen = normalizeFen(inputValue);

    try {
      new Chess(normalizedFen);
    } catch {
      setError('Invalid FEN string');
      return;
    }

    setFen(normalizedFen);
    analyze(normalizedFen);
  };

  return (
    <form onSubmit={handleSubmit} className={styles.form}>
      <div className={styles.inputRow}>
        <input
          type="text"
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          placeholder="Enter FEN string..."
          className={styles.input}
          spellCheck={false}
        />
        {isAnalyzing ? (
          <button type="button" onClick={stopAnalysis} className={styles.stopBtn}>
            Stop
          </button>
        ) : (
          <button type="submit" className={styles.analyzeBtn}>
            Analyze
          </button>
        )}
        <button type="button" onClick={flipBoard} className={styles.flipBtn} title="Flip board">
          ↻
        </button>
      </div>
      {error && <p className={styles.error}>{error}</p>}
    </form>
  );
}
