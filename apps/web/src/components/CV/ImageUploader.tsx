import { useState, useCallback, useRef } from 'react';
import { useAnalysisStore } from '../../store/analysisStore';
import styles from './ImageUploader.module.css';

export function ImageUploader() {
  const [isDragging, setIsDragging] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { setDetection } = useAnalysisStore();

  const handleFile = useCallback(
    async (file: File) => {
      if (!file.type.startsWith('image/')) {
        setError('Please upload an image file');
        return;
      }

      setError(null);
      setIsProcessing(true);

      const imageUrl = URL.createObjectURL(file);

      try {
        const formData = new FormData();
        formData.append('image', file);

        const apiBase = import.meta.env.VITE_API_URL || '/api/v1';
        const res = await fetch(`${apiBase}/analysis/detect-position`, {
          method: 'POST',
          body: formData,
        });

        const data = await res.json();

        if (data.success && data.data?.fen) {
          setDetection(
            {
              fen: data.data.fen,
              confidence: data.data.confidence,
              squareConfidences: data.data.squareConfidences || {},
              lowConfidenceSquares: data.data.lowConfidenceSquares || [],
              needsReview: data.data.needsReview ?? false,
              validationErrors: data.data.validationErrors || [],
            },
            imageUrl,
          );
        } else {
          setError(data.error || 'Could not detect chess position');
        }
      } catch (err) {
        setError('Failed to connect to detection service. Start it with: docker-compose up cv-model');
        console.error('Upload failed:', err);
      } finally {
        setIsProcessing(false);
      }
    },
    [setDetection],
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);
      const file = e.dataTransfer.files[0];
      if (file) handleFile(file);
    },
    [handleFile],
  );

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => setIsDragging(false);
  const handleClick = () => fileInputRef.current?.click();

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
  };

  return (
    <div>
      <div
        className={`${styles.dropzone} ${isDragging ? styles.dragging : ''} ${isProcessing ? styles.processing : ''}`}
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onClick={handleClick}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          onChange={handleInputChange}
          className={styles.fileInput}
        />
        {isProcessing ? (
          <div className={styles.processingContent}>
            <span className={styles.spinner} />
            <span className={styles.text}>Detecting chess position...</span>
          </div>
        ) : (
          <span className={styles.text}>
            Drop a chess screenshot here, or click to upload
          </span>
        )}
      </div>
      {error && <p className={styles.error}>{error}</p>}
    </div>
  );
}
