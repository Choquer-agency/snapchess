"""
SnapChess CV Microservice — FastAPI application.

Endpoints:
  POST /detect  — Upload image, detect chess position, return FEN + confidence
  GET  /health  — Health check
"""

import io
import time
import logging

import cv2
import numpy as np
from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from PIL import Image

from board_detector import find_board, split_into_squares
from piece_classifier import PieceClassifier
from fen_generator import classifications_to_fen

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI(title="SnapChess CV Service", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# Initialize classifier once at startup
classifier = PieceClassifier()


@app.get("/health")
async def health():
    return {
        "status": "ok",
        "model_loaded": classifier.session is not None,
        "model_type": "onnx" if classifier.session else "heuristic",
    }


@app.post("/detect")
async def detect_position(image: UploadFile = File(...)):
    """
    Detect chess position from an uploaded image.

    Returns:
        fen: str — detected FEN string
        confidence: float — overall confidence (0-1)
        square_confidences: dict — per-square confidence
        low_confidence_squares: list — squares with < 90% confidence
        needs_review: bool — whether manual review is recommended
        processing_time_ms: int — processing time
    """
    start = time.time()

    # Validate file type
    if not image.content_type or not image.content_type.startswith("image/"):
        raise HTTPException(status_code=400, detail="File must be an image")

    try:
        # Read image
        contents = await image.read()
        pil_image = Image.open(io.BytesIO(contents)).convert("RGB")
        cv_image = cv2.cvtColor(np.array(pil_image), cv2.COLOR_RGB2BGR)

        logger.info(f"Image size: {cv_image.shape[1]}x{cv_image.shape[0]}")

        # Step 1: Detect and extract the board
        board_image, corners = find_board(cv_image)
        if board_image is None:
            raise HTTPException(
                status_code=422, detail="Could not detect a chess board in the image"
            )

        logger.info(f"Board detected: {board_image.shape}")

        # Step 2: Split into 64 squares
        squares = split_into_squares(board_image)
        logger.info(f"Split into {len(squares)} squares")

        # Step 3: Classify each square
        classifications = classifier.classify_squares(squares, board_image)
        logger.info("Squares classified")

        # Step 4: Generate and validate FEN
        result = classifications_to_fen(classifications)

        elapsed = int((time.time() - start) * 1000)
        logger.info(
            f"Detection complete in {elapsed}ms — FEN: {result['fen']} "
            f"(confidence: {result['confidence']:.2f})"
        )

        return {
            **result,
            "processing_time_ms": elapsed,
        }

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Detection failed: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Detection failed: {str(e)}")


@app.post("/detect/orientation")
async def detect_orientation(image: UploadFile = File(...)):
    """
    Detect if the board is oriented with white at bottom (standard) or top (flipped).
    Helps auto-correct the FEN if the board is shown from black's perspective.
    """
    contents = await image.read()
    pil_image = Image.open(io.BytesIO(contents)).convert("RGB")
    cv_image = cv2.cvtColor(np.array(pil_image), cv2.COLOR_RGB2BGR)

    board_image, _ = find_board(cv_image)
    if board_image is None:
        raise HTTPException(status_code=422, detail="Could not detect a chess board")

    # Heuristic: check if bottom-right corner is a light square
    # Standard orientation: h1 is a light square (bottom-right)
    h, w = board_image.shape[:2]
    sq_size = w // 8

    # Bottom-right square
    br_square = board_image[h - sq_size : h, w - sq_size : w]
    br_brightness = np.mean(cv2.cvtColor(br_square, cv2.COLOR_BGR2GRAY))

    # Bottom-left square
    bl_square = board_image[h - sq_size : h, 0:sq_size]
    bl_brightness = np.mean(cv2.cvtColor(bl_square, cv2.COLOR_BGR2GRAY))

    # h1 (bottom-right in standard orientation) should be light
    # a1 (bottom-left) should be dark
    standard_orientation = br_brightness > bl_brightness

    return {
        "orientation": "standard" if standard_orientation else "flipped",
        "confidence": abs(br_brightness - bl_brightness) / 255,
    }
