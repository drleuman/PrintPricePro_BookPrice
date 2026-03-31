# PrintPrice Pro - Book Price Calculator

> **Powered by [PrintPrice.Pro](https://printprice.pro)** | **Designed by [LatinFlash LDA](https://latinflash.com)**

A modern, intelligent web application for calculating book printing costs with AI-powered assistance.

---

## Key Features

### AI Assistant
- **Natural Language Specs**: Describe your project (e.g., "300 copies of a hardcover, 360 pages, B&W interior").
- **Multilingual Support**: Heuristic extraction for English and Spanish terminology.
- **Resilience Engine**:
  - **Conflict Guards**: Prioritizes explicit user instructions over AI model suggestions.
  - **AI Summary Repair**: Corrects hallucinated specifications in the chat bubble text.
  - **Offers Auto-Healing**: Fetches valid quotes automatically if parameters are corrected.

### PDF Analysis
- **Automatic Extraction**: Detects page count, size, orientation, and color vs. B/W from uploaded files.
- **Smart Mapping**: Maps PDF dimensions to industry-standard sizes (A4, A5, 170x240mm, etc.).

### Pricing & Cart
- **Real-Time BPE Integration**: Quotes from multiple print houses across 25+ countries.
- **Detailed Cost Breakdown**: Itemized pricing for printing, paper, binding, finishing, and delivery.
- **Built-in Cart**: Add offers to cart, review, and submit orders — no external dependencies.

---

## Architecture

### Frontend (`App.tsx` as orchestrator)

```
├── App.tsx                    # Global state, cart logic, handlers
├── components/
│   ├── AssistantChat.tsx      # AI Assistant with resilience pipeline
│   ├── BookPriceForm.tsx      # 20+ field specification form
│   ├── PrintOffersPanel.tsx   # Quote results with cost breakdown
│   ├── CartPanel.tsx          # Cart with checkout and order confirmation
│   └── PdfUploadDropzone.tsx  # PDF.js-based file analysis
├── constants.ts               # API endpoints and form enumerations
├── types.ts                   # Shared TypeScript types
└── i18n/                      # Internationalization
```

### Backend (`server/server.js`)

Hardened Express server. Acts as a secure proxy to keep API keys server-side.

- **AI Chat** (`POST /api/ai/chat`) — Proxies requests to Gemini API, returns `{ reply, specs_patch }`
- **BPE Proxy** (`POST /api/budget/calculate`) — Forwards to the Book Price Engine with Adaptive Vault anti-abuse layer
- **Cart** (`/api/cart/*`) — In-memory session-bound cart (add, get, remove, checkout)
- **Security** — Helmet headers, CORS, signed cookies, rate limiting, nonce replay prevention, honeypot, fail-closed bootstrap

### External API Flow

1. User fills form or chats → `App.tsx` state updated
2. Quote request → BPE at `https://bpe.printprice.pro/api/estimates`
3. AI chat → `/api/ai/chat` (server proxies to Gemini) → resilience engine patches form state
4. User adds offer to cart → `POST /api/cart/add` → CartPanel appears
5. User confirms → `POST /api/cart/checkout` → order captured, success message shown

---

## AI Resilience Pipeline

Each AI response goes through four stages before touching the UI:

1. **Heuristic extraction** — regex/pattern matching on the raw user message
2. **Conflict guards** — explicit user instructions in conversation history override AI suggestions
3. **Hallucination repair** — chat bubbles are rewritten to reflect actual applied specs
4. **Self-healing offers** — if corrected params invalidate a prior quote, a new BPE fetch is triggered

---

## API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/security/challenge` | POST | Issues HMAC-signed token bound to payload context |
| `/api/budget/calculate` | POST | Proxies to BPE with Adaptive Vault protection |
| `/api/ai/chat` | POST | Proxies to Gemini, returns `{ reply, specs_patch }` |
| `/api/cart/add` | POST | Adds `{ specs, offer }` to session cart |
| `/api/cart` | GET | Returns current cart items |
| `/api/cart/items/:id` | DELETE | Removes item from cart |
| `/api/cart/checkout` | POST | Captures order, clears cart, returns `order_id` |

---

## Installation & Setup

1. **Install dependencies**:
   ```bash
   npm install
   cd server && npm install
   ```

2. **Configure environment** — create `server/.env`:
   ```env
   GEMINI_API_KEY=your_gemini_key
   SESSION_SECRET=your_session_secret
   SIGNING_SECRET=your_signing_secret
   PORT=3000
   ```

3. **Run development mode**:
   ```bash
   # Terminal 1 — backend
   cd server && npm run dev

   # Terminal 2 — frontend
   npm run dev
   ```

4. **Production build**:
   ```bash
   npm run build
   cd server && npm start
   ```

---

## Technical Specifications

| Feature | Supported Options |
|---------|-------------------|
| **Sizes** | A4, A5, A6, 170x240 mm, 210x210 mm, Custom |
| **Binding** | Perfect Bound, Thread Sewn (Hardcover), Wire-O, Spiral, Flexibound |
| **Printing** | 4/4 Full Color, 1/1 Black & White, 2/2 Colors |
| **PMS** | 0–3 custom colors |
| **Lamination** | Gloss, Matt, Soft Touch, Scratch-proof |
| **Countries** | 25+ delivery destinations |

---

## License & Credits

- **Developed by**: [LatinFlash LDA](https://latinflash.com)
- **Powered by**: [PrintPrice.Pro](https://printprice.pro)

**Built by LatinFlash LDA | Premium Printing Systems**
