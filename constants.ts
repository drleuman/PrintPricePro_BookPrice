import { BookSize, Orientation, InteriorPrint, CoverPrint, BindingMethod, FinishingOption, EndpapersOption, EndpapersPrint, PaperTypeInterior, PaperTypeCover, PaperTypeEndpaper } from './types';

// --- API Endpoints ---
// Forzamos siempre producción en printprice.pro para evitar problemas
// cuando la SPA está alojada en otro dominio (AI Studio, bucket, etc.).
export const BOOK_PRICE_API_ENDPOINT = '/api/budget/calculate';


// Form Options (matching smoke test exactly)

export const BOOK_SIZES_PORTRAIT: string[] = [
  'A5',
  'A4',
  '170 x 240 mm',
  '200 x 200 mm',
  '220 x 220 mm',
  'Custom',
];

export const BOOK_SIZES_LANDSCAPE: string[] = [
  'A5',
  'A4',
  '170 x 240 mm',
  '200 x 200 mm',
  '220 x 220 mm',
  'Custom',
];

export const COVER_PAGES_OPTIONS = [2, 4, 6, 8];
export const PMS_OPTIONS = [0, 1, 2, 3];

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
  { value: 'flexibound', label: 'Flexibound Integral' },
];

// Finishing options (matching smoke test)
export const FINISHING_OPTIONS: { value: FinishingOption; label: string }[] = [
  { value: 'gloss_lam', label: 'Gloss lam.' },
  { value: 'matt_lam', label: 'Matt lam.' },
  { value: 'matt_lam_scratch', label: 'Matt lam. scratch proof' },
  { value: 'soft_touch', label: 'Soft touch' },
  { value: '', label: 'None' },
];

// Endpapers options
export const ENDPAPERS_OPTIONS: { value: EndpapersOption; label: string }[] = [
  { value: 'none', label: 'None' },
  { value: 'standard', label: 'Standard' },
];

export const ENDPAPERS_PRINT_OPTIONS: { value: EndpapersPrint; label: string }[] = [
  { value: '', label: 'None' },
  { value: '1/0', label: '1/0' },
  { value: '4/0', label: '4/0' },
  { value: '1/1', label: '1/1' },
  { value: '4/4', label: '4/4' },
];

// GSM options (extended from smoke test)
export const INTERIOR_GSM_OPTIONS = [70, 80, 90, 100, 115, 120, 135, 140, 150, 160, 170, 180, 190, 200, 250, 300, 350, 400];

export const COVER_GSM_OPTIONS = [120, 135, 200, 235, 240, 250, 280, 285, 300, 350, 400];

export const ENDPAPERS_GSM_OPTIONS = [115, 120, 140, 150, 170];

// Custom dimension validation ranges
export interface DimensionRange {
  wMin: number;
  wMax: number;
  hMin: number;
  hMax: number;
}

export const DIMENSION_RANGES: Record<Orientation, DimensionRange[]> = {
  portrait: [
    { wMin: 100, wMax: 105, hMin: 120, hMax: 148 },
    { wMin: 106, wMax: 119, hMin: 149, hMax: 166 },
    { wMin: 120, wMax: 150, hMin: 167, hMax: 214 },
    { wMin: 151, wMax: 170, hMin: 167, hMax: 245 },
    { wMin: 175, wMax: 214, hMin: 250, hMax: 302 },
    { wMin: 175, wMax: 245, hMin: 303, hMax: 340 },
    { wMin: 160, wMax: 214, hMin: 170, hMax: 200 },
    { wMin: 120, wMax: 150, hMin: 246, hMax: 289 },
    { wMin: 175, wMax: 245, hMin: 201, hMax: 220 },
    { wMin: 120, wMax: 167, hMin: 290, hMax: 325 },
    { wMin: 250, wMax: 287, hMin: 250, hMax: 300 },
    { wMin: 288, wMax: 297, hMin: 301, hMax: 340 }
  ],
  landscape: [
    { wMin: 150, wMax: 214, hMin: 120, hMax: 148 },
    { wMin: 215, wMax: 245, hMin: 149, hMax: 167 },
    { wMin: 250, wMax: 297, hMin: 160, hMax: 212 },
    { wMin: 297, wMax: 297, hMin: 215, hMax: 240 },
    { wMin: 160, wMax: 214, hMin: 170, hMax: 200 },
    { wMin: 120, wMax: 150, hMin: 246, hMax: 289 },
    { wMin: 175, wMax: 245, hMin: 201, hMax: 220 },
    { wMin: 120, wMax: 167, hMin: 290, hMax: 325 },
    { wMin: 250, wMax: 287, hMin: 250, hMax: 300 },
    { wMin: 288, wMax: 297, hMin: 301, hMax: 340 }
  ],
};

