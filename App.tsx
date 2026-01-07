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
} from './constants';

import {
  InitialBookPricePayload,
  BookPricePayload,
  BookPriceResponse,
  BookPriceOffer,
} from './types';

import Header from './components/Header';
import AssistantChat from './components/AssistantChat';
import PdfUploadDropzone from './components/PdfUploadDropzone';
import BookPriceForm from './components/BookPriceForm';
import PrintOffersPanel from './components/PrintOffersPanel';

import { t } from './i18n/en';

// ==== Helpers para extraer info del PDF ====

const PT_TO_MM = 25.4 / 72; // 1 punto PDF = 1/72 inch

// Tabla sencilla de tamaños que reconoce tu app (BookSize)
const KNOWN_SIZES = [
  { code: 'A3', width: 297, height: 420 },
  { code: 'A4', width: 210, height: 297 },
  { code: 'A5', width: 148, height: 210 },
  { code: 'A6', width: 105, height: 148 },
  { code: 'B5', width: 176, height: 250 },
  { code: 'B6', width: 125, height: 176 },
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

  let bestMatch: string = 'A5'; // Default to A5 instead of Custom

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
    book_size: bestMatch, // "A4", "A5", etc.
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

const App: React.FC = () => {
  const [pdfFile, setPdfFile] = useState<File | null>(null);
  const [pageCount, setPageCount] = useState<number>(0);

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
      cover_print_rev: 1,

      // Paper types
      paper_type_interior: 'offset',
      paper_type_cover: 'mc',
      paper_type_endpaper: 'offset',

      // Paper weights (gsm)
      paper_weight_interior: 70,
      paper_weight_cover: 120,
      paper_weight_endpapers: 115,

      // PMS colors
      pms_interior: 1,
      pms_cover: 1,

      // Binding & finishing
      binding_method: 'perfect_bound',
      finishing_options: 'gloss_lam',
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

    // Validate PMS colors (must be 1-3, default to 1 if invalid)
    const validatePMS = (value: number): number => {
      const num = Number(value);
      if (!Number.isFinite(num) || num < 1 || num > 3) {
        return 1; // Default to 1 if invalid
      }
      return Math.floor(num); // Ensure integer
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

      // Paper types
      paper_type_interior: bookPricePayload.paper_type_interior,
      paper_type_cover: bookPricePayload.paper_type_cover,
      paper_type_endpaper: bookPricePayload.paper_type_endpaper,

      // Paper weights
      paper_weight_interior: bookPricePayload.paper_weight_interior,
      paper_weight_cover: bookPricePayload.paper_weight_cover,
      paper_weight_endpapers: bookPricePayload.paper_weight_endpapers,

      // PMS colors (validated to ensure 1-3)
      pms_interior: validatePMS(bookPricePayload.pms_interior),
      pms_cover: validatePMS(bookPricePayload.pms_cover),

      // Binding & finishing
      binding_method: bookPricePayload.binding_method,
      finishing_options: bookPricePayload.finishing_options,
      uv_varnish: bookPricePayload.uv_varnish,

      // Endpapers
      endpapers: bookPricePayload.endpapers,
      endpapers_print: bookPricePayload.endpapers_print,

      // Extra costs
      extra_book: bookPricePayload.extra_book,
      extra_section: bookPricePayload.extra_section,
      extra_fixed: bookPricePayload.extra_fixed,
      extra_variable: bookPricePayload.extra_variable,

      // Debug (optional)
      ...(bookPricePayload.debug ? { debug: 1 as const } : {}),
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

    const payloadForApi = buildBookPricePayload();

    try {
      const response = await fetch(BOOK_PRICE_API_ENDPOINT, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
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

        // 1) Parametros base tal y como los usamos para el BPE
        const baseParams = buildBookPricePayload();

        // 2) Recalcular ofertas en el backend para obtener print_houses RAW
        const bpeRes = await fetch(BOOK_PRICE_API_ENDPOINT, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(baseParams),
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

        if (data?.order_url) {
          window.location.href = data.order_url;
        } else if (data?.data?.order_url) {
          window.location.href = data.data.order_url;
        } else {
          setOrderError(
            'Order created, but no order URL was returned by the API.'
          );
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
    <div className="flex flex-col min-h-screen bg-gray-50">
      <Header />

      <main className="flex-1 container mx-auto px-4 py-6 sm:py-8">
        {/* Asistente IA arriba, a ancho completo */}
        <AssistantChat
          specs={bookPricePayload}
          offers={offers}
          onSpecsPatch={(patch) =>
            setBookPricePayload((prev) => ({ ...prev, ...patch }))
          }
          onOffersUpdate={(newOffers) => setOffers(newOffers)}
        />

        <section className="grid gap-6 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)] items-start">
          {/* Left: PDF + form */}
          <div className="space-y-4">
            <div className="bg-white shadow-md rounded-lg p-4 sm:p-6">
              <h2 className="text-sm font-semibold text-gray-800 mb-2">
                {t('upload_pdf_instructions')}
              </h2>
              <PdfUploadDropzone
                onFileSelect={handleFileSelect}
                loading={loadingPdf}
                fileName={pdfFile ? pdfFile.name : null}
                error={error}
              />
              {pageCount > 0 && (
                <p className="mt-2 text-xs text-gray-500">
                  Detected{' '}
                  <span className="font-semibold">{pageCount}</span>{' '}
                  pages in the PDF.
                </p>
              )}
            </div>

            <BookPriceForm
              initialPayload={bookPricePayload}
              onPayloadChange={handlePayloadChange}
              onCalculatePrice={handleCalculatePrice}
              loading={loadingOffers}
              hasPdf={!!pdfFile}
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
                <div className="mt-4 flex-1 flex items-center justify-center">
                  <div className="bg-white shadow-lg rounded-lg p-8 text-center text-gray-500 text-sm">
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
