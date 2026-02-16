import { useHistoryStore, SavedAnalysis } from '../store/historyStore';
import { useAnalysisStore } from '../store/analysisStore';
import { useNavigate } from 'react-router-dom';
import styles from './HistoryPage.module.css';
import { MiniBoard } from '../components/Analysis/MiniBoard';

function formatDate(ts: number): string {
  const d = new Date(ts);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffMin = Math.floor(diffMs / 60000);

  if (diffMin < 1) return 'Just now';
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;
  const diffDay = Math.floor(diffHr / 24);
  if (diffDay < 7) return `${diffDay}d ago`;

  return d.toLocaleDateString();
}

function formatScore(score: number, mate?: number): string {
  if (mate !== undefined) return `M${Math.abs(mate)}`;
  const pawns = score / 100;
  return `${pawns >= 0 ? '+' : ''}${pawns.toFixed(1)}`;
}

export function HistoryPage() {
  const { analyses, removeAnalysis, clearHistory } = useHistoryStore();
  const { setFen, analyze } = useAnalysisStore();
  const navigate = useNavigate();

  const handleReanalyze = (analysis: SavedAnalysis) => {
    setFen(analysis.fen);
    analyze(analysis.fen);
    navigate('/');
  };

  if (analyses.length === 0) {
    return (
      <div className={styles.page}>
        <h1 className={styles.title}>Analysis History</h1>
        <div className={styles.empty}>
          <p>No analyses saved yet.</p>
          <p className={styles.hint}>Your analyses will appear here after you run them.</p>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <h1 className={styles.title}>Analysis History</h1>
        <button className={styles.clearBtn} onClick={clearHistory}>
          Clear All
        </button>
      </div>

      <div className={styles.grid}>
        {analyses.map((analysis) => (
          <div key={analysis.id} className={styles.card} onClick={() => handleReanalyze(analysis)}>
            <div className={styles.cardBoard}>
              <MiniBoard fen={analysis.fen} size={120} />
            </div>
            <div className={styles.cardInfo}>
              <div className={styles.cardMoves}>
                {analysis.topMoves.slice(0, 3).map((m, i) => (
                  <span key={i} className={styles.movePill}>
                    {m.san} {formatScore(m.score, m.mate)}
                  </span>
                ))}
              </div>
              <div className={styles.cardMeta}>
                <span className={styles.time}>{formatDate(analysis.timestamp)}</span>
                <button
                  className={styles.deleteBtn}
                  onClick={(e) => {
                    e.stopPropagation();
                    removeAnalysis(analysis.id);
                  }}
                >
                  Remove
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
