import { Link } from 'react-router-dom';
import { useAnalysisStore } from '../../store/analysisStore';
import styles from './ExplanationTeaser.module.css';

export function ExplanationTeaser() {
  const { step, topMoves } = useAnalysisStore();

  if (step !== 'results' || topMoves.length === 0) return null;

  return (
    <div className={styles.container}>
      <div className={styles.blurred}>
        <div className={styles.fakeLine}>
          <span className={styles.fakeMove}>Nf3</span>
          <span className={styles.fakeText}>
            This knight move develops a piece while controlling the center and preparing to castle
            kingside...
          </span>
        </div>
        <div className={styles.fakeLine}>
          <span className={styles.fakeMove}>d4</span>
          <span className={styles.fakeText}>
            Occupying the center with a pawn creates tension and opens lines for the dark-squared
            bishop...
          </span>
        </div>
      </div>

      <div className={styles.overlay}>
        <p className={styles.cta}>
          Understand <strong>why</strong> each move is best
        </p>
        <Link to="/pricing" className={styles.upgradeBtn}>
          Upgrade to Pro
        </Link>
        <p className={styles.price}>Starting at $3.99/mo</p>
      </div>
    </div>
  );
}
