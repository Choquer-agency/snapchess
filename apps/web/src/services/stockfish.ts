import { MULTI_PV, DEFAULT_ENGINE_DEPTH } from '@snapchess/shared';

export interface StockfishMove {
  multipv: number;
  depth: number;
  score: number; // centipawns from white's POV
  mate?: number;
  pv: string[]; // UCI moves
  bestMove: string; // UCI e.g. "e2e4"
}

type AnalysisCallback = (moves: StockfishMove[]) => void;

export class StockfishService {
  private worker: Worker | null = null;
  private isReady = false;
  private pendingResolve: ((moves: StockfishMove[]) => void) | null = null;
  private currentMoves: Map<number, StockfishMove> = new Map();
  private onProgress: AnalysisCallback | null = null;

  async init(): Promise<void> {
    if (this.worker) return;

    return new Promise((resolve, reject) => {
      try {
        // Stockfish.js WASM worker
        this.worker = new Worker('/stockfish.js');

        this.worker.onmessage = (e: MessageEvent) => {
          this.handleMessage(e.data);
        };

        this.worker.onerror = (e) => {
          console.error('Stockfish worker error:', e);
          reject(e);
        };

        this.send('uci');

        // Wait for uciok
        const checkReady = () => {
          if (this.isReady) {
            resolve();
          } else {
            setTimeout(checkReady, 50);
          }
        };
        setTimeout(checkReady, 50);

        // Timeout after 10s
        setTimeout(() => {
          if (!this.isReady) reject(new Error('Stockfish init timeout'));
        }, 10000);
      } catch (e) {
        reject(e);
      }
    });
  }

  private send(cmd: string) {
    this.worker?.postMessage(cmd);
  }

  private handleMessage(line: string) {
    if (line === 'uciok') {
      this.send('setoption name MultiPV value ' + MULTI_PV);
      this.send('isready');
    }

    if (line === 'readyok') {
      this.isReady = true;
    }

    // Parse "info" lines for analysis data
    if (line.startsWith('info') && line.includes('multipv')) {
      const move = this.parseInfoLine(line);
      if (move) {
        this.currentMoves.set(move.multipv, move);

        // Call progress callback with current state
        if (this.onProgress) {
          const moves = Array.from(this.currentMoves.values()).sort(
            (a, b) => a.multipv - b.multipv,
          );
          this.onProgress(moves);
        }
      }
    }

    // "bestmove" signals analysis complete
    if (line.startsWith('bestmove')) {
      if (this.pendingResolve) {
        const moves = Array.from(this.currentMoves.values()).sort(
          (a, b) => a.multipv - b.multipv,
        );
        this.pendingResolve(moves);
        this.pendingResolve = null;
      }
    }
  }

  private parseInfoLine(line: string): StockfishMove | null {
    const tokens = line.split(' ');

    const getVal = (key: string): string | undefined => {
      const idx = tokens.indexOf(key);
      return idx !== -1 ? tokens[idx + 1] : undefined;
    };

    const depthStr = getVal('depth');
    const multipvStr = getVal('multipv');
    const pvIdx = tokens.indexOf('pv');

    if (!depthStr || !multipvStr || pvIdx === -1) return null;

    const depth = parseInt(depthStr);
    const multipv = parseInt(multipvStr);
    const pv = tokens.slice(pvIdx + 1);

    // Parse score
    const scoreIdx = tokens.indexOf('score');
    if (scoreIdx === -1) return null;

    let score = 0;
    let mate: number | undefined;

    if (tokens[scoreIdx + 1] === 'cp') {
      score = parseInt(tokens[scoreIdx + 2]);
    } else if (tokens[scoreIdx + 1] === 'mate') {
      mate = parseInt(tokens[scoreIdx + 2]);
      score = mate > 0 ? 100000 - mate : -100000 - mate;
    }

    return {
      multipv,
      depth,
      score,
      mate,
      pv,
      bestMove: pv[0],
    };
  }

  async analyze(
    fen: string,
    depth = DEFAULT_ENGINE_DEPTH,
    progressCb?: AnalysisCallback,
  ): Promise<StockfishMove[]> {
    if (!this.isReady) {
      await this.init();
    }

    this.currentMoves.clear();
    this.onProgress = progressCb || null;

    return new Promise((resolve) => {
      this.pendingResolve = resolve;
      this.send('stop');
      this.send('position fen ' + fen);
      this.send('go depth ' + depth);
    });
  }

  stop() {
    this.send('stop');
    this.pendingResolve = null;
  }

  destroy() {
    this.stop();
    this.worker?.terminate();
    this.worker = null;
    this.isReady = false;
  }
}

// Singleton instance
export const stockfish = new StockfishService();
