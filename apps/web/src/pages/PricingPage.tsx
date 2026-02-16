import { SUBSCRIPTION_PRICES, FREE_DAILY_LIMIT } from '@snapchess/shared';
import { useUserStore } from '../store/userStore';
import styles from './PricingPage.module.css';

const FREE_FEATURES = [
  `${FREE_DAILY_LIMIT} analyses per day`,
  'Screenshot position detection',
  'Top 3 move recommendations',
  'Evaluation bar',
  'Analysis history (local)',
];

const PRO_FEATURES = [
  'Unlimited analyses',
  'Screenshot position detection',
  'Top 3 move recommendations',
  'Evaluation bar',
  'Analysis history (synced)',
  'AI move explanations',
  'Priority CV processing',
  'Export & share features',
];

export function PricingPage() {
  const isPro = useUserStore((s) => s.isPro());

  const handleCheckout = async (interval: 'monthly' | 'annual') => {
    // In production, this would call the backend to create a Stripe Checkout session
    // For now, show alert since Stripe keys aren't configured
    alert(
      `Stripe checkout for ${interval} plan would open here.\n` +
        'Configure STRIPE_SECRET_KEY in .env to enable payments.',
    );
  };

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <h1 className={styles.title}>Choose Your Plan</h1>
        <p className={styles.subtitle}>
          Unlock unlimited analyses and AI-powered explanations
        </p>
      </div>

      <div className={styles.plans}>
        {/* Free Plan */}
        <div className={styles.plan}>
          <div className={styles.planHeader}>
            <h2 className={styles.planName}>Free</h2>
            <div className={styles.planPrice}>
              <span className={styles.amount}>$0</span>
              <span className={styles.period}>forever</span>
            </div>
          </div>
          <ul className={styles.featureList}>
            {FREE_FEATURES.map((f) => (
              <li key={f} className={styles.featureItem}>{f}</li>
            ))}
          </ul>
          <button className={styles.planBtn} disabled>
            Current Plan
          </button>
        </div>

        {/* Pro Monthly */}
        <div className={`${styles.plan} ${styles.featured}`}>
          <div className={styles.popularBadge}>Most Popular</div>
          <div className={styles.planHeader}>
            <h2 className={styles.planName}>Pro</h2>
            <div className={styles.planPrice}>
              <span className={styles.amount}>${SUBSCRIPTION_PRICES.PRO_MONTHLY}</span>
              <span className={styles.period}>/month</span>
            </div>
          </div>
          <ul className={styles.featureList}>
            {PRO_FEATURES.map((f) => (
              <li key={f} className={styles.featureItem}>{f}</li>
            ))}
          </ul>
          <button
            className={`${styles.planBtn} ${styles.primaryBtn}`}
            onClick={() => handleCheckout('monthly')}
            disabled={isPro}
          >
            {isPro ? 'Current Plan' : 'Get Pro Monthly'}
          </button>
        </div>

        {/* Pro Annual */}
        <div className={styles.plan}>
          <div className={styles.planHeader}>
            <h2 className={styles.planName}>Pro Annual</h2>
            <div className={styles.planPrice}>
              <span className={styles.amount}>${SUBSCRIPTION_PRICES.PRO_ANNUAL}</span>
              <span className={styles.period}>/year</span>
            </div>
            <span className={styles.savings}>Save 37% vs monthly</span>
          </div>
          <ul className={styles.featureList}>
            {PRO_FEATURES.map((f) => (
              <li key={f} className={styles.featureItem}>{f}</li>
            ))}
          </ul>
          <button
            className={`${styles.planBtn} ${styles.secondaryBtn}`}
            onClick={() => handleCheckout('annual')}
            disabled={isPro}
          >
            {isPro ? 'Current Plan' : 'Get Pro Annual'}
          </button>
        </div>
      </div>
    </div>
  );
}
