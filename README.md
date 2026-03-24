# 📚 PrintPrice Pro - Book Price Calculator

> **Powered by [PrintPrice.Pro](https://printprice.pro)** | **Designed by [LatinFlash LDA](https://latinflash.com)**

A modern, intelligent web application for calculating book printing costs with AI-powered assistance. This application integrates with the PrintPrice.Pro pricing engine to provide real-time quotes from multiple print houses.

---

## 🌟 Key Features

### 🤖 Intelligent AI Assistant
- **Natural Language Specs**: Describe your project (e.g., "300 copies of a hardcover, 360 pages, B&W interior").
- **Multilingual Support**: Intelligent heuristic extraction for English and Spanish terminology.
- **Resilience Engine**: 
  - **Conflict Guards**: Prioritizes explicit user instructions over AI model hallucinations.
  - **AI Summary Repair**: Automatically corrects hallucinated specifications in the chat bubble text.
  - **Offers Auto-Healing**: Automatically fetches valid quotes if the AI model fails to return them due to missing parameters.
- **Strict Spec Enforcement**: Prevents invalid calculations by requiring mandatory fields (like interior pages).

### 📄 Professional PDF Analysis
- **Automatic Extraction**: Detects page count, size, orientation, and color vs. B/W directly from uploaded files.
- **Smart Mapping**: Maps PDF dimensions to industry-standard sizes (A4, A5, 170x240mm, etc.).

### 💰 Dynamic Pricing & Orders
- **Real-Time BPE Integration**: Quotes from multiple print houses across 25+ countries.
- **Detailed Cost Breakdown**: Itemized pricing for printing, paper, binding, finishing, and delivery.
- **One-Click Ordering**: Generate print orders directly from the chat interface.

---

## 🏗️ Architecture

### Frontend (React + TypeScript + Vite)

```
├── App.tsx                    # Main orchestrator & Global State
├── components/                
│   ├── AssistantChat.tsx      # AI Assistant with Repair & Healing Logic (CRITICAL)
│   ├── BookPriceForm.tsx      # Specifications form with payloadVersion protection
│   ├── PrintOffersPanel.tsx   # Results display with dynamic breakdown rendering
│   └── PdfUploadDropzone.tsx  # PDF analysis component
├── constants.ts               # API endpoints, refined System Prompt, and Enums
├── types.ts                   # Harmonized types (aligned with BPE responses)
└── i18n/                      # Internationalization
```

### Backend (Node.js + Express)
- **Gemini Proxy**: Securely handles AI requests and protects API keys.
- **WebSocket Gateway**: Real-time communication for AI streaming.
- **Rate Limiting**: Protects against automated abuse.

---

## � Advanced Resilience Logic

This application features a unique **Frontend Resilience Layer** to handle AI model inconsistencies:

1. **Heuristic Extraction (User Message Parsing)**:
   The frontend parses the user's *original* message using robust regex to detect intent (Copies, Pages, Binding, Country).

2. **Conflict Guards**:
   Heuristic values strictly override the AI backend's `specs_patch` to ensure user intent always wins over model defaults.

3. **Hallucination Repair**:
   The chat bubble text is dynamically rewritten by the frontend to replace hallucinated summaries with actual applied specifications.

4. **Self-Healing Offers**:
   If the AI model returns "no offers" because it forgot a parameter, the frontend triggers a background quote calculation as soon as the parameter is corrected.

---

## 🔌 API Integration

1. **Book Price Engine (BPE)**: `https://printprice.pro/wp-json/bpe/v1/estimates`
2. **AI Assistant**: `https://printprice.pro/wp-json/ppp-ai/v1/chat`
3. **Order Creation**: `https://printprice.pro/wp-json/custom-print/v1/create-order`

---

## 📦 Installation & Setup

1. **Install Dependencies**:
   ```bash
   npm install
   cd server && npm install
   ```

2. **Configure Environment**:
   Create a `.env.local` containing:
   ```env
   GEMINI_API_KEY=your_key
   ```

3. **Run Development Mode**:
   ```bash
   npm run dev
   ```

---

## � Technical Specifications

| Feature | Supported Options |
|---------|-------------------|
| **Sizes** | A4, A5, A6, 170x240 mm, 210x210 mm, Custom |
| **Binding** | Perfect Bound (Soft), Thread Sewn (Hardcover), Wire-O, Spiral |
| **Printing** | 4/4 Full Color, 1/1 Black & White, 2/2 Colors |
| **PMS** | Support for 0 or 1 custom colors |
| **Lamination** | Gloss, Matt, Soft Touch, Scratch-proof |

---

## 📄 License & Credits
- **Developed by**: [LatinFlash LDA](https://latinflash.com)
- **Powered by**: [PrintPrice.Pro](https://printprice.pro)
- **Icons**: Heroicons

**Built with ❤️ by LatinFlash LDA | Premium Printing Systems**
