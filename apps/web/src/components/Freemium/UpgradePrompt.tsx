import { useNavigate } from 'react-router-dom';
import { SUBSCRIPTION_PRICES } from '@snapchess/shared';
import styles from './UpgradePrompt.module.css';

interface UpgradePromptProps {
  onClose: () => void;
}

export function UpgradePrompt({ onClose }: UpgradePromptProps) {
  const navigate = useNavigate();

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        <button className={styles.closeBtn} onClick={onClose}>
          x
        </button>

        <div className={styles.content}>
          <h2 className={styles.title}>You've used all 3 free analyses today</h2>
          <p className={styles.subtitle}>
            Upgrade to Pro for unlimited analyses and AI-powered move explanations.
          </p>

          <div className={styles.features}>
            <div className={styles.feature}>Unlimited daily analyses</div>
            <div className={styles.feature}>AI move explanations</div>
            <div className={styles.feature}>Priority processing</div>
            <div className={styles.feature}>Analysis history sync</div>
          </div>

          <div className={styles.pricing}>
            <button
              className={styles.priceBtn}
              onClick={() => {
                navigate('/pricing');
                onClose();
              }}
            >
              <span className={styles.priceAmount}>${SUBSCRIPTION_PRICES.PRO_MONTHLY}/mo</span>
              <span className={styles.priceLabel}>Monthly</span>
            </button>
            <button
              className={`${styles.priceBtn} ${styles.recommended}`}
              onClick={() => {
                navigate('/pricing');
                onClose();
              }}
            >
              <span className={styles.saveBadge}>Save 37%</span>
              <span className={styles.priceAmount}>${SUBSCRIPTION_PRICES.PRO_ANNUAL}/yr</span>
              <span className={styles.priceLabel}>Annual</span>
            </button>
          </div>

          <button className={styles.dismissBtn} onClick={onClose}>
            Maybe later
          </button>
        </div>
      </div>
    </div>
  );
}
