import { BookSize, Orientation, InteriorPrint, CoverPrint, BindingMethod, FinishingOption, EndpapersOption, EndpapersPrint } from './types';

// API Endpoints
export const BOOK_PRICE_API_ENDPOINT = 'https://printprice.pro/wp-json/bpe/v1/estimates';

// PDF.js Worker
export const PDFJS_WORKER_CDN = '/pdf.worker.min.mjs';

// Form Options
export const BOOK_SIZES: BookSize[] = ['A3', 'A4', 'A5', 'A6', 'B4', 'B5', 'B6', 'Custom'];
export const ORIENTATIONS: Orientation[] = ['Portrait', 'Landscape'];
export const INTERIOR_PRINT_OPTIONS: InteriorPrint[] = ['4/4', '1/1', 'Black and White', 'Color'];
export const COVER_PRINT_OPTIONS: CoverPrint[] = ['4/0', '4/4', '1/0', 'Color Front Only', 'Color Both Sides', 'Black Front Only'];
export const BINDING_METHODS: BindingMethod[] = ['Perfect Bound', 'Hardcover', 'Saddle Stitch', 'Wire-O', 'Spiral'];
export const FINISHING_OPTIONS: FinishingOption[] = ['Gloss lam.', 'Matt lam.', 'Soft Touch', 'UV Spot', 'Foil'];
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
  { code: 'HU', 'name': 'Hungary' },
  { code: 'RO', 'name': 'Romania' },
  { code: 'GR', 'name': 'Greece' },
  { code: 'LT', 'name': 'Lithuania' },
  { code: 'LV', 'name': 'Latvia' },
  { code: 'EE', 'name': 'Estonia' },
  { code: 'BG', 'name': 'Bulgaria' },
  { code: 'HR', 'name': 'Croatia' },
  { code: 'SK', 'name': 'Slovakia' },
  { code: 'SI', 'name': 'Slovenia' },
];

export const ENDPAPERS_OPTIONS: EndpapersOption[] = ['None', 'White', 'Black', 'Custom'];
export const ENDPAPERS_PRINT_OPTIONS: EndpapersPrint[] = ['4/4', '1/1', 'None'];

export const AI_ASSISTANT_ENDPOINT =
  'https://printprice.pro/wp-json/printprice-ai/v1/chat';

export const PRINTPRICE_ASSISTANT_PROMPT = `You are the PrintPrice Pro AI assistant. You help users describe their book printing projects, normalise specifications to the Book Price Engine (BPE) parameters, and, when requested, calculate real print offers and help create an order. Always keep the conversation in clear, friendly English. Keep questions short and concrete. When the user has provided enough information (format, run, page count, country), you may call the backend to calculate offers and reflect them in the UI.`;

export const CREATE_ORDER_ENDPOINT =
  'https://printprice.pro/wp-content/plugins/print-price-pro-corrected/includes/api/create-order-from-chat-endpoint.php';