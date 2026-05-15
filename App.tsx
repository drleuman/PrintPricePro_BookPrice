import React, {
  useState,
  useEffect,
  useCallback,
  useRef,
} from 'react';

// PDF.js (legacy build)
import * as pdfjsLib from 'pdfjs-dist/legacy/build/pdf';
const { getDocument, GlobalWorkerOptions } = pdfjsLib;

// Worker from the same pdfjs-dist version, bundled by Vite
// @ts-ignore
import pdfWorkerSrc from 'pdfjs-dist/build/pdf.worker.min.mjs?url';

import {
  BOOK_PRICE_API_ENDPOINT,
} from './constants';

import {
  InitialBookPricePayload,
  BookPricePayload,
  BookPriceResponse,
  BookPriceOffer,
  CartItem,
  ProductionFileKind,
  ProductionFileDraft,
  ProductionFilesState,
  ProductionFileStatus,
  ProductionFilesWorkflowStatus,
  ProductionFileMetadata,
} from './types';

import { normaliseApiResponse } from './lib/normaliseApiResponse';

import AssistantChat from './components/AssistantChat';
import PdfUploadDropzone from './components/PdfUploadDropzone';
import BookPriceForm from './components/BookPriceForm';
import PrintOffersPanel from './components/PrintOffersPanel';
import CartPanel from './components/CartPanel';
import Header from './components/Header';
import { AuthModal } from './components/UserMenu';
import type { AuthUser } from './components/UserMenu';
import Toast from './components/Toast';
import type { ToastMessage } from './components/Toast';
import ProductionFilesPanel from './components/ProductionFilesPanel';
import CheckoutStepper from './components/CheckoutStepper';
import {
  validateProductionFile,
  validateProductionFileUrl
} from './lib/productionFilesApi';

import { t } from './i18n/en';

// ==== Helpers para extraer info del PDF ====

const PT_TO_MM = 25.4 / 72; // 1 punto PDF = 1/72 inch

// Tabla sencilla de tamaños que reconoce tu app (BookSize)
const KNOWN_SIZES = [
  { code: 'A4', width: 210, height: 297 },
  { code: 'A5', width: 148, height: 210 },
  { code: 'A6', width: 105, height: 148 },
  { code: '170 x 240 mm', width: 170, height: 240 },
  { code: '200 x 200 mm', width: 200, height: 200 },
  { code: '220 x 220 mm', width: 220, height: 220 },
] as const;

function inferSizeAndOrientationFromPage(page: any) {
  const viewport = page.getViewport({ scale: 1 });

  const widthPt = viewport.width;
  const heightPt = viewport.height;

  const widthMm = widthPt * PT_TO_MM;
  const heightMm = heightPt * PT_TO_MM;

  const orientation = widthMm >= heightMm ? 'landscape' : 'portrait';

  const shortSide = Math.min(widthMm, heightMm);
  const longSide = Math.max(widthMm, heightMm);

  let bestMatch: string = 'A5'; // Default to A5

  let bestDiff = Infinity;

  for (const size of KNOWN_SIZES) {
    const sShort = Math.min(size.width, size.height);
    const sLong = Math.max(size.width, size.height);
    const diff =
      Math.abs(shortSide - sShort) + Math.abs(longSide - sLong);
    if (diff < bestDiff) {
      bestDiff = diff;
      bestMatch = size.code;
    }
  }

  return {
    widthMm,
    heightMm,
    orientation, // "portrait" | "landscape" (lowercase)
    book_size: bestMatch,
  };
}

async function detectPageIsColor(page: any): Promise<boolean> {
  const viewport = page.getViewport({ scale: 0.5 }); // bajar un poco para no matar la CPU
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  if (!ctx) return true; // si no podemos analizar, asumimos color

  canvas.width = viewport.width;
  canvas.height = viewport.height;

  await page.render({ canvasContext: ctx, viewport }).promise;

  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const data = imageData.data;

  const step = 16; // muestreo → cada 16 píxeles
  for (let i = 0; i < data.length; i += 4 * step) {
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];
    // Si R,G,B no son iguales → hay color
    if (!(r === g && g === b)) {
      return true;
    }
  }
  return false;
}

