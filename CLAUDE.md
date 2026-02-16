# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

SnapChess is a mobile-first chess position analyzer that uses computer vision to detect chess positions from screenshots/camera and provides engine analysis with natural language explanations. The core differentiator is screenshot-to-analysis in one step (no manual piece placement).

## Planned Tech Stack

- **Web Frontend**: React + TypeScript + Vite
- **iOS Frontend**: Swift + SwiftUI (native camera integration)
- **Chess Engine**: Stockfish.js (web) / Stockfish framework (iOS)
- **Computer Vision**: TensorFlow.js or custom CNN, CoreML on iOS
- **AI Explanations**: OpenAI or Anthropic Claude API
- **State Management**: Zustand
- **Payments**: Stripe (web) + iOS In-App Purchase
- **Backend**: Node.js/Express (for server-side CV if needed)

## Architecture

The app has two main pipelines:

1. **CV Pipeline**: Image → board detection → piece recognition → FEN string → validation
2. **Analysis Pipeline**: FEN → Stockfish evaluation → top 3 moves → AI explanation generation

Freemium model: 3 free analyses/day, Pro at $3.99/mo unlocks unlimited + AI explanations.

## Project Status

No code written yet. See `SnapChess-Plan.md` for the full 9-phase development roadmap. MVP target is web-first (Phases 1-4), followed by iOS native app.
