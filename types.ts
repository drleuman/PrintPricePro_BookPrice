// --- General UI Types ---
// Keeping only types relevant to general UI, removed preflight specific ones.

// --- Book Price Engine Types (from Context 2 / Smoke Test) ---

// Define allowed string literal types for select fields for better type safety
export type BookSize = 'A3' | 'A4' | 'A5' | 'A6' | 'B4' | 'B5' | 'B6' | 'Custom';
export type Orientation = 'Portrait' | 'Landscape';
export type InteriorPrint = '4/4' | '1/1' | 'Black and White' | 'Color'; // Added common aliases
export type CoverPrint = '4/0' | '4/4' | '1/0' | 'Color Front Only' | 'Color Both Sides' | 'Black Front Only'; // Added common aliases
export type BindingMethod = 'Perfect Bound' | 'Hardcover' | 'Saddle Stitch' | 'Wire-O' | 'Spiral'; // Expanded options
export type FinishingOption = 'Gloss lam.' | 'Matt lam.' | 'Soft Touch' | 'UV Spot' | 'Foil'; // Expanded options
export type EndpapersOption = 'None' | 'White' | 'Black' | 'Custom';
export type EndpapersPrint = '4/4' | '1/1' | 'None'; // Example, could be more specific

export interface InitialBookPricePayload {
  copies: number;
  total_page_count: number;
  interior_pages: number;
  cover_pages: number; // Assumed 4
  book_size: BookSize;
  orientation: Orientation;
  interior_print: InteriorPrint;
  cover_print: CoverPrint;
  paper_weight_interior: number; // in gsm
  paper_weight_cover: number; // in gsm
  binding_method: BindingMethod;
  finishing_options: FinishingOption[]; // Array for multi-select
  delivery_country: string; // ISO2 code, e.g., 'US', 'ES'
  endpapers: EndpapersOption;
  endpapers_print: EndpapersPrint;
  paper_weight_endpapers: number; // in gsm
}

// Actual payload sent to API, finishing_options is a string
export interface BookPricePayload {
  copies: number;
  interior_pages: number;
  cover_pages: number;
  book_size: BookSize;
  orientation: Orientation;
  interior_print: InteriorPrint;
  cover_print: CoverPrint;
  paper_weight_interior: number;
  paper_weight_cover: number;
  binding_method: BindingMethod;
  finishing_options: string; // Comma-separated string for API
  delivery_country: string;
  endpapers: EndpapersOption;
  endpapers_print: EndpapersPrint;
  paper_weight_endpapers: number;
  debug?: 1; // Optional debug field from smoke test
}

export interface CostBreakdown {
  printing: number;
  paper: number;
  binding: number;
  finishing: number;
  delivery: number;
  other?: number;
}

export interface BookPriceOffer {
  id: string;
  print_house: string;
  total_cost: number;
  estimated_delivery_time: string; // e.g., "5-7 business days"
  breakdown: CostBreakdown;
  currency: string;
}

export interface BookPriceResponse {
  success: boolean;
  message?: string;
  offers: BookPriceOffer[];
}
