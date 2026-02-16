# SnapChess — Full Implementation Plan

## Context

SnapChess is a chess position analyzer that uses computer vision to detect positions from screenshots and provides engine analysis with AI explanations. The core differentiator is eliminating manual piece placement — users upload a screenshot and get instant analysis. This plan covers all 9 phases from engine foundation through iOS launch, designed for a solo developer.

**Key decisions confirmed:**
- Platform: Web first (React + TypeScript + Vite)
- Backend: Full backend from day 1 (Node.js/Express)
- CV approach: Self-hosted model (ChessCog) from day 1
- Database: PostgreSQL + Prisma ORM
- Hosting: Vercel (frontend) + Railway (backend + Postgres)
- Freemium: 3 free analyses/day, Pro at $3.99/mo or $29.99/yr

---

## Project Structure (Monorepo)

```
snapchess/
├── package.json                  # npm workspaces root
├── tsconfig.base.json
├── docker-compose.yml            # Local dev (Postgres + Redis)
├── .env.example
│
├── apps/
│   ├── web/                      # React + Vite frontend
│   │   ├── src/
│   │   │   ├── components/       # UI components (Analysis/, CV/, Freemium/, Auth/)
│   │   │   ├── pages/            # Route pages
│   │   │   ├── hooks/            # Custom hooks
│   │   │   ├── store/            # Zustand stores
│   │   │   ├── services/         # API client, Stockfish wrapper
│   │   │   └── types/
│   │   ├── public/stockfish.wasm
│   │   └── vite.config.ts
│   │
│   └── api/                      # Express backend
│       ├── src/
│       │   ├── controllers/
│       │   ├── services/         # Business logic (CV, Analysis, Subscription, etc.)
│       │   ├── middleware/       # Auth, rate limiting, validation
│       │   ├── routes/
│       │   └── config/
│       ├── prisma/schema.prisma
│       └── cv-model/             # ChessCog model files
│
├── packages/
│   └── shared/                   # Shared types & constants
│
└── apps/ios/                     # Phase 8: Swift/SwiftUI (later)
```

---

## Database Schema (Prisma)

**Core models:**
- **User** — email/password + Google/Apple OAuth, subscription tier (FREE/PRO)
- **Subscription** — Stripe/Apple IAP details, billing interval, status
- **DailyUsage** — per-user per-day analysis count (unique on userId+date)
- **Analysis** — FEN, engine results (top moves as JSON), AI explanations, image URL, cached flag with FEN hash for deduplication
- **Event** — analytics events (type, data, timestamp) for self-hosted tracking

---

## API Endpoints

| Method | Endpoint | Purpose |
|--------|----------|---------|
| POST | `/api/v1/auth/register` | Email/password signup |
| POST | `/api/v1/auth/login` | Login, returns JWT |
| POST | `/api/v1/auth/google` | Google OAuth |
| POST | `/api/v1/auth/refresh` | Refresh access token |
| GET | `/api/v1/auth/me` | Current user |
| POST | `/api/v1/analysis` | Analyze a FEN position |
| POST | `/api/v1/analysis/detect-position` | Upload image → FEN (CV) |
| GET | `/api/v1/analysis/:id` | Get analysis by ID |
| GET | `/api/v1/analysis` | User's history |
| GET | `/api/v1/usage/today` | Today's usage count |
| GET | `/api/v1/usage/can-analyze` | Check limit |
| POST | `/api/v1/subscription/checkout` | Create Stripe checkout |
| POST | `/api/v1/subscription/portal` | Stripe customer portal |
| POST | `/api/v1/webhooks/stripe` | Stripe webhook handler |

**Auth strategy:** JWT with short-lived access tokens (15 min) + httpOnly cookie refresh tokens (7 days).

---

## CV Pipeline (Self-Hosted — ChessCog)

ChessCog achieves 99.77% per-square accuracy and supports few-shot learning for new board themes.

**Pipeline flow:**
1. **Image upload** → backend receives image buffer
2. **Preprocessing** — resize, normalize, perspective correction (sharp library)
3. **Board detection** — find 8x8 grid corners, validate aspect ratio, detect orientation
4. **Piece classification** — ChessCog CNN classifies each of 64 squares → piece/color/confidence
5. **FEN generation** — convert classifications to FEN, validate legality with chess.js
6. **Confidence check** — if any square <90% confidence, flag for manual review on frontend