export const DIMENSION_HINTS: Record<Orientation, string> = {
  portrait: '100–105 × 120–148, 106–119 × 149–166, 120–150 × 167–214, 151–170 × 167–245, 175–214 × 250–302, 175–245 × 303–340, 160–214 × 170–200, 120–150 × 246–289, 175–245 × 201–220, 120–167 × 290–325, 250–287 × 250–300, 288–297 × 301–340.',
  landscape: '150–214 × 120–148, 215–245 × 149–167, 250–297 × 160–212, 297–297 × 215–240, 160–214 × 170–200, 120–150 × 246–289, 175–245 × 201–220, 120–167 × 290–325, 250–287 × 250–300, 288–297 × 301–340.',
};

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
export const AI_ASSISTANT_ENDPOINT = '/api/ai/chat';

export const PRINTPRICE_ASSISTANT_PROMPT = `You are PrintPrice Pro AI Assistant.

- Output ONLY a single VALID JSON object.
- No Markdown, no code fences, no extra text, no explanations outside JSON.
- Always include: "reply" (string) and "specs_patch" (object).
- "specs_patch" MUST include ONLY fields that the user explicitly changed or requested in their last message.
- "specs_patch" is your MOST IMPORTANT output. If the user mentions a specification (copies, pages, size, binding, country), you MUST update it in "specs_patch".

STRICT RULES:
1. NEVER copy values from "ui_state" into "specs_patch" unless the user explicitly confirmed them in the last message.
2. If the user says "500 copies", but ui_state says 1000, your specs_patch MUST be {"copies": 500}.
3. The user's latest message ALWAYS takes priority over EVERYTHING.
4. If you are unsure, default to what the user said, NOT the ui_state.
5. If interior_pages is missing or 0, ask: "How many interior pages?". Set ui.show_offers=false and do NOT return offers.

RESPONSE FORMAT (ALWAYS):
{
  "reply": "string (including Project Summary)",
  "specs_patch": { "field": "new_value" },
  "ui": { "show_offers": boolean, "recommended_offer_ids": [] }
}

ALLOWED FIELD NAMES:
copies, interior_pages, cover_pages, book_size, orientation, delivery_country, interior_print, cover_print, cover_print_rev, paper_type_interior, paper_weight_interior, paper_type_cover, paper_weight_cover, paper_type_endpaper, paper_weight_endpapers, pms_interior, pms_cover, binding_method, finishing_options, uv_varnish, endpapers, endpapers_print, extra_book, extra_section, extra_fixed, extra_variable

STRICT VALUE MAPPING (Internal Enums):
- book_size: Use the EXACT string from the list. 
  Portrait/Landscape: "A6", "A5", "A4", "170 x 240 mm", "200 x 200 mm", "220 x 220 mm", "Custom"
- orientation: "portrait", "landscape"
- interior_print: "4/4", "2/2", "1/1"
- cover_print: "4/0", "4/4", "1/0"
- binding_method: "perfect_bound", "thread_sewn_sc", "thread_sewn_hc", "saddle_stitch", "wire_o", "flexibound"
- finishing_options: "gloss_lam", "matt_lam", "soft_touch", "matt_lam_scratch", ""
- endpapers: "none", "standard"
- endpapers_print: "", "1/0", "4/0", "1/1", "4/4"
- delivery_country: ISO-2 code ONLY (e.g. "ES", "DE", "GB", "US")

NORMALIZATION RULES (Internal use):
- "hardcover" -> binding_method="thread_sewn_hc", endpapers="standard"
- "softcover" -> binding_method="perfect_bound", endpapers="none"
- "black and white" -> interior_print="1/1"
- "color" -> interior_print="4/4"
- "Germany" -> delivery_country="DE"
- "United Kingdom" or "UK" -> delivery_country="GB"

REPLY REQUIREMENT:
Your reply MUST start with a friendly acknowledgement, then EXACTLY:
"Project Summary:
• Copies: [value]
• Size: [value]
• Binding: [value]
• Interior print: [value]
• Cover print: [value]
• Delivery: [value]"

FINAL CHECK: Ensure all numbers are integers in JSON. Ensure specs_patch is NEVER empty if the user requested a change.`;


