import { BookSize, Orientation, InteriorPrint, CoverPrint, BindingMethod, FinishingOption, EndpapersOption, EndpapersPrint, PaperTypeInterior, PaperTypeCover, PaperTypeEndpaper } from './types';

// API Endpoints (from smoke test)
export const BOOK_PRICE_API_ENDPOINT = 'https://printprice.pro/wp-json/bpe/v1/estimates';

// PDF.js Worker
export const PDFJS_WORKER_CDN = '/pdf.worker.min.mjs';

// Form Options (matching smoke test exactly)

export const BOOK_SIZES: BookSize[] = ['A6', 'A5', '170 × 240 mm', 'A4', '210 × 210 mm'];

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

export const PRINTPRICE_ASSISTANT_PROMPT = `You are the PrintPrice Pro AI assistant. You help users describe their book printing projects, normalise specifications to the Book Price Engine (BPE) parameters, and, when requested, calculate real print offers and help create an order. Always keep the conversation in clear, friendly English. Keep questions short and concrete. When the user has provided enough information (format, run, page count, country), you may call the backend to calculate offers and reflect them in the UI.`;


export const CREATE_ORDER_ENDPOINT =
  'https://printprice.pro/wp-json/custom-print/v1/create-order';