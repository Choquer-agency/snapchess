import { FREE_DAILY_LIMIT } from '@snapchess/shared';
import { useUserStore } from '../../store/userStore';
import styles from './UsageIndicator.module.css';

export function UsageIndicator() {
  const remaining = useUserStore((s) => s.remainingAnalyses());
  const isPro = useUserStore((s) => s.isPro());

  if (isPro) {
    return (
      <div className={styles.container}>
        <span className={styles.proBadge}>PRO</span>
        <span className={styles.text}>Unlimited analyses</span>
      </div>
    );
  }

  const used = FREE_DAILY_LIMIT - remaining;

  return (
    <div className={styles.container}>
      <div className={styles.dots}>
        {Array.from({ length: FREE_DAILY_LIMIT }, (_, i) => (
          <span key={i} className={`${styles.dot} ${i < used ? styles.used : styles.available}`} />
        ))}
      </div>
      <span className={`${styles.text} ${remaining === 0 ? styles.exhausted : ''}`}>
        {remaining > 0
          ? `${remaining} of ${FREE_DAILY_LIMIT} analyses remaining today`
          : 'Daily limit reached'}
      </span>
    </div>
  );
}
