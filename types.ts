// ---- BPE Marketplace Native Contract (v5.2) ----

export type BookSize = 
  | 'A4' | 'A5' | 'A6' 
  | '170 x 240 mm' | '200 x 200 mm' | '220 x 220 mm' 
  | 'Custom';

export type Orientation = 'portrait' | 'landscape';

export type InteriorPrint = '4/4' | '2/2' | '1/1';

export type CoverPrint = '4/0' | '4/4' | '1/0';

export type BindingMethod = 
  | 'perfect_bound' 
  | 'thread_sewn_sc' 
  | 'thread_sewn_hc' 
  | 'saddle_stitch' 
  | 'wire_o' 
  | 'flexibound';

export type FinishingOption = 
  | 'gloss_lam' 
  | 'matt_lam' 
  | 'matt_lam_scratch' 
  | 'soft_touch' 
  | '';

export type EndpapersOption = 'none' | 'standard';

export type EndpapersPrint = '' | '1/0' | '4/0' | '1/1' | '4/4';

export type PaperTypeInterior = 'offset' | 'mc' | 'lux' | 'munken' | 'other';

export type PaperTypeCover = 'mc' | 'artboard' | 'offset' | 'wfmc' | 'other' | 'none';

export type PaperTypeEndpaper = 'offset' | 'mc' | 'other' | 'none';

/**
 * The core specification payload for the Book Price Engine.
 * Must match the BPE contract exactly.
 */
export interface BookPricePayload {
  copies: number;
  interior_pages: number;
  cover_pages: number;
  book_size: BookSize;
  orientation: Orientation;
  delivery_country: string;
  total_page_count?: number;
  interior_print: InteriorPrint;
  cover_print: CoverPrint;
  cover_print_rev: number;
  paper_type_interior: PaperTypeInterior;
  paper_weight_interior: number;
  paper_type_cover: PaperTypeCover;
  paper_weight_cover: number;
  paper_type_endpaper: PaperTypeEndpaper;
  paper_weight_endpapers: number;
  pms_interior: number;
  pms_cover: number;
  binding_method: BindingMethod;
  finishing_options: FinishingOption;
  uv_varnish: boolean;
  endpapers: EndpapersOption;
  endpapers_print: EndpapersPrint;
  custom_width?: number;
  custom_height?: number;
  extra_book?: number;
  extra_section?: number;
  extra_fixed?: number;
  extra_variable?: number;
  interior_pdf_url?: string;
  cover_pdf_url?: string;

  // Security / debug
  hp_field?: string;
  submission_token?: string;
  debug?: 1;
}

/**
 * Initial payload used for form defaults and reset.
 */
export interface InitialBookPricePayload extends BookPricePayload {}

export interface BreakdownLine {
  label: string;
  amount: number;
}

export type CostBreakdown = BreakdownLine[];

export type OfferSource =
  | 'BPE_MARKETPLACE_NATIVE'
  | 'BPE_LEGACY'
  | 'APP'
  | 'UNKNOWN'
  | (string & {});

export interface BookPriceOffer {
  id: string;
  offer_id?: string;

  // Marketplace / printhouse identity
  house_id?: string;
  printer_id?: string;
  print_house_id?: string;
  print_house: string;

  // Pricing
  total_price: number;
  total_cost: number;
  currency: string;
  margin?: number;
  margin_percent?: number;

  // Delivery
  lead_time_days: number;
  estimated_delivery_time: string;

  // Details
  breakdown: CostBreakdown;

  // Semantics
  checkout_allowed?: boolean;
  recommended?: boolean;
  selected_by_customer?: boolean;

  // Source / status
  source?: OfferSource;
  range?: string;
  message?: string;
  status?: string;

  // Preserve original BPE offer for Control Plane metadata
  raw_offer?: any;
}

export interface BookPriceResponse {
  success: boolean;
  offers: BookPriceOffer[];
  recommended_offer_id?: string | null;
  raw_recommended_offer_id?: string | null;
  message?: string;
  raw_response?: any;
}

// ---- Production Files System (v5.3) ----

export type ProductionFileKind = 'INTERIOR_PDF' | 'COVER_SPINE_BACK_PDF';

export type ProductionFileSourceType = 'UPLOAD' | 'DOWNLOAD_URL';

export type ProductionFileStatus =
  | 'PENDING'
  | 'SELECTED'
  | 'LINK_PROVIDED'
  | 'LINK_PENDING_FETCH'
  | 'FETCHING'
  | 'UPLOADING'
  | 'UPLOADED'
  | 'VALIDATING'
  | 'VALIDATED'
  | 'REJECTED'
  | 'ERROR';

export interface ProductionFileMetadata {
  kind: ProductionFileKind;
  source_type: ProductionFileSourceType;
  filename?: string;
  size_bytes?: number;
  mime_type?: string;
  status: ProductionFileStatus;
  checksum?: string;
  storage_url?: string;
  file_id?: string;
  repository_id?: string;
  repository_path?: string;
  download_url?: string;
  download_url_host?: string;
  ingestion_status?: 'NOT_STARTED' | 'QUEUED' | 'FETCHED' | 'FAILED';
  fetched_at?: string;
  validated_at?: string;
  error?: string;
}

