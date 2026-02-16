import { getPieceSvg } from './pieces';
import styles from './PromotionPicker.module.css';

interface PromotionPickerProps {
  color: 'w' | 'b';
  square: string;
  boardFlipped: boolean;
  onSelect: (piece: string) => void;
  onCancel: () => void;
}

const PROMOTIONS = ['q', 'r', 'b', 'n'] as const;

export function PromotionPicker({ color, square, boardFlipped, onSelect, onCancel }: PromotionPickerProps) {
  const file = square.charCodeAt(0) - 97;
  const col = boardFlipped ? 7 - file : file;

  // Position the picker at the promotion square column
  const leftPercent = col * 12.5;

  // White promotes on rank 8 (top if not flipped), black on rank 1 (bottom if not flipped)
  const fromTop = (color === 'w') !== boardFlipped;

  return (
    <div className={styles.overlay} onClick={onCancel}>
      <div
        className={styles.picker}
        style={{
          left: `${leftPercent}%`,
          width: '12.5%',
          [fromTop ? 'top' : 'bottom']: '0',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {PROMOTIONS.map((p) => {
          const piece = `${color}${p}`;
          const svgContent = getPieceSvg(piece);
          return (
            <button
              key={p}
              className={styles.option}
              onClick={() => onSelect(p)}
              title={p === 'q' ? 'Queen' : p === 'r' ? 'Rook' : p === 'b' ? 'Bishop' : 'Knight'}
            >
              <svg viewBox="0 0 45 45" className={styles.pieceSvg}>
                <g dangerouslySetInnerHTML={{ __html: svgContent }} />
              </svg>
            </button>
          );
        })}
      </div>
    </div>
  );
}
