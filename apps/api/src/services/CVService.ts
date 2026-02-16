import { env } from '../config/env';

export interface CVDetectionResult {
  fen: string;
  confidence: number;
  squareConfidences: Record<string, number>;
  lowConfidenceSquares: string[];
  needsReview: boolean;
  validationErrors: string[];
  processingTimeMs: number;
}

export class CVService {
  private static baseUrl = env.CV_SERVICE_URL;

  static async detectPosition(imageBuffer: Buffer): Promise<CVDetectionResult> {
    const formData = new FormData();
    const blob = new Blob([new Uint8Array(imageBuffer)], { type: 'image/png' });
    formData.append('image', blob, 'board.png');

    const response = await fetch(`${this.baseUrl}/detect`, {
      method: 'POST',
      body: formData,
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ detail: 'CV service error' }));
      throw new Error(error.detail || `CV service returned ${response.status}`);
    }

    const data = await response.json();

    return {
      fen: data.fen,
      confidence: data.confidence,
      squareConfidences: data.square_confidences,
      lowConfidenceSquares: data.low_confidence_squares,
      needsReview: data.needs_review,
      validationErrors: data.validation_errors || [],
      processingTimeMs: data.processing_time_ms,
    };
  }

  static async healthCheck(): Promise<{ status: string; modelType: string }> {
    try {
      const response = await fetch(`${this.baseUrl}/health`);
      const data = await response.json();
      return { status: data.status, modelType: data.model_type };
    } catch {
      return { status: 'unavailable', modelType: 'none' };
    }
  }
}
