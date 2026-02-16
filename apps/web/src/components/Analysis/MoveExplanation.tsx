import { useEffect, useState } from 'react';
import { useAnalysisStore } from '../../store/analysisStore';
import { useUserStore } from '../../store/userStore';
import { ExplanationTeaser } from './ExplanationTeaser';
import styles from './MoveExplanation.module.css';

interface ExplanationData {
  explanations: { move: string; explanation: string }[];
  opening?: string;
  tactics?: string[];
  cached: boolean;
}

export function MoveExplanation() {
  const { fen, topMoves, step } = useAnalysisStore();
  const isPro = useUserStore((s) => s.isPro());
  const accessToken = useUserStore((s) => s.accessToken);
  const [data, setData] = useState<ExplanationData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Lazy-load explanations when analysis completes
  useEffect(() => {
    if (step !== 'results' || topMoves.length === 0 || !isPro) {
      setData(null);
      return;
    }

    const fetchExplanations = async () => {
      setLoading(true);
      setError(null);

      try {
        const turn = fen.split(' ')[1] as 'w' | 'b';
        const moves = topMoves.map((m, i) => ({
          san: m.bestMove,
          uci: m.bestMove,
          score: m.score,
          mate: m.mate,
          pv: m.pv,
          rank: i + 1,
        }));

        const apiBase = import.meta.env.VITE_API_URL || '/api/v1';
        const res = await fetch(`${apiBase}/explain`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
          },
          body: JSON.stringify({ fen, turn, moves }),
        });

        const json = await res.json();

        if (json.success) {
          setData(json.data);
        } else {
          setError(json.error || 'Failed to load explanations');
        }
      } catch {
        setError('Could not connect to explanation service');
      } finally {
        setLoading(false);
      }
    };

    fetchExplanations();
  }, [step, topMoves, fen, isPro, accessToken]);

  // Free users see teaser
  if (!isPro) {
    return <ExplanationTeaser />;
  }

  if (step !== 'results') return null;

  if (loading) {
    return (
      <div className={styles.container}>
        <div className={styles.header}>
          <h3 className={styles.title}>AI Explanations</h3>
          <span className={styles.loading}>
            <span className={styles.spinner} />
            Generating...
          </span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className={styles.container}>
        <div className={styles.header}>
          <h3 className={styles.title}>AI Explanations</h3>
        </div>
        <p className={styles.error}>{error}</p>
      </div>
    );
  }

  if (!data) return null;

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h3 className={styles.title}>AI Explanations</h3>
        {data.cached && <span className={styles.cachedBadge}>Cached</span>}
      </div>

      {data.opening && (
        <div className={styles.opening}>
          <span className={styles.openingLabel}>Opening:</span> {data.opening}
        </div>
      )}

      {data.tactics && data.tactics.length > 0 && (
        <div className={styles.tactics}>
          {data.tactics.map((t) => (
            <span key={t} className={styles.tacticTag}>
              {t}
            </span>
          ))}
        </div>
      )}

      <div className={styles.explanations}>
        {data.explanations.map((e, i) => (
          <div key={i} className={styles.explanationCard}>
            <span className={styles.moveName}>{e.move}</span>
            <p className={styles.explanationText}>{e.explanation}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
