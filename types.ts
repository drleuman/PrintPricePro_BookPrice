// --- Book Price Engine Types (from Smoke Test) ---

// Paper types
export type PaperTypeInterior = 'offset' | 'mc' | 'lux' | 'munken' | 'other';
export type PaperTypeCover = 'mc' | 'artboard' | 'offset' | 'wfmc' | 'other' | 'none';
export type PaperTypeEndpaper = 'offset' | 'mc' | 'other' | 'none';

// Book specifications
export type BookSize = string;
export type Orientation = 'portrait' | 'landscape';
export type InteriorPrint = '4/4' | '2/2' | '1/1';
export type CoverPrint = '4/0' | '4/4' | '1/0';
export type BindingMethod = 'perfect_bound' | 'thread_sewn_sc' | 'thread_sewn_hc' | 'saddle_stitch' | 'wire_o' | 'flexibound';
export type FinishingOption = 'gloss_lam' | 'matt_lam' | 'soft_touch' | 'matt_lam_scratch' | '';
export type EndpapersOption = 'none' | 'standard';
export type EndpapersPrint = '' | '1/0' | '4/0' | '1/1' | '4/4';

// Complete payload interface matching smoke test
export interface InitialBookPricePayload {
  // Basic info
  copies: number;
  interior_pages: number;
  cover_pages: number;
  book_size: BookSize;
  orientation: Orientation;
  delivery_country: string; // ISO2 code

  // Custom dimensions (when book_size is "Custom")
  custom_width?: number;
  custom_height?: number;

  // Print options
  interior_print: InteriorPrint;
  cover_print: CoverPrint;
  cover_print_rev: number; // 0-6

  // Paper types
  paper_type_interior: PaperTypeInterior;
  paper_type_cover: PaperTypeCover;
  paper_type_endpaper: PaperTypeEndpaper;

  // Paper weights (gsm)
  paper_weight_interior: number;
  paper_weight_cover: number;
  paper_weight_endpapers: number;

  // PMS colors
  pms_interior: number; // 0-3
  pms_cover: number; // 0-3

  // Binding & finishing
  binding_method: BindingMethod;
  finishing_options: FinishingOption;
  uv_varnish: boolean;

  // Endpapers (for hardcover)
  endpapers: EndpapersOption;
  endpapers_print: EndpapersPrint;

  // Extra costs
  extra_book: number;
  extra_section: number;
  extra_fixed: number;
  extra_variable: number;

  // Security (Anti-Bot)
  hp_field?: string;
  submission_token?: string;

  // Debug
  debug?: 1;
}

// API payload (same structure for this implementation)
export interface BookPricePayload extends InitialBookPricePayload { }

// Response types
export interface BreakdownLine {
  label: string;
  amount: number;
}

export type CostBreakdown = BreakdownLine[];

export interface BookPriceOffer {
  id: string;
  print_house: string;
  total_cost: number;
  estimated_delivery_time: string;
  breakdown: CostBreakdown;
  currency: string;
}

export interface BookPriceResponse {
  success: boolean;
  message?: string;
  offers: BookPriceOffer[];
}
