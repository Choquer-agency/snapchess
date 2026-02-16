import { useAnalysisStore } from '../../store/analysisStore';
import { ChessBoard } from '../Analysis/ChessBoard';
import styles from './PositionConfirmation.module.css';

export function PositionConfirmation() {
  const { fen, detection, uploadedImageUrl, confirmPosition, reset } = useAnalysisStore();

  if (!detection) return null;

  const confidencePercent = Math.round(detection.confidence * 100);
  const hasWarnings = detection.lowConfidenceSquares.length > 0;
  const hasErrors = detection.validationErrors.length > 0;

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h2 className={styles.title}>Detected Position</h2>
        <div className={styles.confidence}>
          <span
            className={`${styles.badge} ${
              confidencePercent >= 90
                ? styles.high
                : confidencePercent >= 70
                  ? styles.medium
                  : styles.low
            }`}
          >
            {confidencePercent}% confidence
          </span>
        </div>
      </div>

      <div className={styles.layout}>
        <div className={styles.boardSide}>
          {uploadedImageUrl && (
            <div className={styles.uploadedImage}>
              <p className={styles.label}>Uploaded</p>
              <img src={uploadedImageUrl} alt="Uploaded screenshot" className={styles.screenshot} />
            </div>
          )}
          <div className={styles.detectedBoard}>
            <p className={styles.label}>Detected</p>
            <ChessBoard />
          </div>
        </div>

        <div className={styles.infoSide}>
          <div className={styles.fenDisplay}>
            <label className={styles.label}>FEN</label>
            <code className={styles.fenCode}>{fen}</code>
          </div>

          {hasWarnings && (
            <div className={styles.warnings}>
              <p className={styles.warningTitle}>Low confidence squares:</p>
              <div className={styles.squareList}>
                {detection.lowConfidenceSquares.map((sq) => (
                  <span key={sq} className={styles.squareTag}>
                    {sq} ({Math.round((detection.squareConfidences[sq] || 0) * 100)}%)
                  </span>
                ))}
              </div>
              <p className={styles.warningHint}>
                Click "Edit Position" to manually correct these squares.
              </p>
            </div>
          )}

          {hasErrors && (
            <div className={styles.errors}>
              <p className={styles.errorTitle}>Validation issues:</p>
              <ul className={styles.errorList}>
                {detection.validationErrors.map((err, i) => (
                  <li key={i}>{err}</li>
                ))}
              </ul>
            </div>
          )}

          <div className={styles.turnSelector}>
            <label className={styles.label}>Turn to move</label>
            <div className={styles.turnButtons}>
              <button
                className={`${styles.turnBtn} ${fen.includes(' w ') ? styles.active : ''}`}
                onClick={() => {
                  const newFen = fen.replace(/ [wb] /, ' w ');
                  useAnalysisStore.getState().setFen(newFen);
                }}
              >
                White
              </button>
              <button
                className={`${styles.turnBtn} ${fen.includes(' b ') ? styles.active : ''}`}
                onClick={() => {
                  const newFen = fen.replace(/ [wb] /, ' b ');
                  useAnalysisStore.getState().setFen(newFen);
                }}
              >
                Black
              </button>
            </div>
          </div>

          <div className={styles.actions}>
            <button className={styles.confirmBtn} onClick={() => confirmPosition(fen)}>
              Looks correct — Analyze
            </button>
            <button className={styles.editBtn} onClick={() => {
              // Stay on confirm step but let user interact with board
              // ManualCorrection component handles this
            }}>
              Edit Position
            </button>
            <button className={styles.retryBtn} onClick={reset}>
              Try another image
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