// Security Layer 2: Challenge Context Helper (v5.2)
async function getPayloadContext(data: any) {
  // Use core fields that define the pricing model to bind the token
  const coreFields = [data.copies, data.interior_pages, data.book_size];
  const msgUint8 = new TextEncoder().encode(JSON.stringify(coreFields));
  const hashBuffer = await window.crypto.subtle.digest('SHA-256', msgUint8);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

const initialFileDraft = (kind: ProductionFileKind): ProductionFileDraft => ({
  kind,
  status: 'PENDING',
});

const toProductionFileMetadata = (
  draft: ProductionFileDraft,
  kind: ProductionFileKind
): ProductionFileMetadata => ({
  kind,
  source_type: draft.source_type,
  filename: draft.filename,
  size_bytes: draft.size_bytes,
  mime_type: draft.mime_type,
  status: draft.status,
  download_url: draft.download_url,
  download_url_host: draft.download_url_host,
  ingestion_status: draft.ingestion_status,
  checksum: draft.checksum,
  error: draft.error,
});

const App: React.FC = () => {
  const [isAdmin, setIsAdmin] = useState(false);
  const [user, setUser] = useState<AuthUser | null>(null);
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [pdfFile, setPdfFile] = useState<File | null>(null);
  const [pageCount, setPageCount] = useState<number>(0);
  const [payloadVersion, setPayloadVersion] = useState(0);

  const [isDark, setIsDark] = useState(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('theme') === 'dark';
    }
    return false;
  });

  // Sync theme with DOM
  useEffect(() => {
    if (isDark) {
      document.documentElement.classList.add('dark');
      localStorage.setItem('theme', 'dark');
    } else {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('theme', 'light');
    }
  }, [isDark]);

  const [bookPricePayload, setBookPricePayload] =
    useState<InitialBookPricePayload>({
      // Basic info
      copies: 1000,
      interior_pages: 120,
      cover_pages: 4,
      book_size: 'A5',
      orientation: 'portrait',
      delivery_country: 'ES',

      // Print options
      interior_print: '4/4',
      cover_print: '4/0',
      cover_print_rev: 0,

      // Paper types
      paper_type_interior: 'offset',
      paper_type_cover: 'artboard',
      paper_type_endpaper: 'offset',

      // Paper weights (gsm)
      paper_weight_interior: 100,
      paper_weight_cover: 240,
      paper_weight_endpapers: 140,

      // PMS colors
      pms_interior: 0,
      pms_cover: 0,

      // Binding & finishing
      binding_method: 'flexibound',
      finishing_options: 'matt_lam_scratch',
      uv_varnish: false,

      // Endpapers
      endpapers: 'none',
      endpapers_print: '',

      // Extra costs
      extra_book: 0,
      extra_section: 0,
      extra_fixed: 0,
      extra_variable: 0,
    });

  const [offers, setOffers] = useState<BookPriceResponse | null>(null);
  const [loadingPdf, setLoadingPdf] = useState<boolean>(false);
  const [loadingOffers, setLoadingOffers] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const [creatingOrder, setCreatingOrder] = useState(false);
  const [orderError, setOrderError] = useState<string | null>(null);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [orderSuccess, setOrderSuccess] = useState<string | null>(null);
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [toasts, setToasts] = useState<ToastMessage[]>([]);
  const toastIdRef = useRef(0);

  // ---- Production Files State (v5.3) ----
  const [productionFiles, setProductionFiles] = useState<ProductionFilesState>({
    interior_pdf: initialFileDraft('INTERIOR_PDF'),
    cover_spine_back_pdf: initialFileDraft('COVER_SPINE_BACK_PDF')
  });


  const addToast = useCallback((msg: Omit<ToastMessage, 'id'>) => {
    const id = ++toastIdRef.current;
    setToasts(prev => [...prev, { ...msg, id }]);
  }, []);

  const dismissToast = useCallback((id: number) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);
  const offersRef = useRef<HTMLDivElement>(null);
  const productionFilesRef = useRef<HTMLDivElement>(null);

  // Warmup Security Bridge (v5.2)
  useEffect(() => {
    const warmup = async () => {
      try {
        await fetch('/api/security/challenge', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ payload_context: 'warmup' })
        });
        console.log("🛡️ Infrastructure Safeguard Active. Assistant Bridge ready.");
      } catch (e) {
        console.warn('Fail-closed safeguard warmup delay.', e);
      }
    };
    warmup();
  }, []);

  // Configurar worker de PDF.js con la URL generada por Vite (misma versión que la API)
  useEffect(() => {
    try {
      (GlobalWorkerOptions as any).workerSrc = pdfWorkerSrc;
    } catch (e) {
      console.warn('Failed to configure PDF.js worker source', e);
    }

    // Check for admin param
    const params = new URLSearchParams(window.location.search);
    if (params.get('admin') === 'true') {
      setIsAdmin(true);
    }
  }, []);

  // Drag & drop / selección de PDF
  const handleFileSelect = useCallback(async (file: File | null) => {
    if (!file) {
      setPdfFile(null);
      setPageCount(0);
      setOffers(null);
      setError(null);
      setBookPricePayload((prev) => ({
        ...prev,
        total_page_count: 0,
        interior_pages: 0,
      }));
      return;
    }

    setPdfFile(file);
    setLoadingPdf(true);
    setOffers(null);
    setError(null);

    try {
      const arrayBuffer = await file.arrayBuffer();
      const pdf: any = await getDocument({ data: arrayBuffer }).promise;

      const numPages = pdf.numPages || 0;
      setPageCount(numPages);

      // Primera página para inferir tamaño, orientación y color
      const firstPage = await pdf.getPage(1);
      const sizeInfo = inferSizeAndOrientationFromPage(firstPage);
      const isColor = await detectPageIsColor(firstPage);

      setBookPricePayload((prev) => ({
        ...prev,
        total_page_count: numPages,
        interior_pages: Math.max(numPages - 4, 0),
        book_size: sizeInfo.book_size as any,           // "A4", "A5", "Custom", etc.
        orientation: sizeInfo.orientation as any,       // "Portrait" | "Landscape"
        interior_print: (isColor ? '4/4' : '1/1') as any, // color vs B/N
        // La cubierta la dejamos como está (4/0) de momento
      }));
      setPayloadVersion(v => v + 1);
    } catch (err) {
      console.error('Error loading PDF:', err);
      setError(t('pdf_load_error_message'));
      setPageCount(0);
    } finally {
      setLoadingPdf(false);
    }
  }, []);

  const handlePayloadChange = useCallback(
    (payload: InitialBookPricePayload) => {
      setBookPricePayload(payload);
    },
    []
  );


  // Construir payload para BPE / create-order
  const buildBookPricePayload = useCallback((): BookPricePayload => {
    const interiorPagesRaw = Number(bookPricePayload.interior_pages);
    const interiorPages = Number.isFinite(interiorPagesRaw)
      ? interiorPagesRaw
      : 0;

    // Validate PMS colors (must be 0 or 1, default to 0 if invalid)
    const validatePMS = (value: number): number => {
      const num = Number(value);
      if (!Number.isFinite(num) || num < 0 || num > 3) {
        return 0; // Default to 0 if invalid
      }
      return Math.floor(num); // Ensure integer
    };

    // Validate paper types (ensure never null or empty)
    const validatePaperType = <T extends string>(value: string | null | undefined, defaultValue: T): T => {
      if (!value || value.trim() === '') {
        return defaultValue;
      }
      return value as T;
    };

    // Validate finishing options (ensure never empty, default to empty string which backend normalizes to 'none')
    const validateFinishing = (value: string | null | undefined): '' | 'gloss_lam' | 'matt_lam' | 'soft_touch' | 'matt_lam_scratch' => {
      if (!value) {
        return '';
      }
      return value as '' | 'gloss_lam' | 'matt_lam' | 'soft_touch' | 'matt_lam_scratch';
    };

    return {
      // Basic info
      copies: bookPricePayload.copies,
      interior_pages: interiorPages,
      cover_pages: bookPricePayload.cover_pages,
      book_size: bookPricePayload.book_size,
      orientation: bookPricePayload.orientation,
      delivery_country: bookPricePayload.delivery_country.trim().toUpperCase(),

      // Print options
      interior_print: bookPricePayload.interior_print,
      cover_print: bookPricePayload.cover_print,
      cover_print_rev: bookPricePayload.cover_print_rev,

      // Paper types (validated to ensure never null/empty)
      paper_type_interior: validatePaperType(bookPricePayload.paper_type_interior, 'offset'),
      paper_type_cover: validatePaperType(bookPricePayload.paper_type_cover, 'mc'),
      paper_type_endpaper: validatePaperType(bookPricePayload.paper_type_endpaper, 'offset'),

      // Paper weights
      paper_weight_interior: bookPricePayload.paper_weight_interior,
      paper_weight_cover: bookPricePayload.paper_weight_cover,
      paper_weight_endpapers: bookPricePayload.paper_weight_endpapers,

      // PMS colors (validated to ensure 1-3)
      pms_interior: validatePMS(bookPricePayload.pms_interior),
      pms_cover: validatePMS(bookPricePayload.pms_cover),

      // Binding & finishing (validated + mapped)
      binding_method: bookPricePayload.binding_method,
      finishing_options: validateFinishing(bookPricePayload.finishing_options),
      uv_varnish: bookPricePayload.uv_varnish,

      // Endpapers
      endpapers: bookPricePayload.endpapers,
      endpapers_print: bookPricePayload.endpapers_print || '',

      // Extra costs
      extra_book: bookPricePayload.extra_book,
      extra_section: bookPricePayload.extra_section,
      extra_fixed: bookPricePayload.extra_fixed,
      extra_variable: bookPricePayload.extra_variable,

      // App metadata
      ...(bookPricePayload.total_page_count !== undefined
        ? { total_page_count: bookPricePayload.total_page_count }
        : {}),

      // Debug (optional)
      ...(bookPricePayload.debug ? { debug: 1 as const } : {}),

      // Custom dimensions (if book_size is "Custom")
      ...(bookPricePayload.book_size === 'Custom' && bookPricePayload.custom_width && bookPricePayload.custom_height
        ? {
          custom_width: bookPricePayload.custom_width,
          custom_height: bookPricePayload.custom_height,
        }
        : {}),
    };
  }, [bookPricePayload]);

  // Botón manual "Calculate Price"
  const handleCalculatePrice = useCallback(async () => {
    setError(null);
    setOffers(null);

    // Guardia: interior_pages válido antes de llamar al BPE
    const interiorPages = Number(bookPricePayload.interior_pages);
    if (!Number.isFinite(interiorPages) || interiorPages <= 0) {
      setError(
        'Please enter a valid number of interior pages before calculating.'
      );
      return;
    }

    setLoadingOffers(true);

    try {
      // 1. Prepare Payload Context for Binding (v5.2)
      const payloadBase = buildBookPricePayload();
      const payloadCtx = await getPayloadContext(payloadBase);

      // 2. Obtain Bound Server Challenge
      const challengeRes = await fetch('/api/security/challenge', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ payload_context: payloadCtx })
      });
      if (!challengeRes.ok) throw new Error('Infrastructure safeguard triggered. Refreshing security context.');
      const { token, nonce, timestamp } = await challengeRes.json();

      // 3. Prepare Final Sealed Payload
      const payloadForApi = {
        ...payloadBase,
        hp_field: (document.getElementById('hp_node') as HTMLInputElement)?.value || '',
        security_token: token,
        nonce,
        timestamp
      };

      // 3. Request Final Calculation
      const response = await fetch(BOOK_PRICE_API_ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payloadForApi),
      });

      if (!response.ok) {
        let message = `HTTP ${response.status}`;
        try {
          const errorData = await response.json();
          if (errorData?.message) message = errorData.message;
          if (errorData?.error) message = errorData.error;
        } catch {
          // ignore JSON parse error
        }
        throw new Error(message || t('api_error_message'));
      }

      const data = await response.json();
      const normalised = normaliseApiResponse(data);

      if (!normalised.offers.length && normalised.message) {
        setError(normalised.message);
      }

      setOffers(normalised);
      setTimeout(() => offersRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 50);
    } catch (err: any) {
      console.error('Error calculating price:', err);
      setError(err?.message || t('api_error_message'));
      setOffers(null);
    } finally {
      setLoadingOffers(false);
    }
  }, [bookPricePayload, buildBookPricePayload]);

  const handleProductionFileSelect = useCallback(async (kind: ProductionFileKind, file: File) => {
    try {
      const { valid, error, metadata } = await validateProductionFile(file, kind);

      if (!valid) {
        addToast({
          variant: 'error',
          title: 'Invalid file',
          body: error === 'INVALID_TYPE_REQUIRED_PDF' ? 'Please select a valid PDF file.' : error,
        });
        setProductionFiles(prev => ({
          ...prev,
          [kind === 'INTERIOR_PDF' ? 'interior_pdf' : 'cover_spine_back_pdf']: {
            ...prev[kind === 'INTERIOR_PDF' ? 'interior_pdf' : 'cover_spine_back_pdf'],
            status: 'ERROR',
            error
          }
        }));
        return;
      }

      setProductionFiles(prev => ({
        ...prev,
        [kind === 'INTERIOR_PDF' ? 'interior_pdf' : 'cover_spine_back_pdf']: {
          kind,
          source_type: 'UPLOAD',
          file,
          filename: metadata?.filename,
          size_bytes: metadata?.size_bytes,
          mime_type: metadata?.mime_type,
          status: 'SELECTED'
        }
      }));

      addToast({
        variant: 'success',
        title: 'File ready',
        body: `${kind === 'INTERIOR_PDF' ? 'Interior' : 'Cover'} PDF ready for intake.`,
      });
    } catch (err) {
      console.error('File validation error:', err);
    }
  }, [addToast]);

  const handleProductionFileUrlSelect = useCallback(async (kind: ProductionFileKind, url: string) => {
    try {
      const { valid, error, metadata } = await validateProductionFileUrl(url, kind);

      if (!valid) {
        addToast({
          variant: 'error',
          title: 'Invalid link',
          body: error === 'SECURE_HTTPS_REQUIRED' ? 'Only secure HTTPS links are allowed.' : 'Please provide a valid download URL.',
        });
        setProductionFiles(prev => ({
          ...prev,
          [kind === 'INTERIOR_PDF' ? 'interior_pdf' : 'cover_spine_back_pdf']: {
            ...prev[kind === 'INTERIOR_PDF' ? 'interior_pdf' : 'cover_spine_back_pdf'],
            status: 'ERROR',
            error
          }
        }));
        return;
      }

      setProductionFiles(prev => ({
        ...prev,
        [kind === 'INTERIOR_PDF' ? 'interior_pdf' : 'cover_spine_back_pdf']: {
          kind,
          source_type: 'DOWNLOAD_URL',
          download_url: metadata?.download_url,
          download_url_host: metadata?.download_url_host,
          status: 'LINK_PROVIDED',
          ingestion_status: 'NOT_STARTED'
        }
      }));

      addToast({
        variant: 'success',
        title: 'Link ready',
        body: `${kind === 'INTERIOR_PDF' ? 'Interior' : 'Cover'} download link declared.`,
      });
    } catch (err) {
      console.error('URL validation error:', err);
    }
  }, [addToast]);

  const handleProductionFileRemove = useCallback((kind: ProductionFileKind) => {
    setProductionFiles(prev => ({
      ...prev,
      [kind === 'INTERIOR_PDF' ? 'interior_pdf' : 'cover_spine_back_pdf']: initialFileDraft(kind)
    }));
  }, []);

  const handleGoToUpload = useCallback(() => {
    setIsCartOpen(false);
    setTimeout(() => {
      productionFilesRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 300);
  }, []);

  const handleChooseOffer = useCallback(async (offer: BookPriceOffer) => {
    if (creatingOrder) return;

    if (offer.checkout_allowed === false) {
      const msg = 'This quote is not precise enough for checkout. Please recalculate or contact support.';
      setOrderError(msg);
      addToast({
        variant: 'error',
        title: 'Quote unavailable',
        body: msg,
      });
      return;
    }

    try {
      setCreatingOrder(true);
      setOrderError(null);

      // Clear current backend cart before adding the new selected offer
      await Promise.all(
        cart.map(item =>
          fetch(`/api/cart/items/${item.id}`, {
            method: 'DELETE',
            credentials: 'include',
          }).catch(() => null)
        )
      );

      const specs = buildBookPricePayload();
      const allOffers = offers?.offers || [];

      const recommendedOffer =
        allOffers.find(o =>
          o.recommended ||
          o.id === offers?.recommended_offer_id ||
          o.offer_id === offers?.recommended_offer_id ||
          o.offer_id === offers?.raw_recommended_offer_id
        ) || null;

      const recommendedOfferId =
        offers?.recommended_offer_id ||
        offers?.raw_recommended_offer_id ||
        recommendedOffer?.offer_id ||
        recommendedOffer?.id ||
        null;

      const pricing = {
        total_price: Number(offer.total_price || offer.total_cost || 0),
        total_cost: Number(offer.total_cost || offer.total_price || 0),
        currency: offer.currency || 'EUR',
        margin: offer.margin || 0,
        margin_percent: offer.margin_percent || 0,
      };

      const response = await fetch('/api/cart/add', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          specs,
          offer: {
            ...offer,
            selected_by_customer: true,
          },
          pricing,
          allOffers,
          recommendedOffer,
          recommendedOfferId,
          selectedBy: 'CUSTOMER',
          metadata: {
            contract: 'BPE_MARKETPLACE_NATIVE',
            source: 'PRINTPRICE_APP',
            bpe_endpoint: '/api/marketplace/offers',
            payment_status: 'PENDING',
          },
        }),
      });

      let data: any = {};
      try {
        data = await response.json();
      } catch {
        // ignore non-json response
      }

      if (!response.ok || !data.success) {
        throw new Error(data.error || data.message || 'Failed to add to cart');
      }

      setCart([{
        id: data.item_id,
        specs,
        offer: {
          ...offer,
          selected_by_customer: true,
        },
        pricing,
        allOffers,
        recommendedOffer,
        recommendedOfferId,
        selectedBy: 'CUSTOMER',
        addedAt: new Date().toISOString(),
        metadata: {
          contract: 'BPE_MARKETPLACE_NATIVE',
          source: 'PRINTPRICE_APP',
          bpe_endpoint: '/api/marketplace/offers',
          payment_status: 'PENDING',
        },
      }]);

      setProductionFiles({
        interior_pdf: initialFileDraft('INTERIOR_PDF'),
        cover_spine_back_pdf: initialFileDraft('COVER_SPINE_BACK_PDF'),
      });

      setIsCartOpen(true);
    } catch (err: any) {
      console.error('Error adding to cart:', err);
      addToast({
        variant: 'error',
        title: 'Cart Error',
        body: err?.message || 'Failed to add offer to cart.',
      });
    } finally {
      setCreatingOrder(false);
    }
  }, [offers, cart, addToast, creatingOrder, buildBookPricePayload]);

  const areProductionFilesReady = useCallback(() => {
    const readyStatuses: ProductionFileStatus[] = [
      'SELECTED', 'UPLOADED', 'VALIDATED',
      'LINK_PROVIDED', 'LINK_PENDING_FETCH'
    ];

    return (
      readyStatuses.includes(productionFiles.interior_pdf.status) &&
      readyStatuses.includes(productionFiles.cover_spine_back_pdf.status)
    );
  }, [productionFiles]);

  const buildProductionFilesMetadata = useCallback(() => {
    const filesReady = areProductionFilesReady();
    const interior = productionFiles.interior_pdf;
    const cover = productionFiles.cover_spine_back_pdf;

    let workflowStatus: ProductionFilesWorkflowStatus = 'FILES_PENDING';
    if (filesReady) {
      const hasDownloadUrl =
        interior.source_type === 'DOWNLOAD_URL' ||
        cover.source_type === 'DOWNLOAD_URL';

      const hasUpload =
        interior.source_type === 'UPLOAD' ||
        cover.source_type === 'UPLOAD';

      if (interior.status === 'VALIDATED' && cover.status === 'VALIDATED') {
        workflowStatus = 'FILES_VALIDATED';
      } else if (hasDownloadUrl && hasUpload) {
        workflowStatus = 'FILES_MIXED_DECLARED';
      } else if (hasDownloadUrl) {
        workflowStatus = 'FILES_FETCH_REQUIRED';
      } else {
        workflowStatus = 'FILES_SELECTED';
      }
    }

    return {
      required: true as const,
      status: workflowStatus,
      required_files: ['INTERIOR_PDF', 'COVER_SPINE_BACK_PDF'] as ProductionFileKind[],
      interior_pdf: toProductionFileMetadata(interior, 'INTERIOR_PDF'),
      cover_spine_back_pdf: toProductionFileMetadata(cover, 'COVER_SPINE_BACK_PDF'),
    };
  }, [productionFiles, areProductionFilesReady]);

  const handleCheckout = useCallback(async () => {
    try {
      if (!areProductionFilesReady()) {
        const msg = 'Production files are required before creating the order request.';
        setOrderError(msg);
        addToast({
          variant: 'error',
          title: 'Production files required',
          body: msg,
        });
        return;
      }

      if (!user) {
        setAuthModalOpen(true);
        return;
      }
      setCreatingOrder(true);
      setOrderError(null);
      const res = await fetch('/api/cart/checkout', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user,
          metadata: {
            production_files: buildProductionFilesMetadata(),
            invoice_payment: {
              invoice_status: 'PENDING_FILES',
              payment_status: 'PENDING',
            },
          },
        }),
      });
      if (!res.ok) {
        let message = `HTTP ${res.status}`;
        try {
          const e = await res.json();
          message = e?.error || e?.message || message;
        } catch {
          // ignore
        }
        throw new Error(message);
      }
      const data = await res.json();
      const ref = data.order_ref || data.order_id || '—';
      setOrderSuccess(ref);
      setCart([]);
      setIsCartOpen(false);
      setProductionFiles({
        interior_pdf: initialFileDraft('INTERIOR_PDF'),
        cover_spine_back_pdf: initialFileDraft('COVER_SPINE_BACK_PDF'),
      });

      addToast({
        variant: 'success',
        title: `Order confirmed — ${ref}`,
        body: 'Order request created. Production assets must be uploaded/fetched, ingested and validated before invoice/payment.',
      });
    } catch (err: any) {
      const msg = err?.message || 'Checkout error.';
      setOrderError(msg);
      addToast({
        variant: 'error',
        title: 'Order failed',
        body: msg,
      });
    } finally {
      setCreatingOrder(false);
    }
  }, [user, addToast, areProductionFilesReady, buildProductionFilesMetadata]);

  const handleRemoveFromCart = useCallback(async (itemId: string) => {
    try {
      await fetch(`/api/cart/items/${itemId}`, { method: 'DELETE', credentials: 'include' });
      setCart(prev => {
        const next = prev.filter(i => i.id !== itemId);

        if (next.length === 0) {
          setProductionFiles({
            interior_pdf: initialFileDraft('INTERIOR_PDF'),
            cover_spine_back_pdf: initialFileDraft('COVER_SPINE_BACK_PDF'),
          });
        }

        return next;
      });
    } catch {
      // silent
    }
  }, []);

  const selectedOfferId = React.useMemo(() => {
    const currentOfferIds = new Set(offers?.offers?.map(o => o.id) ?? []);
    return cart.find(i => currentOfferIds.has(i.offer.id))?.offer.id ?? null;
  }, [offers, cart]);

  const currentStep = React.useMemo(() => {
    if (orderSuccess) return 'checkout';
    if (cart.length > 0) return 'upload';
    if (offers) return 'offer';
    return 'specs';
  }, [cart, offers, orderSuccess]);

  const combinedOffersError = orderError || null;

  return (
    <div className="flex flex-col min-h-screen bg-corporate-primary selection:bg-corporate-accent selection:text-white">
      {/* Honeypot Node - Anti-Bot */}
      <input type="text" id="hp_node" style={{ display: 'none' }} tabIndex={-1} autoComplete="off" />

      <Header
        cartCount={cart.length}
        onCartClick={() => setIsCartOpen(prev => !prev)}
        isDark={isDark}
        onThemeToggle={() => setIsDark(prev => !prev)}
        user={user}
        onOpenAuthModal={() => setAuthModalOpen(true)}
        onLogout={() => setUser(null)}
      />

      <main className="flex-1 container mx-auto px-4 py-8 md:py-12 max-w-[1400px]">
        {/* Visual Workflow Guidance */}
        <CheckoutStepper currentStep={currentStep} />

        {/* Asistente IA arriba, a ancho completo */}
        <AssistantChat
          specs={bookPricePayload}
          offers={offers}
          onSpecsPatch={(patch) => {
            console.log("BEFORE PATCH specs:", bookPricePayload);
            console.log("PATCH RECEIVED:", patch);
            setBookPricePayload((prev) => {
              const next = { ...prev, ...patch };
              console.log("AFTER PATCH next:", next);
              return next;
            });
            setPayloadVersion(v => v + 1);
          }}
          onOffersUpdate={(newOffers) => setOffers(newOffers)}
          onChooseOffer={handleChooseOffer}
          selectedOfferId={selectedOfferId}
        />

        <section className="grid gap-6 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)] items-start">
          {/* Left: PDF + form */}
          <div className="space-y-6">
            <div className="bg-corporate-secondary p-6 md:p-8 border-l border-white/5 transition-all hover:bg-corporate-primary/50">
              <h2 className="text-[0.7rem] font-technical font-black tracking-monolith text-corporate-accent mb-6 uppercase">
                {t('upload_pdf_instructions')}
              </h2>
              <PdfUploadDropzone
                onFileSelect={handleFileSelect}
                loading={loadingPdf}
                fileName={pdfFile ? pdfFile.name : null}
                error={error}
              />
              {pageCount > 0 && (
                <p className="mt-4 text-[0.6rem] font-technical tracking-wider text-corporate-text-secondary uppercase">
                  Detected{' '}
                  <span className="text-corporate-accent font-black">{pageCount}</span>{' '}
                  pages in the source_node.
                </p>
              )}
            </div>

            <BookPriceForm
              initialPayload={bookPricePayload}
              payloadVersion={payloadVersion}
              onPayloadChange={handlePayloadChange}
              onCalculatePrice={handleCalculatePrice}
              loading={loadingOffers}
              hasPdf={!!pdfFile}
              isAdmin={isAdmin}
            />
          </div>

          {/* Right: Offers */}
          <div className="flex flex-col gap-6">
            <div ref={offersRef}>
              <PrintOffersPanel
                offers={offers}
                loading={loadingOffers}
                error={combinedOffersError}
                onChooseOffer={handleChooseOffer}
                selectedOfferId={selectedOfferId}
              />
            </div>

            {orderSuccess && (
              <div className="bg-corporate-secondary border border-corporate-accent/30 p-8 flex items-start gap-6">
                <div className="w-2 h-2 mt-1 bg-corporate-accent shrink-0" />
                <div>
                  <p className="text-[0.7rem] font-technical font-black tracking-monolith text-corporate-accent uppercase mb-2">
                    Order confirmed — {orderSuccess}
                  </p>
                  <p className="text-sm text-corporate-text-secondary">
                    Order request created. Production assets are recorded. Payment remains pending until ingestion, validation and invoice generation.
                  </p>
                  <button
                    type="button"
                    onClick={() => setOrderSuccess(null)}
                    className="mt-4 text-[10px] font-technical font-black tracking-monolith text-corporate-muted hover:text-corporate-accent uppercase transition-colors"
                  >
                    [×] Dismiss
                  </button>
                </div>
              </div>
            )}

            {!pdfFile &&
              !bookPricePayload.total_page_count &&
              !loadingPdf &&
              !loadingOffers &&
              !offers && (
                <div className="flex-1 flex items-center justify-center border border-white/5 bg-corporate-secondary p-12">
                  <div className="text-center text-corporate-muted font-technical text-xs tracking-widest uppercase">
                    {t('enter_specs_or_upload_pdf')}
                  </div>
                </div>
              )}
          </div>
        </section>

        {/* Production Files Step (v5.3) */}
        {cart.length > 0 && (
          <div ref={productionFilesRef} className="mt-8 border-t border-white/5 pt-12">
            <ProductionFilesPanel
              cartItem={cart[0]}
              filesState={productionFiles}
              onFileSelect={handleProductionFileSelect}
              onUrlSelect={handleProductionFileUrlSelect}
              onFileRemove={handleProductionFileRemove}
              onContinue={handleCheckout}
              disabled={creatingOrder}
            />
          </div>
        )}
      </main>

      {/* Cart slide-over */}
      <CartPanel
        isOpen={isCartOpen}
        onClose={() => setIsCartOpen(false)}
        cart={cart}
        checkingOut={creatingOrder}
        onRemove={handleRemoveFromCart}
        onCheckout={handleCheckout}
        onGoToUpload={handleGoToUpload}
        isLoggedIn={!!user}
        onSignInClick={() => setAuthModalOpen(true)}
      />

      {authModalOpen && (
        <AuthModal
          onClose={() => setAuthModalOpen(false)}
          onLoginSuccess={(loggedInUser) => {
            setUser(loggedInUser);
            setAuthModalOpen(false);
          }}
        />
      )}

      <Toast toasts={toasts} onDismiss={dismissToast} />
    </div>
  );
};

export default App;
