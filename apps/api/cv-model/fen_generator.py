"""Convert piece classifications to a FEN string and validate legality."""

import chess

PIECE_TO_FEN = {
    "empty": None,
    "wp": "P", "wn": "N", "wb": "B", "wr": "R", "wq": "Q", "wk": "K",
    "bp": "p", "bn": "n", "bb": "b", "br": "r", "bq": "q", "bk": "k",
}

SQUARES_A8_TO_H1 = [
    chess.A8, chess.B8, chess.C8, chess.D8, chess.E8, chess.F8, chess.G8, chess.H8,
    chess.A7, chess.B7, chess.C7, chess.D7, chess.E7, chess.F7, chess.G7, chess.H7,
    chess.A6, chess.B6, chess.C6, chess.D6, chess.E6, chess.F6, chess.G6, chess.H6,
    chess.A5, chess.B5, chess.C5, chess.D5, chess.E5, chess.F5, chess.G5, chess.H5,
    chess.A4, chess.B4, chess.C4, chess.D4, chess.E4, chess.F4, chess.G4, chess.H4,
    chess.A3, chess.B3, chess.C3, chess.D3, chess.E3, chess.F3, chess.G3, chess.H3,
    chess.A2, chess.B2, chess.C2, chess.D2, chess.E2, chess.F2, chess.G2, chess.H2,
    chess.A1, chess.B1, chess.C1, chess.D1, chess.E1, chess.F1, chess.G1, chess.H1,
]


def classifications_to_fen(classifications: list[dict]) -> dict:
    """
    Convert 64 square classifications to a FEN string.

    Args:
        classifications: list of {class, confidence} for each square,
                         ordered a8, b8, ..., h8, a7, ..., h1

    Returns:
        {
            fen: str,
            confidence: float (overall),
            square_confidences: {square_name: confidence},
            low_confidence_squares: [square_name, ...],
            needs_review: bool,
            validation_errors: [str, ...]
        }
    """
    if len(classifications) != 64:
        raise ValueError(f"Expected 64 classifications, got {len(classifications)}")

    # Build piece placement string
    rows = []
    for rank in range(8):  # Rank 8 down to rank 1
        row = ""
        empty_count = 0
        for file in range(8):
            idx = rank * 8 + file
            piece_class = classifications[idx]["class"]
            fen_char = PIECE_TO_FEN.get(piece_class)

            if fen_char is None:
                empty_count += 1
            else:
                if empty_count > 0:
                    row += str(empty_count)
                    empty_count = 0
                row += fen_char

        if empty_count > 0:
            row += str(empty_count)
        rows.append(row)

    piece_placement = "/".join(rows)

    # Determine turn (heuristic: if both kings present, default to white)
    # In practice, the user can correct this
    turn = _guess_turn(classifications)

    # Determine castling rights
    castling = _guess_castling(classifications)

    fen = f"{piece_placement} {turn} {castling} - 0 1"

    # Compute confidence metrics
    confidences = [c["confidence"] for c in classifications]
    overall_confidence = float(np.mean(confidences)) if confidences else 0.0

    square_names = [chess.square_name(sq) for sq in SQUARES_A8_TO_H1]
    square_confidences = {
        name: classifications[i]["confidence"] for i, name in enumerate(square_names)
    }

    low_confidence = [
        name for name, conf in square_confidences.items() if conf < 0.9
    ]

    # Validate the position
    validation_errors = _validate_position(fen)

    return {
        "fen": fen,
        "confidence": overall_confidence,
        "square_confidences": square_confidences,
        "low_confidence_squares": low_confidence,
        "needs_review": len(low_confidence) > 0 or len(validation_errors) > 0,
        "validation_errors": validation_errors,
    }


def _guess_turn(classifications: list[dict]) -> str:
    """Guess whose turn it is. Default to white."""
    return "w"


def _guess_castling(classifications: list[dict]) -> str:
    """Guess castling availability from king/rook positions."""
    rights = ""

    # White
    if (
        classifications[60]["class"] == "wk"  # e1
        and classifications[63]["class"] == "wr"  # h1
    ):
        rights += "K"
    if (
        classifications[60]["class"] == "wk"  # e1
        and classifications[56]["class"] == "wr"  # a1
    ):
        rights += "Q"

    # Black
    if (
        classifications[4]["class"] == "bk"  # e8
        and classifications[7]["class"] == "br"  # h8
    ):
        rights += "k"
    if (
        classifications[4]["class"] == "bk"  # e8
        and classifications[0]["class"] == "br"  # a8
    ):
        rights += "q"

    return rights if rights else "-"


def _validate_position(fen: str) -> list[str]:
    """Validate the FEN position for legality."""
    errors = []

    try:
        board = chess.Board(fen)
    except ValueError as e:
        errors.append(f"Invalid FEN: {e}")
        return errors

    # Check for required kings
    white_kings = len(board.pieces(chess.KING, chess.WHITE))
    black_kings = len(board.pieces(chess.KING, chess.BLACK))

    if white_kings != 1:
        errors.append(f"Expected 1 white king, found {white_kings}")
    if black_kings != 1:
        errors.append(f"Expected 1 black king, found {black_kings}")

    # Check for pawns on first/last rank
    for sq in range(8):  # Rank 1
        piece = board.piece_at(sq)
        if piece and piece.piece_type == chess.PAWN:
            errors.append(f"Pawn on rank 1: {chess.square_name(sq)}")

    for sq in range(56, 64):  # Rank 8
        piece = board.piece_at(sq)
        if piece and piece.piece_type == chess.PAWN:
            errors.append(f"Pawn on rank 8: {chess.square_name(sq)}")

    # Check for too many pieces
    for color in [chess.WHITE, chess.BLACK]:
        color_name = "White" if color == chess.WHITE else "Black"
        pawns = len(board.pieces(chess.PAWN, color))
        if pawns > 8:
            errors.append(f"{color_name} has {pawns} pawns (max 8)")

        total = sum(len(board.pieces(pt, color)) for pt in chess.PIECE_TYPES)
        if total > 16:
            errors.append(f"{color_name} has {total} pieces (max 16)")

    return errors


# Need numpy for confidence calculation
import numpy as np