**Integration:** ChessCog is Python-based. Run as a Python microservice (FastAPI) called from the Node.js backend, or use ONNX Runtime in Node.js to run the model directly.

---

## Phase-by-Phase Plan

### Phase 1: Chess Engine Foundation ✅ COMPLETE

**Goal:** Stockfish integration with FEN input → top 3 moves + evaluation

**Implemented:**
- Monorepo with npm workspaces (apps/web, apps/api, packages/shared)
- React + Vite + TypeScript frontend with CSS modules
- Express + TypeScript backend with Prisma schema
- Stockfish.js WASM Web Worker integration (MultiPV=3, depth 18)
- Chess board with Unicode pieces, coordinate labels, best move highlighting
- Vertical evaluation bar (white/black portions with score display)
- Top 3 move recommendations with SAN notation and principal variation
- FEN text input with validation (chess.js) and analyze/stop controls
- Board flip button
- Image upload component (drag-drop + file picker)
- JWT auth middleware, Zod validation, rate limiting
- Database schema: User, Subscription, DailyUsage, Analysis, Event
- Usage tracking service (daily limits)
- Analysis service (caching by FEN hash)
- API client with token refresh logic

---

### Phase 2: Screenshot Analysis / CV (Weeks 2-4)

**Goal:** Upload screenshot → detect position → FEN with 99%+ accuracy

**Tasks:**
1. Set up ChessCog model (Python microservice or ONNX in Node.js)
2. Build image upload component (drag-drop + file picker) ✅
3. Implement backend CV service: preprocess → detect board → classify pieces → generate FEN
4. Build position confirmation UI ("Is this correct?")
5. Build manual correction UI for low-confidence squares
6. Store uploaded images in S3/R2 for debugging/retraining
7. Test across Chess.com, Lichess, and book screenshots

---

### Phase 3: Analysis Interface (Week 5)

**Goal:** Complete, polished analysis UI

**Tasks:**
1. Full chess board with SVG pieces, coordinates, flip button ✅ (Unicode, not SVG)
2. Move highlighting (arrows/squares on board for recommended moves) ✅ (square highlighting)
3. Responsive layout: board left + panel right (desktop), stacked (mobile) ✅
4. Analysis history page
5. Share analysis button (copy link / export PNG)
6. Connect CV upload → engine analysis → results display end-to-end

---

### Phase 4: Freemium Mechanics (Week 6)

**Goal:** 3/day limit, upgrade funnel, Stripe payments

**Tasks:**
1. Backend usage tracking service (DailyUsage model, midnight reset cron) ✅ (service built)
2. Frontend usage indicator ("2 of 3 remaining")
3. Limit enforcement — block analysis at limit, show upgrade prompt
4. Pricing page (Free vs Pro comparison table)
5. Stripe Checkout integration (monthly + annual)
6. Stripe webhook handler (subscription created/updated/canceled)
7. Subscription management page (cancel, reactivate)
8. Self-hosted analytics events

**MILESTONE: Web MVP launch**

---

### Phase 5: Natural Language Explanations (Weeks 7-8)

**Goal:** AI-powered "why this move is best" for PRO users

---

### Phase 6: Manual Editing & Workflow (Week 9)

**Goal:** Drag-drop moves, position editing, PGN export

---

### Phase 7: Performance & Polish (Week 10)

**Goal:** Production-ready performance and onboarding

---

### Phase 8: iOS Native App (Weeks 11-13)

**Goal:** Swift/SwiftUI app with camera-first UX

---

### Phase 9: Analytics, A/B Testing & Launch (Weeks 14-15)

**Goal:** Production monitoring, legal compliance, launch

---

## Deployment

| Component | Service | Cost |
|-----------|---------|------|
| Frontend | Vercel (free tier → Pro) | $0-20/mo |
| Backend API | Railway | $5-10/mo |
| PostgreSQL | Railway | $5-10/mo |
| CV Model | Railway (Python sidecar) | $5-10/mo |
| Image Storage | Cloudflare R2 | ~$0/mo (free tier) |
| **Total (MVP)** | | **~$20/mo** |
