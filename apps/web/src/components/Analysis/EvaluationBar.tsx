import { useAnalysisStore } from '../../store/analysisStore';
import styles from './EvaluationBar.module.css';

export function EvaluationBar() {
  const { topMoves } = useAnalysisStore();

  const bestMove = topMoves[0];
  const score = bestMove?.score ?? 0;
  const mate = bestMove?.mate;

  // Convert centipawns to display percentage (white portion)
  // Sigmoid-like mapping: 0cp = 50%, ±500cp ≈ 95%
  const whitePercent = mate
    ? mate > 0
      ? 98
      : 2
    : Math.min(98, Math.max(2, 50 + (score / 10) * (50 / 50)));

  const displayScore = mate
    ? `M${Math.abs(mate)}`
    : `${score >= 0 ? '+' : ''}${(score / 100).toFixed(1)}`;

  return (
    <div className={styles.evalBar}>
      <div className={styles.bar}>
        <div className={styles.whiteSection} style={{ height: `${whitePercent}%` }}>
          {whitePercent > 50 && <span className={styles.scoreWhite}>{displayScore}</span>}
        </div>
        <div
          className={styles.blackSection}
          style={{ height: `${100 - whitePercent}%` }}
        >
          {whitePercent <= 50 && <span className={styles.scoreBlack}>{displayScore}</span>}
        </div>
      </div>
    </div>
  );
}
