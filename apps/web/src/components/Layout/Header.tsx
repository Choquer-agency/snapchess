import { Link, useLocation } from 'react-router-dom';
import { UsageIndicator } from '../Freemium/UsageIndicator';
import styles from './Header.module.css';

export function Header() {
  const location = useLocation();

  return (
    <header className={styles.header}>
      <Link to="/" className={styles.logo}>
        <span className={styles.icon}>♟</span>
        <span className={styles.title}>SnapChess</span>
      </Link>
      <div className={styles.center}>
        <UsageIndicator />
      </div>
      <nav className={styles.nav}>
        <Link
          to="/"
          className={`${styles.navLink} ${location.pathname === '/' ? styles.active : ''}`}
        >
          Analyze
        </Link>
        <Link
          to="/history"
          className={`${styles.navLink} ${location.pathname === '/history' ? styles.active : ''}`}
        >
          History
        </Link>
        <Link
          to="/pricing"
          className={`${styles.navLink} ${styles.pricingLink} ${location.pathname === '/pricing' ? styles.active : ''}`}
        >
          Pro
        </Link>
      </nav>
    </header>
  );
}
