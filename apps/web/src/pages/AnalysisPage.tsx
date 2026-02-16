import { useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useAnalysisStore } from '../store/analysisStore';
import { useHistoryStore } from '../store/historyStore';
import { useUserStore } from '../store/userStore';
import { ChessBoard } from '../components/Analysis/ChessBoard';
import { EvaluationBar } from '../components/Analysis/EvaluationBar';
import { MoveRecommendations } from '../components/Analysis/MoveRecommendations';
import { FenInput } from '../components/Analysis/FenInput';
import { ImageUploader } from '../components/CV/ImageUploader';
import { PositionConfirmation } from '../components/CV/PositionConfirmation';
import { ManualCorrection } from '../components/CV/ManualCorrection';
import { ShareToolbar } from '../components/Analysis/ShareToolbar';
import { MoveExplanation } from '../components/Analysis/MoveExplanation';
import { PositionEditor } from '../components/Analysis/PositionEditor';
import { UpgradePrompt } from '../components/Freemium/UpgradePrompt';
import styles from './AnalysisPage.module.css';

export function AnalysisPage() {
  const { step, fen, topMoves, reset } = useAnalysisStore();
  const { addAnalysis } = useHistoryStore();
  const { canAnalyze, incrementUsage } = useUserStore();
  const [searchParams] = useSearchParams();
  const [showUpgrade, setShowUpgrade] = useState(false);
  const savedRef = useRef(false);

  // Handle ?fen= query parameter for shared links
  useEffect(() => {
    const sharedFen = searchParams.get('fen');
    if (sharedFen) {
      useAnalysisStore.getState().setFen(sharedFen);
      useAnalysisStore.getState().analyze(sharedFen);
    }
  }, [searchParams]);

  // Auto-save to history and track usage when analysis completes
  useEffect(() => {
    if (step === 'results' && topMoves.length > 0 && !savedRef.current) {
      savedRef.current = true;
      incrementUsage();
      addAnalysis({
        fen,
        topMoves: topMoves.map((m, i) => ({
          rank: i + 1,
          san: m.bestMove,
          score: m.score,
          mate: m.mate,
        })),
      });
    }
    if (step === 'input') {
      savedRef.current = false;
    }
  }, [step, topMoves, fen, addAnalysis, incrementUsage]);

  // Check usage limit before analyzing
  const handleAnalyzeWithLimit = (analyzeFn: () => void) => {
    if (!canAnalyze()) {
      setShowUpgrade(true);
      return;
    }
    analyzeFn();
  };

  // Step: confirm — show detected position for review
  if (step === 'confirm') {
    return (
      <div className={styles.page}>
        <PositionConfirmation />
        <ManualCorrection />
        {showUpgrade && <UpgradePrompt onClose={() => setShowUpgrade(false)} />}
      </div>
    );
  }

  // Step: analyzing or results — show board + analysis panel
  return (
    <div className={styles.page}>
      <div className={styles.inputSection}>
        <FenInput onLimitReached={() => setShowUpgrade(true)} />
        <div className={styles.divider}>
          <span className={styles.dividerText}>or</span>
        </div>
        <ImageUploader />
      </div>

      {(step === 'analyzing' || step === 'results') && (
        <>
          <div className={styles.analysisLayout}>
            <div className={styles.boardSection}>
              <EvaluationBar />
              <ChessBoard />
            </div>
            <div className={styles.panelSection}>
              <MoveRecommendations />
              <MoveExplanation />
              {step === 'results' && <PositionEditor />}
              {step === 'results' && <ShareToolbar />}
            </div>
          </div>
          {step === 'results' && (
            <button className={styles.newAnalysis} onClick={reset}>
              New Analysis
            </button>
          )}
        </>
      )}

      {showUpgrade && <UpgradePrompt onClose={() => setShowUpgrade(false)} />}
    </div>
  );
}
