import { useMemo } from 'react';
import { Chess } from 'chess.js';
import { useAnalysisStore } from '../../store/analysisStore';
import styles from './MoveRecommendations.module.css';

function uciToSan(fen: string, uci: string): string {
  try {
    const chess = new Chess(fen);
    const from = uci.slice(0, 2);
    const to = uci.slice(2, 4);
    const promotion = uci.length > 4 ? uci[4] : undefined;

    const move = chess.move({ from, to, promotion });
    return move?.san ?? uci;
  } catch {
    return uci;
  }
}

function formatScore(score: number, mate?: number): string {
  if (mate !== undefined) {
    return `M${Math.abs(mate)}`;
  }
  const pawns = score / 100;
  return `${pawns >= 0 ? '+' : ''}${pawns.toFixed(1)}`;
}

export function MoveRecommendations() {
  const { topMoves, fen, isAnalyzing, currentDepth } = useAnalysisStore();

  const movesWithSan = useMemo(
    () =>
      topMoves.map((m) => ({
        ...m,
        san: uciToSan(fen, m.bestMove),
        pvSan: m.pv.slice(0, 5).reduce(
          (acc, uci) => {
            try {
              const san = uciToSan(acc.fen, uci);
              const chess = new Chess(acc.fen);
              chess.move({ from: uci.slice(0, 2), to: uci.slice(2, 4), promotion: uci[4] });
              return { fen: chess.fen(), moves: [...acc.moves, san] };
            } catch {
              return acc;
            }
          },
          { fen, moves: [] as string[] },
        ).moves,
      })),
    [topMoves, fen],
  );

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h3 className={styles.title}>Top Moves</h3>
        {isAnalyzing && (
          <span className={styles.depth}>Depth: {currentDepth}...</span>
        )}
        {!isAnalyzing && topMoves.length > 0 && (
          <span className={styles.depth}>Depth: {topMoves[0].depth}</span>
        )}
      </div>

      {movesWithSan.length === 0 && !isAnalyzing && (
        <p className={styles.empty}>Enter a FEN and click Analyze</p>
      )}

      {movesWithSan.map((move, i) => (
        <div key={i} className={`${styles.moveCard} ${i === 0 ? styles.bestMove : ''}`}>
          <div className={styles.moveHeader}>
            <span className={styles.rank}>#{move.multipv}</span>
            <span className={styles.san}>{move.san}</span>
            <span
              className={`${styles.score} ${
                move.score > 0
                  ? styles.scoreWhite
                  : move.score < 0
                    ? styles.scoreBlack
                    : ''
              }`}
            >
              {formatScore(move.score, move.mate)}
            </span>
          </div>
          <div className={styles.pv}>{move.pvSan.join(' ')}</div>
        </div>
      ))}
    </div>
  );
}
