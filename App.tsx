import React, {
  useState,
  useEffect,
  useCallback,
} from 'react';

// PDF.js (legacy build)
import * as pdfjsLib from 'pdfjs-dist/legacy/build/pdf';
const { getDocument, GlobalWorkerOptions } = pdfjsLib;

// Worker from the same pdfjs-dist version, bundled by Vite
// @ts-ignore
import pdfWorkerSrc from 'pdfjs-dist/build/pdf.worker.min.mjs?url';

import {
  BOOK_PRICE_API_ENDPOINT,
  CREATE_ORDER_ENDPOINT,
  BOOK_SIZES_PORTRAIT,
  BOOK_SIZES_LANDSCAPE,
} from './constants';

import {
  InitialBookPricePayload,
  BookPricePayload,
  BookPriceResponse,
  BookPriceOffer,
} from './types';

import AssistantChat from './components/AssistantChat';
import PdfUploadDropzone from './components/PdfUploadDropzone';
import BookPriceForm from './components/BookPriceForm';
import PrintOffersPanel from './components/PrintOffersPanel';

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

const App: React.FC = () => {
  const [isAdmin, setIsAdmin] = useState(false);
  const [pdfFile, setPdfFile] = useState<File | null>(null);
  const [pageCount, setPageCount] = useState<number>(0);
  const [payloadVersion, setPayloadVersion] = useState(0);
  const [mountTime] = useState(() => Date.now()); // Para anti-bot time-to-submit

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

  const toggleTheme = () => setIsDark(!isDark);

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

  // Normalizar respuesta del BPE -> BookPriceResponse (para UI)
  const normaliseApiResponse = (data: any): BookPriceResponse => {
    const rawOffers: any[] = Array.isArray(data?.print_houses)
      ? data.print_houses
      : Array.isArray(data?.offers)
        ? data.offers
        : Array.isArray(data)
          ? data
          : [];

    const offers: BookPriceOffer[] = rawOffers.map(
      (raw: any, index: number) => {
        const currency: string =
          raw.currency || raw.currency_code || 'EUR';

        const totalCostRaw =
          raw.total_cost ??
          raw.total_price ??
          raw.grand_total ??
          0;
        const total_cost =
          typeof totalCostRaw === 'number'
            ? totalCostRaw
            : parseFloat(String(totalCostRaw)) || 0;

        // Breakdown a partir de lines[]
        const breakdown =
          Array.isArray(raw.lines)
            ? raw.lines.map((line: any) => ({
              label: String(line.item ?? ''),
              amount:
                typeof line.line_total === 'number'
                  ? line.line_total
                  : line.line_total
                    ? parseFloat(String(line.line_total)) || 0
                    : 0,
            }))
            : Array.isArray(raw.breakdown)
              ? raw.breakdown
              : [];

        const estimated_delivery_time: string =
          raw.estimated_delivery_time ||
          raw.delivery_time ||
          raw.lead_time ||
          raw.eta ||
          '';

        return {
          id: String(raw.house_id ?? raw.id ?? `offer-${index}`),
          print_house:
            raw.print_house ||
            raw.print_house_name ||
            'Print house',
          total_cost,
          estimated_delivery_time,
          breakdown,
          currency,
        };
      }
    );

    return {
      success: !data?.error && offers.length > 0,
      message: data?.message || data?.error || undefined,
      offers,
    };
  };

  // Construir payload para BPE / create-order
  const buildBookPricePayload = (): BookPricePayload => {
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
  };

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
    } catch (err: any) {
      console.error('Error calculating price:', err);
      setError(err?.message || t('api_error_message'));
      setOffers(null);
    } finally {
      setLoadingOffers(false);
    }
  }, [bookPricePayload]);

  // Elegir oferta => BPE de nuevo + create-order-from-chat
  const handleChooseOffer = useCallback(
    async (offer: BookPriceOffer) => {
      try {
        setCreatingOrder(true);
        setOrderError(null);

        // 1) Prepare Context
        const baseParams = buildBookPricePayload();
        const ctx = await getPayloadContext(baseParams);

        // 2) Obtain Bound Challenge
        const challengeRes = await fetch('/api/security/challenge', { 
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ payload_context: ctx })
        });
        if (!challengeRes.ok) throw new Error('Authorization bridge fault.');
        const { token, nonce, timestamp } = await challengeRes.json();

        // 3) Recalcular ofertas en el backend para obtener print_houses RAW
        const bpeRes = await fetch(BOOK_PRICE_API_ENDPOINT, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            ...baseParams,
            security_token: token,
            nonce,
            timestamp
          }),
        });

        if (!bpeRes.ok) {
          let msg = `BPE HTTP ${bpeRes.status}`;
          try {
            const errData = await bpeRes.json();
            if (errData?.message) msg = errData.message;
            if (errData?.error) msg = errData.error;
          } catch {
            // ignore
          }
          throw new Error(msg);
        }

        const bpeData = await bpeRes.json();

        const bpeParams =
          bpeData &&
            typeof bpeData === 'object' &&
            bpeData.params &&
            typeof bpeData.params === 'object'
            ? bpeData.params
            : {};

        // 3) paramsPayload: mezcla de lo que tienes en la UI + lo que devuelve el BPE
        const paramsPayload: any = {
          ...baseParams,
          ...bpeParams,
        };

        // Garantizar book_size siempre presente
        if (!paramsPayload.book_size) {
          paramsPayload.book_size =
            bpeParams.book_size || baseParams.book_size || 'A5';
        }

        const printHouses: any[] = Array.isArray(bpeData?.print_houses)
          ? bpeData.print_houses
          : [];

        if (!printHouses.length) {
          throw new Error('No print houses returned by Book Price Engine.');
        }

        // 4) Buscar la casa correcta dentro de print_houses RAW
        const selectedRaw =
          printHouses.find(
            (h: any) =>
              (h.house_id &&
                String(h.house_id) === String(offer.id)) ||
              (h.print_house &&
                String(h.print_house) === String(offer.print_house))
          ) || printHouses[0];

        // 5) Payload para create-order-from-chat
        const orderPayload = {
          ...paramsPayload, // copia plana (por si el endpoint mira a nivel raíz)
          params: paramsPayload,
          print_houses: printHouses,
          selected_print_house: selectedRaw,
        };

        const res = await fetch(CREATE_ORDER_ENDPOINT, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(orderPayload),
        });

        if (!res.ok) {
          let msg = `HTTP ${res.status}`;
          try {
            const errData = await res.json();
            if (errData?.message) msg = errData.message;
            if (errData?.error) msg = errData.error;
          } catch {
            // ignore
          }
          throw new Error(msg);
        }

        const data = await res.json();

        // Redirect to WooCommerce cart instead of order page
        // The order is created silently in the background
        if (data?.cart_url) {
          window.location.href = data.cart_url;
        } else if (data?.data?.cart_url) {
          window.location.href = data.data.cart_url;
        } else {
          // Fallback: redirect to cart page directly
          // The backend should add the item to cart automatically
          window.location.href = 'https://printprice.pro/cart/';
        }
      } catch (err: any) {
        console.error('Error creating print order', err);
        setOrderError(err?.message || 'Error creating print order.');
      } finally {
        setCreatingOrder(false);
      }
    },
    [bookPricePayload]
  );

  const combinedOffersError = orderError || null;

  return (
    <div className="flex flex-col min-h-screen bg-corporate-primary selection:bg-corporate-accent selection:text-white">
      {/* Honeypot Node - Anti-Bot */}
      <input type="text" id="hp_node" style={{ display: 'none' }} tabIndex={-1} autoComplete="off" />
      
      <main className="flex-1 container mx-auto px-4 py-8 md:py-12 max-w-[1400px]">
        {/* Asistente IA arriba, a ancho completo */}
        <AssistantChat
          specs={bookPricePayload}
          offers={offers}
          isDark={isDark}
          onToggleTheme={toggleTheme}
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
          <div className="flex flex-col h-full">
            <PrintOffersPanel
              offers={offers}
              loading={loadingOffers || creatingOrder}
              error={combinedOffersError}
              onChooseOffer={handleChooseOffer}
            />

            {!pdfFile &&
              !bookPricePayload.total_page_count &&
              !loadingPdf &&
              !loadingOffers &&
              !offers && (
                <div className="mt-6 flex-1 flex items-center justify-center border border-white/5 bg-corporate-secondary p-12">
                  <div className="text-center text-corporate-muted font-technical text-xs tracking-widest uppercase">
                    {t('enter_specs_or_upload_pdf')}
                  </div>
                </div>
              )}
          </div>
        </section>
      </main>
    </div>
  );
};

export default App;
