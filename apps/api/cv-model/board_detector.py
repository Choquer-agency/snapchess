"""Board detection module — finds and extracts the chess board from an image."""

import cv2
import numpy as np
from PIL import Image


def find_board(image: np.ndarray) -> tuple[np.ndarray | None, np.ndarray | None]:
    """
    Detect the chess board region in an image.
    Returns (board_image_64x64_squares, corners) or (None, None) if not found.
    """
    gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)

    # Try multiple approaches to find the board
    board = _find_board_by_contours(image, gray)
    if board is not None:
        return board, None

    board = _find_board_by_lines(image, gray)
    if board is not None:
        return board, None

    # Fallback: assume the board is the majority of the image (screenshot scenario)
    return _find_board_by_crop(image, gray), None


def _find_board_by_contours(image: np.ndarray, gray: np.ndarray) -> np.ndarray | None:
    """Find board as the largest square-ish contour."""
    blurred = cv2.GaussianBlur(gray, (5, 5), 0)
    edges = cv2.Canny(blurred, 30, 100)

    # Dilate to connect broken edges
    kernel = np.ones((3, 3), np.uint8)
    edges = cv2.dilate(edges, kernel, iterations=2)

    contours, _ = cv2.findContours(edges, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)

    if not contours:
        return None

    # Sort by area, largest first
    contours = sorted(contours, key=cv2.contourArea, reverse=True)

    h, w = image.shape[:2]
    min_area = (h * w) * 0.1  # Board should be at least 10% of image

    for contour in contours[:5]:
        area = cv2.contourArea(contour)
        if area < min_area:
            continue

        # Approximate to polygon
        peri = cv2.arcLength(contour, True)
        approx = cv2.approxPolyDP(contour, 0.02 * peri, True)

        if len(approx) == 4:
            # Check if roughly square (aspect ratio close to 1)
            rect = cv2.boundingRect(approx)
            aspect = rect[2] / rect[3] if rect[3] > 0 else 0
            if 0.7 < aspect < 1.3:
                # Warp to square
                return _warp_board(image, approx.reshape(4, 2))

    return None


