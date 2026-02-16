import { useState } from 'react';
import { Chess } from 'chess.js';
import { useAnalysisStore } from '../../store/analysisStore';
import styles from './ShareToolbar.module.css';

export function ShareToolbar() {
  const { fen, topMoves, moveHistory, startingFen } = useAnalysisStore();
  const [copied, setCopied] = useState<string | null>(null);

  const copyToClipboard = async (text: string, label: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(label);
      setTimeout(() => setCopied(null), 2000);
    } catch {
      // Fallback
      const ta = document.createElement('textarea');
      ta.value = text;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
      setCopied(label);
      setTimeout(() => setCopied(null), 2000);
    }
  };

  const handleCopyFen = () => copyToClipboard(fen, 'FEN');

  const handleCopyLink = () => {
    const url = `${window.location.origin}/?fen=${encodeURIComponent(fen)}`;
    copyToClipboard(url, 'Link');
  };

  const handleExportPng = () => {
    const boardSvg = document.querySelector('svg[viewBox="0 0 100 100"]');
    if (!boardSvg) return;

    const svgData = new XMLSerializer().serializeToString(boardSvg);
    const canvas = document.createElement('canvas');
    canvas.width = 800;
    canvas.height = 800;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const img = new Image();
    img.onload = () => {
      ctx.drawImage(img, 0, 0, 800, 800);
      const link = document.createElement('a');
      link.download = `snapchess-${Date.now()}.png`;
      link.href = canvas.toDataURL('image/png');
      link.click();
    };
    img.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svgData)}`;
  };

  const handleCopyAnalysis = () => {
    const lines = [`Position: ${fen}`, ''];
    topMoves.forEach((m, i) => {
      const score =
        m.mate !== undefined
          ? `M${Math.abs(m.mate)}`
          : `${m.score >= 0 ? '+' : ''}${(m.score / 100).toFixed(1)}`;
      lines.push(`${i + 1}. ${m.bestMove} (${score}) — depth ${m.depth}`);
    });
    lines.push('', 'Analyzed with SnapChess');
    copyToClipboard(lines.join('\n'), 'Analysis');
  };

  const handleExportPgn = () => {
    if (moveHistory.length === 0) return;

    const chess = new Chess(startingFen);

    // Replay all moves
    for (const move of moveHistory) {
      chess.move({ from: move.from, to: move.to, promotion: move.promotion } as any);
    }

    // Build PGN headers
    const isNonStandard = startingFen !== 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
    const date = new Date().toISOString().split('T')[0].replace(/-/g, '.');
    let pgn = '';
    pgn += `[Event "SnapChess Analysis"]\n`;
    pgn += `[Site "SnapChess"]\n`;
    pgn += `[Date "${date}"]\n`;
    if (isNonStandard) {
      pgn += `[SetUp "1"]\n`;
      pgn += `[FEN "${startingFen}"]\n`;
    }
    pgn += '\n';
    pgn += chess.pgn();

    copyToClipboard(pgn, 'PGN');
  };

  return (
    <div className={styles.toolbar}>
      <button className={styles.btn} onClick={handleCopyFen} title="Copy FEN">
        {copied === 'FEN' ? 'Copied!' : 'Copy FEN'}
      </button>
      <button className={styles.btn} onClick={handleCopyLink} title="Copy shareable link">
        {copied === 'Link' ? 'Copied!' : 'Share Link'}
      </button>
      <button className={styles.btn} onClick={handleExportPng} title="Download board as PNG">
        Export PNG
      </button>
      <button className={styles.btn} onClick={handleCopyAnalysis} title="Copy analysis text">
        {copied === 'Analysis' ? 'Copied!' : 'Copy Analysis'}
      </button>
      {moveHistory.length > 0 && (
        <button className={styles.btn} onClick={handleExportPgn} title="Copy PGN notation">
          {copied === 'PGN' ? 'Copied!' : 'Export PGN'}
        </button>
      )}
    </div>
  );
}