export interface ProductionFileDraft {
  kind: ProductionFileKind;
  status: ProductionFileStatus;
  source_type?: ProductionFileSourceType;
  file?: File;
  filename?: string;
  size_bytes?: number;
  mime_type?: string;
  download_url?: string;
  download_url_host?: string;
  ingestion_status?: 'NOT_STARTED' | 'QUEUED' | 'FETCHED' | 'FAILED';
  fetched_at?: string;
  checksum?: string;
  error?: string;
}

export interface ProductionFilesState {
  interior_pdf: ProductionFileDraft;
  cover_spine_back_pdf: ProductionFileDraft;
}

export type ProductionFilesWorkflowStatus =
  | 'FILES_PENDING'
  | 'FILES_SELECTED'
  | 'FILES_FETCH_REQUIRED'
  | 'FILES_MIXED_DECLARED'
  | 'FILES_UPLOADING'
  | 'FILES_UPLOADED'
  | 'FILES_VALIDATING'
  | 'FILES_VALIDATED'
  | 'FILES_REJECTED'
  | 'FILES_ERROR';

/**
 * Reusable metadata structure for production files status.
 */
export interface ProductionFilesOrderMetadata {
  required: boolean;
  status: ProductionFilesWorkflowStatus;
  required_files: ProductionFileKind[];
  interior_pdf?: ProductionFileMetadata;
  cover_spine_back_pdf?: ProductionFileMetadata;
  storage_status?: string;
  server_upload_required?: boolean;
  server_fetch_required?: boolean;
  validation_scope?: string;
  invoice_blocked_until?: string;
}

export type PaymentStatus = 
  | 'PENDING' 
  | 'PAID' 
  | 'FAILED' 
  | 'CANCELLED' 
  | 'REFUNDED';

export type InvoiceStatus =
  | 'PENDING_FILES'
  | 'READY_TO_GENERATE'
  | 'GENERATING'
  | 'GENERATED'
  | 'SENT'
  | 'PAYMENT_PENDING'
  | 'PAID'
  | 'VOID';

export interface InvoicePaymentState {
  invoice_id?: string;
  invoice_url?: string;
  invoice_status: InvoiceStatus;
  payment_status: PaymentStatus;
  payment_method?: string;
  payment_reference?: string;
  currency?: string;
  amount?: number;
  paid_at?: string;
}

export interface CartItem {
  id: string;
  specs: BookPricePayload;
  offer: BookPriceOffer;
  pricing: {
    total_price: number;
    total_cost: number;
    currency: string;
    margin?: number;
    margin_percent?: number;
  };
  allOffers: BookPriceOffer[];
  recommendedOffer?: BookPriceOffer | null;
  recommendedOfferId?: string | null;
  selectedBy: 'CUSTOMER';
  addedAt?: string;
  metadata?: {
    contract?: 'BPE_MARKETPLACE_NATIVE';
    source?: 'PRINTPRICE_APP' | 'PRINTPRICE_CHAT';
    bpe_endpoint?: string;
    payment_status?: PaymentStatus;
    chat_context?: any;
    ui_context?: any;
    production_files?: ProductionFilesOrderMetadata;
    invoice_payment?: InvoicePaymentState;
  };
}

export type ControlPlaneOrderStatus =
  | 'DRAFT'
  | 'QUOTE_ACCEPTED'
  | 'FILES_PENDING'
  | 'FILES_VALIDATED'
  | 'INVOICE_PENDING'
  | 'PAYMENT_PENDING'
  | 'PAYMENT_FAILED'
  | 'CANCELLED'
  | 'READY_FOR_PRINTHOUSE'
  | 'PRODUCTION'
  | 'SHIPPED'
  | 'DELIVERED';

// ---- Control Plane Ordering (v5.3 Hardened) ----

export type OrderSource = 'PRINTPRICE_APP' | 'BPE' | 'CHAT' | 'BOOK_CONFIGURATOR';

export interface ControlPlaneCustomer {
  id: string;
  email?: string;
  name?: string;
  role?: 'AUTHOR' | 'PUBLISHER' | 'AGENCY' | 'PRINTHOUSE' | 'UNKNOWN';
  billing?: Record<string, unknown>;
  delivery?: Record<string, unknown>;
}

export interface ControlPlaneOrderPayload {
  source: OrderSource;
  source_ref: string;
  order_ref: string;
  user_id: string;

  customer: ControlPlaneCustomer;

  specs: BookPricePayload;

  pricing: {
    currency: string;
    selected_by: 'CUSTOMER';
    customer_selected_offer_id?: string;
    recommended_offer_id?: string | null;
    total_price: number;
    total_cost?: number;
    margin?: number;
    margin_percent?: number;
  };

  delivery: {
    country: string;
    lead_time_days?: number;
    estimated_delivery_time?: string;
  };

  metadata_json: {
    contract: 'BPE_MARKETPLACE_NATIVE';
    app: 'PrintPricePro_BookPrice';
    bpe_endpoint: '/api/marketplace/offers';
    payment_status: PaymentStatus;
    customer_selected_offer: BookPriceOffer;
    bpe_recommended_offer?: BookPriceOffer | null;
    offers_snapshot: BookPriceOffer[];
    chat_context?: Record<string, unknown>;
    ui_context?: Record<string, unknown>;
    production_files?: ProductionFilesOrderMetadata;
    invoice_payment?: InvoicePaymentState;
  };

  status: ControlPlaneOrderStatus;
}