def _find_board_by_lines(image: np.ndarray, gray: np.ndarray) -> np.ndarray | None:
    """Find board using Hough line detection — look for grid pattern."""
    blurred = cv2.GaussianBlur(gray, (5, 5), 0)
    edges = cv2.Canny(blurred, 50, 150)

    lines = cv2.HoughLinesP(edges, 1, np.pi / 180, 100, minLineLength=50, maxLineGap=10)
    if lines is None or len(lines) < 8:
        return None

    # Separate horizontal and vertical lines
    h_lines = []
    v_lines = []

    for line in lines:
        x1, y1, x2, y2 = line[0]
        angle = np.abs(np.arctan2(y2 - y1, x2 - x1) * 180 / np.pi)

        if angle < 15 or angle > 165:  # Horizontal
            h_lines.append((min(y1, y2), max(y1, y2), min(x1, x2), max(x1, x2)))
        elif 75 < angle < 105:  # Vertical
            v_lines.append((min(x1, x2), max(x1, x2), min(y1, y2), max(y1, y2)))

    if len(h_lines) < 4 or len(v_lines) < 4:
        return None

    # Find the board bounds from line clusters
    h_positions = sorted(set([(h[0] + h[1]) // 2 for h in h_lines]))
    v_positions = sorted(set([(v[0] + v[1]) // 2 for v in v_lines]))

    if len(h_positions) >= 2 and len(v_positions) >= 2:
        y_min, y_max = h_positions[0], h_positions[-1]
        x_min, x_max = v_positions[0], v_positions[-1]

        # Check aspect ratio
        w = x_max - x_min
        h = y_max - y_min
        if w > 50 and h > 50 and 0.7 < w / h < 1.3:
            board = image[y_min:y_max, x_min:x_max]
            return cv2.resize(board, (512, 512))

    return None


def _find_board_by_crop(image: np.ndarray, gray: np.ndarray) -> np.ndarray:
    """
    Fallback: find the board by looking for the largest uniform region.
    For screenshots, the board is usually centered and takes up most of the image.
    """
    h, w = image.shape[:2]

    # Analyze color variance in a grid to find the "checkerboard" region
    block_size = min(h, w) // 20
    if block_size < 5:
        # Image too small, just resize
        size = min(h, w)
        start_x = (w - size) // 2
        start_y = (h - size) // 2
        board = image[start_y : start_y + size, start_x : start_x + size]
        return cv2.resize(board, (512, 512))

    # Compute variance map
    variance_map = np.zeros((h // block_size, w // block_size))
    for i in range(variance_map.shape[0]):
        for j in range(variance_map.shape[1]):
            block = gray[
                i * block_size : (i + 1) * block_size,
                j * block_size : (j + 1) * block_size,
            ]
            variance_map[i, j] = np.var(block)

    # The chess board region has high local variance (alternating colors)
    # but lower global variance than UI elements
    # Find the largest rectangular region with moderate variance
    threshold = np.median(variance_map)
    board_mask = variance_map > threshold * 0.3

    # Find bounding box of the largest connected region
    rows = np.any(board_mask, axis=1)
    cols = np.any(board_mask, axis=0)

    if not np.any(rows) or not np.any(cols):
        # Fallback: center crop
        size = min(h, w)
        start_x = (w - size) // 2
        start_y = (h - size) // 2
        board = image[start_y : start_y + size, start_x : start_x + size]
        return cv2.resize(board, (512, 512))

    r_min, r_max = np.where(rows)[0][[0, -1]]
    c_min, c_max = np.where(cols)[0][[0, -1]]

    y_min = r_min * block_size
    y_max = min((r_max + 1) * block_size, h)
    x_min = c_min * block_size
    x_max = min((c_max + 1) * block_size, w)

    # Make it square
    board_h = y_max - y_min
    board_w = x_max - x_min
    size = min(board_h, board_w)

    # Center the crop
    cy = (y_min + y_max) // 2
    cx = (x_min + x_max) // 2
    half = size // 2

    y1 = max(0, cy - half)
    y2 = min(h, cy + half)
    x1 = max(0, cx - half)
    x2 = min(w, cx + half)

    board = image[y1:y2, x1:x2]
    return cv2.resize(board, (512, 512))


def _warp_board(image: np.ndarray, corners: np.ndarray) -> np.ndarray:
    """Perspective-warp the detected quadrilateral to a square."""
    # Order corners: top-left, top-right, bottom-right, bottom-left
    rect = _order_corners(corners)

    dst = np.array([[0, 0], [511, 0], [511, 511], [0, 511]], dtype=np.float32)
    M = cv2.getPerspectiveTransform(rect.astype(np.float32), dst)
    warped = cv2.warpPerspective(image, M, (512, 512))

    return warped


def _order_corners(pts: np.ndarray) -> np.ndarray:
    """Order 4 points as: top-left, top-right, bottom-right, bottom-left."""
    rect = np.zeros((4, 2), dtype=np.float32)

    s = pts.sum(axis=1)
    rect[0] = pts[np.argmin(s)]  # Top-left has smallest sum
    rect[2] = pts[np.argmax(s)]  # Bottom-right has largest sum

    d = np.diff(pts, axis=1)
    rect[1] = pts[np.argmin(d)]  # Top-right has smallest difference
    rect[3] = pts[np.argmax(d)]  # Bottom-left has largest difference

    return rect


def split_into_squares(board_image: np.ndarray) -> list[np.ndarray]:
    """Split a 512x512 board image into 64 individual square images (a8 to h1)."""
    square_size = board_image.shape[0] // 8
    squares = []

    for row in range(8):  # rank 8 down to rank 1
        for col in range(8):  # file a through h
            y = row * square_size
            x = col * square_size
            square = board_image[y : y + square_size, x : x + square_size]
            squares.append(cv2.resize(square, (64, 64)))

    return squares
