import { useAnalysisStore, type MoveEntry } from '../../store/analysisStore';
import { STARTING_FEN } from '@snapchess/shared';
import styles from './PositionEditor.module.css';

const PIECES = [
  { id: 'wk', label: '\u2654' },
  { id: 'wq', label: '\u2655' },
  { id: 'wr', label: '\u2656' },
  { id: 'wb', label: '\u2657' },
  { id: 'wn', label: '\u2658' },
  { id: 'wp', label: '\u2659' },
  { id: 'bk', label: '\u265A' },
  { id: 'bq', label: '\u265B' },
  { id: 'br', label: '\u265C' },
  { id: 'bb', label: '\u265D' },
  { id: 'bn', label: '\u265E' },
  { id: 'bp', label: '\u265F' },
];

function formatMoveList(moves: MoveEntry[]): { moveNumber: number; white: string; black?: string }[] {
  const pairs: { moveNumber: number; white: string; black?: string }[] = [];
  for (let i = 0; i < moves.length; i += 2) {
    pairs.push({
      moveNumber: Math.floor(i / 2) + 1,
      white: moves[i].san,
      black: moves[i + 1]?.san,
    });
  }
  return pairs;
}

export function PositionEditor() {
  const {
    boardMode, setBoardMode,
    moveHistory, currentMoveIndex, fenHistory,
    goToMove, undoMove, reanalyze,
    fen, setFullFen,
    editorSelectedPiece, editorPlaceMode,
    setEditorPiece, setEditorPlaceMode,
  } = useAnalysisStore();

  const isPlayMode = boardMode === 'play';
  const isEditMode = boardMode === 'edit';

  // Parse FEN for side-to-move and castling
  const fenParts = fen.split(' ');
  const sideToMove = fenParts[1] || 'w';
  const castling = fenParts[2] || '-';

  const toggleCastling = (flag: string) => {
    let current = castling === '-' ? '' : castling;
    if (current.includes(flag)) {
      current = current.replace(flag, '');
    } else {
      current += flag;
      // Re-sort to standard order: KQkq
      current = ['K', 'Q', 'k', 'q'].filter((f) => current.includes(f)).join('');
    }
    const parts = fen.split(' ');
    parts[2] = current || '-';
    setFullFen(parts.join(' '));
  };

  const setSideToMove = (side: string) => {
    const parts = fen.split(' ');
    parts[1] = side;
    setFullFen(parts.join(' '));
  };

  const clearBoard = () => {
    setFullFen('8/8/8/8/8/8/8/8 w - - 0 1');
  };

  const setStartingPosition = () => {
    setFullFen(STARTING_FEN);
  };

  const handleAnalyzePosition = () => {
    setBoardMode('play');
    reanalyze();
  };

  const movePairs = formatMoveList(moveHistory);
  const hasMoves = moveHistory.length > 0;
  const canGoBack = currentMoveIndex > 0;
  const canGoForward = currentMoveIndex < fenHistory.length - 1;

  const resetMoves = () => {
    goToMove(0);
  };

  return (
    <div className={styles.container}>
      {/* Mode toggle */}
      <div className={styles.modeToggle}>
        <button
          className={`${styles.modeBtn} ${isPlayMode ? styles.active : ''}`}
          onClick={() => setBoardMode('play')}
        >
          Play Moves
        </button>
        <button
          className={`${styles.modeBtn} ${isEditMode ? styles.active : ''}`}
          onClick={() => setBoardMode('edit')}
        >
          Edit Position
        </button>
      </div>

      {isPlayMode && (
        <div className={styles.playControls}>
          {/* Move history */}
          {hasMoves && (
            <div className={styles.moveList}>
              {movePairs.map((pair) => (
                <div key={pair.moveNumber} className={styles.movePair}>
                  <span className={styles.moveNumber}>{pair.moveNumber}.</span>
                  <button
                    className={`${styles.moveBtn} ${currentMoveIndex === (pair.moveNumber - 1) * 2 + 1 ? styles.activeMove : ''}`}
                    onClick={() => goToMove((pair.moveNumber - 1) * 2 + 1)}
                  >
                    {pair.white}
                  </button>
                  {pair.black && (
                    <button
                      className={`${styles.moveBtn} ${currentMoveIndex === (pair.moveNumber - 1) * 2 + 2 ? styles.activeMove : ''}`}
                      onClick={() => goToMove((pair.moveNumber - 1) * 2 + 2)}
                    >
                      {pair.black}
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* Navigation buttons */}
          <div className={styles.navButtons}>
            <button
              className={styles.navBtn}
              onClick={() => goToMove(0)}
              disabled={!canGoBack}
              title="Go to start"
            >
              &#x23EE;
            </button>
            <button
              className={styles.navBtn}
              onClick={undoMove}
              disabled={!canGoBack}
              title="Previous move"
            >
              &#x25C0;
            </button>
            <button
              className={styles.navBtn}
              onClick={() => goToMove(currentMoveIndex + 1)}
              disabled={!canGoForward}
              title="Next move"
            >
              &#x25B6;
            </button>
            <button
              className={styles.navBtn}
              onClick={() => goToMove(fenHistory.length - 1)}
              disabled={!canGoForward}
              title="Go to end"
            >
              &#x23ED;
            </button>
          </div>

          {/* Action buttons */}
          <div className={styles.actionButtons}>
            {hasMoves && (
              <button className={styles.actionBtn} onClick={resetMoves}>
                Reset Moves
              </button>
            )}
            <button className={styles.actionBtnPrimary} onClick={reanalyze}>
              Re-analyze
            </button>
          </div>
        </div>
      )}

      {isEditMode && (
        <div className={styles.editControls}>
          {/* Place/Remove toggle */}
          <div className={styles.placeModeToggle}>
            <button
              className={`${styles.modeBtn} ${editorPlaceMode === 'place' ? styles.active : ''}`}
              onClick={() => setEditorPlaceMode('place')}
            >
              Place
            </button>
            <button
              className={`${styles.modeBtn} ${editorPlaceMode === 'remove' ? styles.active : ''}`}
              onClick={() => setEditorPlaceMode('remove')}
            >
              Remove
            </button>
          </div>

          {/* Piece palette */}
          <div className={styles.palette}>
            {PIECES.map((piece) => (
              <button
                key={piece.id}
                className={`${styles.pieceBtn} ${editorSelectedPiece === piece.id ? styles.selectedPiece : ''}`}
                onClick={() => setEditorPiece(piece.id)}
              >
                {piece.label}
              </button>
            ))}
          </div>

          {/* Side to move */}
          <div className={styles.optionRow}>
            <span className={styles.label}>Side to move:</span>
            <div className={styles.radioGroup}>
              <label className={styles.radioLabel}>
                <input
                  type="radio"
                  checked={sideToMove === 'w'}
                  onChange={() => setSideToMove('w')}
                />
                White
              </label>
              <label className={styles.radioLabel}>
                <input
                  type="radio"
                  checked={sideToMove === 'b'}
                  onChange={() => setSideToMove('b')}
                />
                Black
              </label>
            </div>
          </div>

          {/* Castling rights */}
          <div className={styles.optionRow}>
            <span className={styles.label}>Castling:</span>
            <div className={styles.checkboxGroup}>
              {[
                { flag: 'K', label: 'K' },
                { flag: 'Q', label: 'Q' },
                { flag: 'k', label: 'k' },
                { flag: 'q', label: 'q' },
              ].map(({ flag, label }) => (
                <label key={flag} className={styles.checkboxLabel}>
                  <input
                    type="checkbox"
                    checked={castling.includes(flag)}
                    onChange={() => toggleCastling(flag)}
                  />
                  {label}
                </label>
              ))}
            </div>
          </div>

          {/* Quick buttons */}
          <div className={styles.actionButtons}>
            <button className={styles.actionBtn} onClick={clearBoard}>
              Clear Board
            </button>
            <button className={styles.actionBtn} onClick={setStartingPosition}>
              Starting Position
            </button>
          </div>

          <button className={styles.analyzeBtn} onClick={handleAnalyzePosition}>
            Analyze This Position
          </button>
        </div>
      )}
    </div>
  );
}
