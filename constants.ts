import { BookSize, Orientation, InteriorPrint, CoverPrint, BindingMethod, FinishingOption, EndpapersOption, EndpapersPrint, PaperTypeInterior, PaperTypeCover, PaperTypeEndpaper } from './types';

// --- API Endpoints ---
// Forzamos siempre producción en printprice.pro para evitar problemas
// cuando la SPA está alojada en otro dominio (AI Studio, bucket, etc.).
export const BOOK_PRICE_API_ENDPOINT = 'https://printprice.pro/wp-json/bpe/v1/estimates';

// PDF.js Worker (no CDN externo, usamos local)
export const PDFJS_WORKER_CDN = '/workers/pdf.worker.min.mjs';

// Form Options (matching smoke test exactly)

export const BOOK_SIZES: BookSize[] = ['A6', 'A5', '170 × 240 mm', 'A4', '210 × 210 mm'];
export const COVER_PAGES_OPTIONS = [2, 4, 6, 8];
export const PMS_OPTIONS = [1, 2, 3, 4];

export const ORIENTATIONS: Orientation[] = ['portrait', 'landscape'];

export const INTERIOR_PRINT_OPTIONS: InteriorPrint[] = ['4/4', '2/2', '1/1'];

export const COVER_PRINT_OPTIONS: CoverPrint[] = ['4/0', '4/4', '1/0'];

// Paper types
export const PAPER_TYPE_INTERIOR: { value: PaperTypeInterior; label: string }[] = [
  { value: 'offset', label: 'Woodfree Offset' },
  { value: 'mc', label: 'Woodfree MC' },
  { value: 'lux', label: 'Lux Cream' },
  { value: 'munken', label: 'Munken White/Cream' },
  { value: 'other', label: 'Other' },
];

export const PAPER_TYPE_COVER: { value: PaperTypeCover; label: string }[] = [
  { value: 'mc', label: 'Woodfree MC' },
  { value: 'artboard', label: 'ArtBoard single sided' },
  { value: 'offset', label: 'Woodfree Offset' },
  { value: 'wfmc', label: 'WFMC UPM > 250 gsm' },
  { value: 'other', label: 'Other' },
  { value: 'none', label: 'None' },
];

export const PAPER_TYPE_ENDPAPER: { value: PaperTypeEndpaper; label: string }[] = [
  { value: 'offset', label: 'Woodfree Offset' },
  { value: 'mc', label: 'Woodfree MC' },
  { value: 'other', label: 'Other' },
  { value: 'none', label: 'None' },
];

// Binding methods (matching smoke test)
export const BINDING_METHODS: { value: BindingMethod; label: string }[] = [
  { value: 'perfect_bound', label: 'Perfect Bound' },
  { value: 'thread_sewn_sc', label: 'Thread Sewn (softcover)' },
  { value: 'thread_sewn_hc', label: 'Thread Sewn (hardcover)' },
  { value: 'saddle_stitch', label: 'Saddle Stitch' },
  { value: 'wire_o', label: 'Wire-O' },
  { value: 'spiral', label: 'Spiral' },
];

// Finishing options (matching smoke test)
export const FINISHING_OPTIONS: { value: FinishingOption; label: string }[] = [
  { value: 'gloss_lam', label: 'Gloss lam.' },
  { value: 'matt_lam', label: 'Matt lam.' },
  { value: 'soft_touch', label: 'Soft Touch' },
  { value: '', label: 'None' },
];

// Endpapers options
export const ENDPAPERS_OPTIONS: { value: EndpapersOption; label: string }[] = [
  { value: 'none', label: 'None' },
  { value: 'standard', label: 'Standard (blank)' },
];

export const ENDPAPERS_PRINT_OPTIONS: { value: EndpapersPrint; label: string }[] = [
  { value: '', label: 'None' },
  { value: '1/1', label: '1/1' },
  { value: '4/4', label: '4/4' },
];

// GSM options (extended from smoke test)
export const INTERIOR_GSM_OPTIONS = [70, 80, 90, 100, 115, 120, 135, 140, 150, 160, 170, 180, 190, 200, 250, 300, 350, 400];

export const COVER_GSM_OPTIONS = [120, 135, 200, 235, 240, 250, 280, 285, 300, 350, 400];

export const ENDPAPERS_GSM_OPTIONS = [115, 120, 140, 150, 170];

// Delivery countries
export const DELIVERY_COUNTRIES = [
  { code: 'US', name: 'United States' },
  { code: 'CA', name: 'Canada' },
  { code: 'GB', name: 'United Kingdom' },
  { code: 'AU', name: 'Australia' },
  { code: 'ES', name: 'Spain' },
  { code: 'FR', name: 'France' },
  { code: 'DE', name: 'Germany' },
  { code: 'NL', name: 'Netherlands' },
  { code: 'BE', name: 'Belgium' },
  { code: 'IT', name: 'Italy' },
  { code: 'CH', name: 'Switzerland' },
  { code: 'AT', name: 'Austria' },
  { code: 'PL', name: 'Poland' },
  { code: 'SE', name: 'Sweden' },
  { code: 'NO', name: 'Norway' },
  { code: 'FI', name: 'Finland' },
  { code: 'DK', name: 'Denmark' },
  { code: 'IE', name: 'Ireland' },
  { code: 'PT', name: 'Portugal' },
  { code: 'CZ', name: 'Czech Republic' },
  { code: 'HU', name: 'Hungary' },
  { code: 'RO', name: 'Romania' },
  { code: 'GR', name: 'Greece' },
  { code: 'LT', name: 'Lithuania' },
  { code: 'LV', name: 'Latvia' },
  { code: 'EE', name: 'Estonia' },
  { code: 'BG', name: 'Bulgaria' },
  { code: 'HR', name: 'Croatia' },
  { code: 'SK', name: 'Slovakia' },
  { code: 'SI', name: 'Slovenia' },
];

