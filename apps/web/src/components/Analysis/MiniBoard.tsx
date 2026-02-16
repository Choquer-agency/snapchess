import { useMemo } from 'react';
import { Chess } from 'chess.js';
import { getPieceSvg } from './pieces';

interface MiniBoardProps {
  fen: string;
  size?: number;
}

const FILES = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'];
const RANKS = [8, 7, 6, 5, 4, 3, 2, 1];

export function MiniBoard({ fen, size = 120 }: MiniBoardProps) {
  const squares = useMemo(() => {
    const chess = new Chess();
    try {
      chess.load(fen);
    } catch {
      return [];
    }

    const result: { piece: string | null; isLight: boolean; row: number; col: number }[] = [];
    RANKS.forEach((rank, row) => {
      FILES.forEach((file, col) => {
        const square = `${file}${rank}`;
        const piece = chess.get(square as any);
        const isLight = (rank + file.charCodeAt(0)) % 2 === 1;
        result.push({
          piece: piece ? `${piece.color}${piece.type}` : null,
          isLight,
          row,
          col,
        });
      });
    });
    return result;
  }, [fen]);

  return (
    <svg viewBox="0 0 100 100" width={size} height={size} style={{ borderRadius: 4 }}>
      {squares.map((sq, i) => (
        <rect
          key={i}
          x={sq.col * 12.5}
          y={sq.row * 12.5}
          width="12.5"
          height="12.5"
          fill={sq.isLight ? '#f0d9b5' : '#b58863'}
        />
      ))}
      {squares.map((sq, i) => {
        if (!sq.piece) return null;
        const svgContent = getPieceSvg(sq.piece);
        if (!svgContent) return null;
        return (
          <g
            key={`p-${i}`}
            transform={`translate(${sq.col * 12.5 + 0.5}, ${sq.row * 12.5 + 0.5}) scale(${11.5 / 45})`}
            dangerouslySetInnerHTML={{ __html: svgContent }}
          />
        );
      })}
    </svg>
  );
}
