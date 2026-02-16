"""
Piece classification module.

Classifies each 64x64 square image into one of 13 classes:
empty, wp, wn, wb, wr, wq, wk, bp, bn, bb, br, bq, bk

Uses a CNN model. When no trained model is available, falls back to
a color-histogram heuristic that works reasonably well on standard
digital boards (Chess.com, Lichess themes).
"""

import os
import numpy as np
import cv2

try:
    import onnxruntime as ort

    HAS_ONNX = True
except ImportError:
    HAS_ONNX = False

CLASSES = ["empty", "wp", "wn", "wb", "wr", "wq", "wk", "bp", "bn", "bb", "br", "bq", "bk"]

MODEL_PATH = os.path.join(os.path.dirname(__file__), "model", "chesscog.onnx")


class PieceClassifier:
    def __init__(self):
        self.session = None
        if HAS_ONNX and os.path.exists(MODEL_PATH):
            self.session = ort.InferenceSession(MODEL_PATH)
            self.input_name = self.session.get_inputs()[0].name

    def classify_squares(
        self, squares: list[np.ndarray], board_image: np.ndarray | None = None
    ) -> list[dict]:
        """
        Classify a list of 64 square images.
        Returns list of {class, confidence} for each square.
        """
        if self.session is not None:
            return self._classify_with_model(squares)
        else:
            return self._classify_with_heuristic(squares, board_image)

    def _classify_with_model(self, squares: list[np.ndarray]) -> list[dict]:
        """Use ONNX model for classification."""
        results = []

        for square in squares:
            # Preprocess: normalize to [0, 1], CHW format
            img = cv2.resize(square, (64, 64)).astype(np.float32) / 255.0
            img = np.transpose(img, (2, 0, 1))  # HWC -> CHW
            img = np.expand_dims(img, axis=0)  # Add batch dimension

            outputs = self.session.run(None, {self.input_name: img})
            probs = _softmax(outputs[0][0])

            class_idx = int(np.argmax(probs))
            results.append(
                {"class": CLASSES[class_idx], "confidence": float(probs[class_idx])}
            )

        return results

    def _classify_with_heuristic(
        self, squares: list[np.ndarray], board_image: np.ndarray | None
    ) -> list[dict]:
        """
        Heuristic-based classification using color analysis.
        Works well for standard digital chess board themes.
        """
        # First, determine board colors (light/dark square colors)
        light_color, dark_color = self._detect_board_colors(squares)

        results = []
        for i, square in enumerate(squares):
            row, col = divmod(i, 8)
            is_light_square = (row + col) % 2 == 0

            result = self._classify_single_square(
                square, is_light_square, light_color, dark_color
            )
            results.append(result)

        return results

    def _detect_board_colors(
        self, squares: list[np.ndarray]
    ) -> tuple[np.ndarray, np.ndarray]:
        """Estimate the light and dark square background colors."""
        light_corners = []  # Corners of light squares (likely empty or near-empty)
        dark_corners = []

        for i, square in enumerate(squares):
            row, col = divmod(i, 8)
            is_light = (row + col) % 2 == 0
            # Sample corner pixels (less likely to have piece)
            corner_pixels = [
                square[2, 2],
                square[2, -3],
                square[-3, 2],
                square[-3, -3],
            ]
            avg_corner = np.mean(corner_pixels, axis=0)

            if is_light:
                light_corners.append(avg_corner)
            else:
                dark_corners.append(avg_corner)

        light_color = np.median(light_corners, axis=0).astype(np.uint8)
        dark_color = np.median(dark_corners, axis=0).astype(np.uint8)

        return light_color, dark_color

    def _classify_single_square(
        self,
        square: np.ndarray,
        is_light_square: bool,
        light_color: np.ndarray,
        dark_color: np.ndarray,
    ) -> dict:
        """Classify a single square using color histogram analysis."""
        bg_color = light_color if is_light_square else dark_color

        # Check if square is empty by comparing to background color
        center = square[12:52, 12:52]  # Center region
        center_mean = np.mean(center, axis=(0, 1))
        bg_diff = np.linalg.norm(center_mean - bg_color.astype(float))

        # Also check variance in center (empty squares have low variance)
        center_gray = cv2.cvtColor(center, cv2.COLOR_BGR2GRAY)
        center_var = np.var(center_gray)

        if bg_diff < 25 and center_var < 400:
            return {"class": "empty", "confidence": 0.85}

        # Has a piece — determine color and type
        piece_color = self._detect_piece_color(center, bg_color)
        piece_type = self._detect_piece_type(center_gray, center_var)

        confidence = 0.55  # Heuristic confidence is lower

        return {
            "class": f"{piece_color}{piece_type}",
            "confidence": confidence,
        }

    def _detect_piece_color(self, center: np.ndarray, bg_color: np.ndarray) -> str:
        """Determine if the piece is white or black."""
        gray = cv2.cvtColor(center, cv2.COLOR_BGR2GRAY)

        # Create mask for non-background pixels
        diff = np.abs(center.astype(float) - bg_color.astype(float))
        piece_mask = np.max(diff, axis=2) > 30

        if not np.any(piece_mask):
            return "w"  # Default to white if can't detect

        piece_pixels = gray[piece_mask]
        mean_brightness = np.mean(piece_pixels)

        return "w" if mean_brightness > 128 else "b"

    def _detect_piece_type(self, center_gray: np.ndarray, variance: float) -> str:
        """
        Estimate piece type from shape features.
        This is approximate — the CNN model is much more accurate.
        """
        # Use contour analysis for shape estimation
        _, binary = cv2.threshold(center_gray, 0, 255, cv2.THRESH_BINARY + cv2.THRESH_OTSU)

        contours, _ = cv2.findContours(binary, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
        if not contours:
            return "p"  # Default

        largest = max(contours, key=cv2.contourArea)
        area = cv2.contourArea(largest)
        perimeter = cv2.arcLength(largest, True)
        hull = cv2.convexHull(largest)
        hull_area = cv2.contourArea(hull)

        if hull_area == 0:
            return "p"

        solidity = area / hull_area
        total_pixels = center_gray.shape[0] * center_gray.shape[1]
        fill_ratio = area / total_pixels

        # Rough heuristics based on shape properties
        if fill_ratio > 0.55:
            if solidity > 0.85:
                return "r"  # Rook — tall, solid
            else:
                return "q"  # Queen — large, complex
        elif fill_ratio > 0.4:
            if solidity > 0.8:
                return "k"  # King — medium-large, solid top
            else:
                return "b"  # Bishop — medium, pointed
        elif fill_ratio > 0.25:
            if solidity < 0.7:
                return "n"  # Knight — irregular shape
            else:
                return "b"  # Bishop
        else:
            return "p"  # Pawn — small footprint


def _softmax(x: np.ndarray) -> np.ndarray:
    e = np.exp(x - np.max(x))
    return e / e.sum()