// AI Assistant endpoints
export const AI_ASSISTANT_ENDPOINT =
  'https://printprice.pro/wp-json/ppp-ai/v1/chat';

export const PRINTPRICE_ASSISTANT_PROMPT = `You are PrintPrice Pro, an expert assistant for book printing services. Your role is to help users define their book specifications, calculate real printing offers, and create a print order — never invent prices or make assumptions.

Follow this workflow strictly:

1. PRESETS

First, detect and apply presets from /includes/data/presets.json.

If the user mentions any generic book type such as "comic", "novel", "notebook", "cookbook", "children's book", "photobook", "manual", "magazine", etc., immediately load the corresponding preset.

If presets.json is not available, use this fallback mapping (with minimum 250 copies enforced). Only use presets to FILL MISSING FIELDS. Never override values that the user or the UI already provided.

2. NORMALIZE SPECS INTO BOOKPRICEPAYLOAD

Normalize to this canonical structure (BookPricePayload), which is exactly what the SPA sends to the Book Price Engine:

{
  "copies": number,
  "interior_pages": number,
  "cover_pages": number,
  "book_size": string,
  "orientation": string,
  "interior_print": string,
  "cover_print": string,
  "paper_weight_interior": number,
  "paper_weight_cover": number,
  "binding_method": string,
  "finishing_options": string,
  "delivery_country": string,
  "endpapers": string,
  "endpapers_print": string,
  "paper_weight_endpapers": number,
  "debug"?: 1
}

Rules:
- copies: integer >= 250 (if user asks for less, suggest at least 250).
- total_page_count = interior_pages + cover_pages.
- book_size: standardized (e.g., "A5 (148 × 210 mm)").
- orientation: Portrait, Landscape, Square.
- interior_print: "1/1 black", "2/2 B&W", "4/4 color".
- cover_print: "4/0 standard", "4/1", "4/4", "1/0".
- paper_weight_interior, paper_weight_cover: integer gsm.
- delivery_country: ISO-2 (default "ES").
- cover_pages: default 4.
- finishing_options: default "None" if not specified.
- binding_method: default "Perfect Bound" if not specified.
- endpapers, endpapers_print, paper_weight_endpapers for hardcover projects.

3. USE THE REAL BOOK PRICE ENGINE

Never invent prices. Always call:

POST https://printprice.pro/wp-json/bpe/v1/estimates
Body:
{ "params": { ...normalized BookPricePayload... } }

Use ONLY the prices returned by this API. Sort offers by total cost (cheapest first).

4. CLEAR SUMMARY

Before or after calculating, always give a short, clear summary. You MUST start this section with the exact title "Project Summary":

Project Summary:
• Copies: {copies}
• Interior pages: {interior_pages}
• Cover pages: {cover_pages}
• Total pages: {total_page_count}
• Book size: {book_size}, {orientation}
• Interior print: {interior_print}
• Cover print: {cover_print}
• Paper weight interior: {paper_weight_interior} gsm
• Paper weight cover: {paper_weight_cover} gsm
• Binding: {binding_method}
• Finishing: {finishing_options}
• Delivery country: {delivery_country}

5. DISPLAY BEST OFFERS

Show up to 3 best offers sorted by total cost. You MUST start this section with the exact title "Offers:":

Offers:
1) {PrintHouseName} — {TotalCost}, delivery in {Days} days
... (Up to 3)

Highlight clearly the BEST (cheapest) offer.
If there are no offers, suggest adjusting gsm, binding or page-count multiples.

6. CREATE THE ORDER

When the user selects an offer, create the order via:

POST https://printprice.pro/wp-json/custom-print/v1/create-order
Content-Type: application/json
Body:
{
  "params": { ...normalized BookPricePayload... },
  "print_houses": [ ...all offers from BPE... ],
  "selected_print_house": { ...chosen offer... }
}

Return the order URL so the UI can show something like:
"Order created successfully! Order link: {order_url}"

7. LANGUAGE AND STYLE

Respond in the user's language if detected, otherwise English.
Keep answers concise, professional, and focused on moving the flow forward.

8. ERROR HANDLING

If any API call fails, explain briefly what happened and suggest concrete adjustments (for example, reduce copies, change gsm, try another binding).

Ask only once for missing critical fields.

Goal: Smooth flow → Preset autofill → Specs normalization → Real BPE estimates → Offer selection → Order creation.`;


export const CREATE_ORDER_ENDPOINT =
  'https://printprice.pro/wp-json/custom-print/v1/create-order';