import React, { useState, useEffect } from 'react';
import {
  BOOK_SIZES_PORTRAIT,
  BOOK_SIZES_LANDSCAPE,
  ORIENTATIONS,
  INTERIOR_PRINT_OPTIONS,
  COVER_PRINT_OPTIONS,
  PAPER_TYPE_INTERIOR,
  PAPER_TYPE_COVER,
  PAPER_TYPE_ENDPAPER,
  BINDING_METHODS,
  FINISHING_OPTIONS,
  ENDPAPERS_OPTIONS,
  ENDPAPERS_PRINT_OPTIONS,
  INTERIOR_GSM_OPTIONS,
  COVER_GSM_OPTIONS,
  ENDPAPERS_GSM_OPTIONS,
  DELIVERY_COUNTRIES,
  COVER_PAGES_OPTIONS,
  PMS_OPTIONS,
  DIMENSION_RANGES,
  DIMENSION_HINTS,
} from '../constants';
import {
  UserGroupIcon,
  GlobeEuropeAfricaIcon,
  Square3Stack3DIcon,
  DocumentTextIcon,
  BookOpenIcon,
  ArrowsPointingOutIcon,
  PaintBrushIcon,
  ScaleIcon,
  SwatchIcon,
  TrophyIcon,
  SparklesIcon,
  SunIcon,
  CogIcon,
  BeakerIcon,
  CurrencyDollarIcon,
  TagIcon,
  WrenchIcon,
  AdjustmentsHorizontalIcon,
} from '@heroicons/react/24/outline';
import { InitialBookPricePayload } from '../types';
import { t } from '../i18n/en';

interface BookPriceFormProps {
  initialPayload: InitialBookPricePayload;
  onPayloadChange: (payload: InitialBookPricePayload) => void;
  onCalculatePrice: () => void;
  loading: boolean;
  hasPdf: boolean;
  isAdmin?: boolean;
  payloadVersion?: number;
}

const BookPriceForm: React.FC<BookPriceFormProps> = ({
  initialPayload,
  onPayloadChange,
  onCalculatePrice,
  loading,
  hasPdf,
  isAdmin = false,
  payloadVersion = 0,
}) => {
  const [payload, setPayload] = useState<InitialBookPricePayload>(initialPayload);
  const [customDimensionError, setCustomDimensionError] = useState<string>('');

  useEffect(() => {
    setPayload(initialPayload);
  }, [payloadVersion]);

  // Check if hardcover is selected
  const isHardcover = payload.binding_method === 'thread_sewn_hc';

  const currentBookSizes = payload.orientation === 'landscape' ? BOOK_SIZES_LANDSCAPE : BOOK_SIZES_PORTRAIT;

  useEffect(() => {
    const validSizes = payload.orientation === 'landscape' ? BOOK_SIZES_LANDSCAPE : BOOK_SIZES_PORTRAIT;
    if (!validSizes.includes(payload.book_size)) {
      const nextPayload = { ...payload, book_size: validSizes[0] };
      setPayload(nextPayload);
      onPayloadChange(nextPayload);
    }
  }, [payload.orientation]);

  // Validate custom dimensions
  const isCustomSizeValid = (width: number, height: number, orientation: string): boolean => {
    if (!Number.isFinite(width) || !Number.isFinite(height)) return false;
    const ranges = DIMENSION_RANGES[orientation as 'portrait' | 'landscape'] || [];
    return ranges.some((r) => width >= r.wMin && width <= r.wMax && height >= r.hMin && height <= r.hMax);
  };

  const validateCustomDimensions = (): boolean => {
    if (payload.book_size !== 'Custom') {
      setCustomDimensionError('');
      return true;
    }

    const w = payload.custom_width || 0;
    const h = payload.custom_height || 0;

    if (!w || !h) {
      setCustomDimensionError('');
      return true;
    }

    const valid = isCustomSizeValid(w, h, payload.orientation);
    if (valid) {
      setCustomDimensionError('');
      return true;
    }

    const orientationName = payload.orientation === 'portrait' ? 'Portrait' : 'Landscape';
    setCustomDimensionError(
      `These dimensions are not available for ${orientationName} orientation. Please use one of the ranges listed above.`
    );
    return false;
  };

  // Validate on dimension or orientation change
  useEffect(() => {
    validateCustomDimensions();
  }, [payload.custom_width, payload.custom_height, payload.orientation, payload.book_size]);

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>
  ) => {
    const { name, value, type } = e.target;

    let newValue: any = value;

    // Handle number inputs
    if (type === 'number') {
      newValue = value === '' ? 0 : Number(value);
    }

    // Handle checkbox
    if (type === 'checkbox') {
      newValue = (e.target as HTMLInputElement).checked;
    }

    const nextPayload = {
      ...payload,
      [name]: newValue,
    } as InitialBookPricePayload;

    // Clear custom dimensions when switching away from Custom
    if (name === 'book_size' && newValue !== 'Custom') {
      nextPayload.custom_width = undefined;
      nextPayload.custom_height = undefined;
    }

    setPayload(nextPayload);
    onPayloadChange(nextPayload);
  };

  const handleCalculatePrice = () => {
    if (payload.book_size === 'Custom' && !validateCustomDimensions()) {
      return;
    }
    onCalculatePrice();
  };

  return (
    <div className="bg-white shadow-xl rounded-2xl p-6 sm:p-8 border border-gray-100">
      <h2 className="text-xl font-bold text-gray-900 mb-8 flex items-center gap-3">
        <WrenchIcon className="w-6 h-6 text-red-600" />
        Book specifications
      </h2>

      <div className="flex flex-col gap-10 text-xs sm:text-sm">
        {/* Section: General */}
        <div className="space-y-6">
          <div className="flex items-center gap-4">
            <h3 className="text-[11px] font-bold text-gray-400 uppercase tracking-[0.2em] whitespace-nowrap">
              {t('section_general')}
            </h3>
            <div className="h-px w-full bg-gray-100" />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="flex flex-col">
              <label className="flex items-center gap-2 font-bold text-gray-700 mb-2 uppercase tracking-wider text-[10px]">
                <UserGroupIcon className="w-5 h-5 text-red-600" />
                {t('copies_label')}
              </label>
              <input
                type="number"
                name="copies"
                min={1}
                value={payload.copies}
                onChange={handleChange}
                className="block w-full py-3 px-5 rounded-xl border-gray-200 shadow-sm focus:border-red-500 focus:ring-red-500 text-sm transition-all duration-200 bg-gray-50/50"
              />
              <p className="mt-2 text-[11px] text-gray-400 italic leading-tight">
                {t('copies_help')}
              </p>
            </div>

            <div className="flex flex-col">
              <label className="flex items-center gap-2 font-bold text-gray-700 mb-2 uppercase tracking-wider text-[10px]">
                <GlobeEuropeAfricaIcon className="w-5 h-5 text-red-600" />
                {t('delivery_country_label')}
              </label>
              <select
                name="delivery_country"
                value={payload.delivery_country}
                onChange={handleChange}
                className="block w-full py-3 px-5 rounded-xl border-gray-200 shadow-sm focus:border-red-500 focus:ring-red-500 text-sm transition-all duration-200 bg-gray-50/50"
              >
                {DELIVERY_COUNTRIES.map((c) => (
                  <option key={c.code} value={c.code}>
                    {c.name}
                  </option>
                ))}
              </select>
              <p className="mt-2 text-[11px] text-gray-400 italic leading-tight">
                {t('delivery_country_help')}
              </p>
            </div>

            <div className="flex flex-col">
              <label className="flex items-center gap-2 font-bold text-gray-700 mb-2 uppercase tracking-wider text-[10px]">
                <Square3Stack3DIcon className="w-5 h-5 text-red-600" />
                {t('book_size_label')}
              </label>
              <select
                name="book_size"
                value={payload.book_size}
                onChange={handleChange}
                className="block w-full py-3 px-5 rounded-xl border-gray-200 shadow-sm focus:border-red-500 focus:ring-red-500 text-sm transition-all duration-200 bg-gray-50/50"
              >
                {currentBookSizes.map((size) => (
                  <option key={size} value={size}>
                    {size}
                  </option>
                ))}
              </select>
              <p className="mt-2 text-[11px] text-gray-400 italic leading-tight">
                {t('book_size_help')}
              </p>
            </div>
          </div>

          {/* Custom Dimensions Section */}
          {payload.book_size === 'Custom' && (
            <div className="bg-gradient-to-br from-blue-50 to-white border border-blue-200 rounded-2xl p-6 shadow-inner mt-6 animate-slideDown">
              <span className="text-xs font-bold text-blue-600 uppercase tracking-wider flex items-center gap-2 mb-4">
                <ArrowsPointingOutIcon className="w-4 h-4" />
                📏 Custom Dimensions
              </span>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="flex flex-col">
                  <label className="font-bold text-gray-700 mb-2 uppercase tracking-wider text-[10px]">
                    Width
                  </label>
                  <div className="relative">
                    <input
                      type="number"
                      name="custom_width"
                      min={106}
                      max={290}
                      step={1}
                      placeholder="210"
                      value={payload.custom_width || ''}
                      onChange={handleChange}
                      className={`block w-full py-3 pl-5 pr-12 rounded-xl border-gray-200 shadow-sm focus:border-red-500 focus:ring-red-500 text-sm transition-all duration-200 bg-white ${customDimensionError ? 'border-red-500 ring-1 ring-red-200' : ''
                        }`}
                    />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 text-xs font-semibold pointer-events-none">
                      mm
                    </span>
                  </div>
                </div>

                <div className="flex flex-col">
                  <label className="font-bold text-gray-700 mb-2 uppercase tracking-wider text-[10px]">
                    Height
                  </label>
                  <div className="relative">
                    <input
                      type="number"
                      name="custom_height"
                      min={149}
                      max={340}
                      step={1}
                      placeholder="297"
                      value={payload.custom_height || ''}
                      onChange={handleChange}
                      className={`block w-full py-3 pl-5 pr-12 rounded-xl border-gray-200 shadow-sm focus:border-red-500 focus:ring-red-500 text-sm transition-all duration-200 bg-white ${customDimensionError ? 'border-red-500 ring-1 ring-red-200' : ''
                        }`}
                    />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 text-xs font-semibold pointer-events-none">
                      mm
                    </span>
                  </div>
                </div>
              </div>

              <div className="mt-4 bg-blue-50/50 rounded-lg p-3 border border-blue-100">
                <p className="text-[10px] font-bold text-blue-700 uppercase tracking-wide mb-2 flex items-center gap-1">
                  <span>💡</span>
                  <span>Available {payload.orientation === 'portrait' ? 'Portrait' : 'Landscape'} Sizes</span>
                </p>
                <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-[11px] text-gray-600">
                  {payload.orientation === 'portrait' ? (
                    <>
                      <div className="flex items-center gap-1">
                        <span className="text-blue-500">•</span>
                        <span className="font-mono">106-118 × 149-166 mm</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <span className="text-blue-500">•</span>
                        <span className="font-mono">148-152 × 210-215 mm</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <span className="text-blue-500">•</span>
                        <span className="font-mono">153-170 × 216-244 mm</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <span className="text-blue-500">•</span>
                        <span className="font-mono">175-216 × 250-304 mm</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <span className="text-blue-500">•</span>
                        <span className="font-mono">217-245 × 305-340 mm</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <span className="text-blue-500">•</span>
                        <span className="font-mono">175-216 × 175-200 mm</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <span className="text-blue-500">•</span>
                        <span className="font-mono">217-220 × 201-220 mm</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <span className="text-blue-500">•</span>
                        <span className="font-mono">235-290 × 235-325 mm</span>
                      </div>
                    </>
                  ) : (
                    <>
                      <div className="flex items-center gap-1">
                        <span className="text-blue-500">•</span>
                        <span className="font-mono">149-166 × 105-118 mm</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <span className="text-blue-500">•</span>
                        <span className="font-mono">180-215 × 135-150 mm</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <span className="text-blue-500">•</span>
                        <span className="font-mono">216-240 × 151-165 mm</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <span className="text-blue-500">•</span>
                        <span className="font-mono">270-297 × 190-214 mm</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <span className="text-blue-500">•</span>
                        <span className="font-mono">270-297 × 215-240 mm</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <span className="text-blue-500">•</span>
                        <span className="font-mono">200-245 × 180-220 mm</span>
                      </div>
                    </>
                  )}
                </div>
                <p className="mt-2 text-[10px] text-gray-500 italic">
                  Width × Height format
                </p>
              </div>

              {customDimensionError && (
                <p className="mt-3 text-xs text-red-600 font-semibold" role="alert">
                  {customDimensionError}
                </p>
              )}
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="flex flex-col">
              <label className="flex items-center gap-2 font-bold text-gray-700 mb-2 uppercase tracking-wider text-[10px]">
                <DocumentTextIcon className="w-5 h-5 text-red-600" />
                {t('interior_pages_label')}
              </label>
              <div className="relative">
                <input
                  type="number"
                  name="interior_pages"
                  min={0}
                  value={payload.interior_pages}
                  onChange={handleChange}
                  className={`block w-full py-3 px-5 rounded-xl border-gray-200 shadow-sm focus:border-red-500 focus:ring-red-500 text-sm transition-all duration-200 bg-gray-50/50 ${hasPdf ? 'border-green-300 ring-1 ring-green-100' : ''}`}
                />
                {hasPdf && (
                  <div className="absolute right-3 top-1/2 -translate-y-1/2">
                    <span className="text-[9px] bg-green-500 text-white px-1.5 py-0.5 rounded-full font-bold shadow-sm">PDF OK</span>
                  </div>
                )}
              </div>
              <p className="mt-2 text-[11px] text-gray-400 italic leading-tight">
                {t('interior_pages_help')}
              </p>
            </div>

            <div className="flex flex-col">
              <label className="flex items-center gap-2 font-bold text-gray-700 mb-2 uppercase tracking-wider text-[10px]">
                <BookOpenIcon className="w-5 h-5 text-red-600" />
                {t('cover_pages_label')}
              </label>
              <select
                name="cover_pages"
                value={payload.cover_pages}
                onChange={handleChange}
                className="block w-full py-3 px-5 rounded-xl border-gray-200 shadow-sm focus:border-red-500 focus:ring-red-500 text-sm transition-all duration-200 bg-gray-50/50"
              >
                {COVER_PAGES_OPTIONS.map((v) => (
                  <option key={v} value={v}>
                    {v} pages
                  </option>
                ))}
              </select>
              <p className="mt-2 text-[11px] text-gray-400 italic leading-tight">
                {t('cover_pages_help')}
              </p>
            </div>

            <div className="flex flex-col">
              <label className="flex items-center gap-2 font-bold text-gray-700 mb-2 uppercase tracking-wider text-[10px]">
                <ArrowsPointingOutIcon className="w-5 h-5 text-red-600" />
                {t('orientation_label')}
              </label>
              <select
                name="orientation"
                value={payload.orientation}
                onChange={handleChange}
                className="block w-full py-3 px-5 rounded-xl border-gray-200 shadow-sm focus:border-red-500 focus:ring-red-500 text-sm transition-all duration-200 bg-gray-50/50"
              >
                {ORIENTATIONS.map((o) => (
                  <option key={o} value={o}>
                    {o.charAt(0).toUpperCase() + o.slice(1)}
                  </option>
                ))}
              </select>
              <p className="mt-2 text-[11px] text-gray-400 italic leading-tight">
                {t('orientation_help')}
              </p>
            </div>
          </div>
        </div>

        {/* Section: Interior */}
        <div className="space-y-6">
          <div className="flex items-center gap-4">
            <h3 className="text-[11px] font-bold text-gray-400 uppercase tracking-[0.2em] whitespace-nowrap">
              {t('section_interior')}
            </h3>
            <div className="h-px w-full bg-gray-100" />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
            <div className="flex flex-col">
              <label className="flex items-center gap-2 font-bold text-gray-700 mb-2 uppercase tracking-wider text-[10px]">
                <PaintBrushIcon className="w-5 h-5 text-red-600" />
                {t('interior_print_label')}
              </label>
              <select
                name="interior_print"
                value={payload.interior_print}
                onChange={handleChange}
                className="block w-full py-3 px-5 rounded-xl border-gray-200 shadow-sm focus:border-red-500 focus:ring-red-500 text-sm transition-all duration-200 bg-gray-50/50"
              >
                {INTERIOR_PRINT_OPTIONS.map((m) => (
                  <option key={m} value={m}>
                    {m === '4/4' ? '4/4 Full Color' : m === '2/2' ? '2/2 Colors' : '1/1 B/W'}
                  </option>
                ))}
              </select>
              <p className="mt-2 text-[11px] text-gray-400 italic leading-tight">
                {t('interior_print_help')}
              </p>
            </div>

            <div className="flex flex-col">
              <label className="flex items-center gap-2 font-bold text-gray-700 mb-2 uppercase tracking-wider text-[10px]">
                <CogIcon className="w-5 h-5 text-red-600" />
                {t('paper_type_interior_label')}
              </label>
              <select
                name="paper_type_interior"
                value={payload.paper_type_interior}
                onChange={handleChange}
                className="block w-full py-3 px-5 rounded-xl border-gray-200 shadow-sm focus:border-red-500 focus:ring-red-500 text-sm transition-all duration-200 bg-gray-50/50"
              >
                {PAPER_TYPE_INTERIOR.map((p) => (
                  <option key={p.value} value={p.value}>
                    {p.label}
                  </option>
                ))}
              </select>
              <p className="mt-2 text-[11px] text-gray-400 italic leading-tight">
                {t('paper_type_interior_help')}
              </p>
            </div>

            <div className="flex flex-col">
              <label className="flex items-center gap-2 font-bold text-gray-700 mb-2 uppercase tracking-wider text-[10px]">
                <ScaleIcon className="w-5 h-5 text-red-600" />
                {t('paper_weight_interior_label')}
              </label>
              <select
                name="paper_weight_interior"
                value={payload.paper_weight_interior}
                onChange={handleChange}
                className="block w-full py-3 px-5 rounded-xl border-gray-200 shadow-sm focus:border-red-500 focus:ring-red-500 text-sm transition-all duration-200 bg-gray-50/50"
              >
                {INTERIOR_GSM_OPTIONS.map((n) => (
                  <option key={n} value={n}>
                    {n} gsm
                  </option>
                ))}
              </select>
              <p className="mt-2 text-[11px] text-gray-400 italic leading-tight">
                {t('paper_weight_interior_help')}
              </p>
            </div>

            <div className="flex flex-col">
              <label className="flex items-center gap-2 font-bold text-gray-700 mb-2 uppercase tracking-wider text-[10px]">
                <SwatchIcon className="w-5 h-5 text-red-600" />
                {t('pms_interior_label')}
              </label>
              <select
                name="pms_interior"
                value={payload.pms_interior}
                onChange={handleChange}
                className="block w-full py-3 px-5 rounded-xl border-gray-200 shadow-sm focus:border-red-500 focus:ring-red-500 text-sm transition-all duration-200 bg-gray-50/50"
              >
                {PMS_OPTIONS.map((v) => (
                  <option key={v} value={v}>
                    {v === 0 ? 'None' : `${v} color`}
                  </option>
                ))}
              </select>
              <p className="mt-2 text-[11px] text-gray-400 italic leading-tight">
                {t('pms_interior_help')}
              </p>
            </div>
          </div>
        </div>

        {/* Section: Cover */}
        <div className="space-y-6">
          <div className="flex items-center gap-4">
            <h3 className="text-[11px] font-bold text-gray-400 uppercase tracking-[0.2em] whitespace-nowrap">
              {t('section_cover')}
            </h3>
            <div className="h-px w-full bg-gray-100" />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
            <div className="flex flex-col">
              <label className="flex items-center gap-2 font-bold text-gray-700 mb-2 uppercase tracking-wider text-[10px]">
                <PaintBrushIcon className="w-5 h-5 text-red-600" />
                {t('cover_print_label')}
              </label>
              <select
                name="cover_print"
                value={payload.cover_print}
                onChange={handleChange}
                className="block w-full py-3 px-5 rounded-xl border-gray-200 shadow-sm focus:border-red-500 focus:ring-red-500 text-sm transition-all duration-200 bg-gray-50/50"
              >
                {COVER_PRINT_OPTIONS.map((m) => (
                  <option key={m} value={m}>
                    {m === '4/0' ? '4/0 Single-sided' : m === '4/4' ? '4/4 Both sides' : '1/0 B/W'}
                  </option>
                ))}
              </select>
              <p className="mt-2 text-[11px] text-gray-400 italic leading-tight">
                {t('cover_print_help')}
              </p>
            </div>

            <div className="flex flex-col">
              <label className="flex items-center gap-2 font-bold text-gray-700 mb-2 uppercase tracking-wider text-[10px]">
                <BeakerIcon className="w-5 h-5 text-red-600" />
                {t('paper_type_cover_label')}
              </label>
              <select
                name="paper_type_cover"
                value={payload.paper_type_cover}
                onChange={handleChange}
                className="block w-full py-3 px-5 rounded-xl border-gray-200 shadow-sm focus:border-red-500 focus:ring-red-500 text-sm transition-all duration-200 bg-gray-50/50"
              >
                {PAPER_TYPE_COVER.map((p) => (
                  <option key={p.value} value={p.value}>
                    {p.label}
                  </option>
                ))}
              </select>
              <p className="mt-2 text-[11px] text-gray-400 italic leading-tight">
                {t('paper_type_cover_help')}
              </p>
            </div>

            <div className="flex flex-col">
              <label className="flex items-center gap-2 font-bold text-gray-700 mb-2 uppercase tracking-wider text-[10px]">
                <ScaleIcon className="w-5 h-5 text-red-600" />
                {t('paper_weight_cover_label')}
              </label>
              <select
                name="paper_weight_cover"
                value={payload.paper_weight_cover}
                onChange={handleChange}
                className="block w-full py-3 px-5 rounded-xl border-gray-200 shadow-sm focus:border-red-500 focus:ring-red-500 text-sm transition-all duration-200 bg-gray-50/50"
              >
                {COVER_GSM_OPTIONS.map((n) => (
                  <option key={n} value={n}>
                    {n} gsm
                  </option>
                ))}
              </select>
              <p className="mt-2 text-[11px] text-gray-400 italic leading-tight">
                {t('paper_weight_cover_help')}
              </p>
            </div>

            <div className="flex flex-col">
              <label className="flex items-center gap-2 font-bold text-gray-700 mb-2 uppercase tracking-wider text-[10px]">
                <SwatchIcon className="w-5 h-5 text-red-600" />
                {t('pms_cover_label')}
              </label>
              <select
                name="pms_cover"
                value={payload.pms_cover}
                onChange={handleChange}
                className="block w-full py-3 px-5 rounded-xl border-gray-200 shadow-sm focus:border-red-500 focus:ring-red-500 text-sm transition-all duration-200 bg-gray-50/50"
              >
                {PMS_OPTIONS.map((v) => (
                  <option key={v} value={v}>
                    {v === 0 ? 'None' : `${v} color`}
                  </option>
                ))}
              </select>
              <p className="mt-2 text-[11px] text-gray-400 italic leading-tight">
                {t('pms_cover_help')}
              </p>
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
            <div className="flex flex-col">
              <label className="flex items-center gap-2 font-bold text-gray-700 mb-2 uppercase tracking-wider text-[10px]">
                <AdjustmentsHorizontalIcon className="w-5 h-5 text-red-600" />
                {t('cover_print_rev_label')}
              </label>
              <select
                name="cover_print_rev"
                value={payload.cover_print_rev}
                onChange={handleChange}
                className="block w-full py-3 px-5 rounded-xl border-gray-200 shadow-sm focus:border-red-500 focus:ring-red-500 text-sm transition-all duration-200 bg-gray-50/50"
              >
                {[0, 1, 2, 3, 4, 5, 6].map((v) => (
                  <option key={v} value={v}>
                    {v === 0 ? 'None' : `${v} color${v > 1 ? 's' : ''}`}
                  </option>
                ))}
              </select>
              <p className="mt-2 text-[11px] text-gray-400 italic leading-tight">
                {t('cover_print_rev_help')}
              </p>
            </div>
          </div>
        </div>

        {/* Section: Binding & Finishing */}
        <div className="space-y-6">
          <div className="flex items-center gap-4">
            <h3 className="text-[11px] font-bold text-gray-400 uppercase tracking-[0.2em] whitespace-nowrap">
              {t('section_binding')}
            </h3>
            <div className="h-px w-full bg-gray-100" />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="flex flex-col">
              <label className="flex items-center gap-2 font-bold text-gray-700 mb-2 uppercase tracking-wider text-[10px]">
                <TrophyIcon className="w-5 h-5 text-red-600" />
                {t('binding_method_label')}
              </label>
              <select
                name="binding_method"
                value={payload.binding_method}
                onChange={handleChange}
                className="block w-full py-3 px-5 rounded-xl border-gray-200 shadow-sm focus:border-red-500 focus:ring-red-500 text-sm transition-all duration-200 bg-gray-50/50"
              >
                {BINDING_METHODS.map((b) => (
                  <option key={b.value} value={b.value}>
                    {b.label}
                  </option>
                ))}
              </select>
              <p className="mt-2 text-[11px] text-gray-400 italic leading-tight">
                {t('binding_method_help')}
              </p>
            </div>

            <div className="flex flex-col">
              <label className="flex items-center gap-2 font-bold text-gray-700 mb-2 uppercase tracking-wider text-[10px]">
                <SparklesIcon className="w-5 h-5 text-red-600" />
                {t('finishing_options_label')}
              </label>
              <select
                name="finishing_options"
                value={payload.finishing_options}
                onChange={handleChange}
                className="block w-full py-3 px-5 rounded-xl border-gray-200 shadow-sm focus:border-red-500 focus:ring-red-500 text-sm transition-all duration-200 bg-gray-50/50"
              >
                {FINISHING_OPTIONS.map((f) => (
                  <option key={f.value} value={f.value}>
                    {f.label}
                  </option>
                ))}
              </select>
              <p className="mt-2 text-[11px] text-gray-400 italic leading-tight">
                {t('finishing_options_help')}
              </p>
            </div>

            <div className="flex flex-col">
              <label className="flex items-center gap-2 font-bold text-gray-700 mb-2 uppercase tracking-wider text-[10px]">
                <SunIcon className="w-5 h-5 text-red-600" />
                {t('uv_varnish_label')}
              </label>
              <div className="flex items-center gap-3 h-11">
                <input
                  id="uv_varnish"
                  type="checkbox"
                  name="uv_varnish"
                  checked={payload.uv_varnish}
                  onChange={handleChange}
                  className="h-6 w-6 text-red-600 border-gray-200 rounded-lg focus:ring-red-500 transition-all duration-200"
                />
                <label htmlFor="uv_varnish" className="text-sm font-semibold text-gray-700">
                  {payload.uv_varnish ? 'Apply Varnish' : 'No Varnish'}
                </label>
              </div>
              <p className="mt-2 text-[11px] text-gray-400 italic leading-tight">
                {t('uv_varnish_help')}
              </p>
            </div>
          </div>
        </div>

        {/* Hardcover options (conditional) */}
        {isHardcover && (
          <div className="bg-gradient-to-br from-gray-50 to-white border border-gray-200 rounded-2xl p-6 sm:p-8 shadow-inner">
            <h3 className="text-xs font-bold text-gray-500 mb-6 uppercase tracking-widest flex items-center gap-3">
              <WrenchIcon className="w-5 h-5" />
              Hardcover Premium Options
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
              <div className="flex flex-col">
                <label className="flex items-center gap-2 font-bold text-gray-700 mb-2 uppercase tracking-wider text-[10px]">
                  <DocumentTextIcon className="w-5 h-5 text-red-600" />
                  {t('endpapers_label')}
                </label>
                <select
                  name="endpapers"
                  value={payload.endpapers}
                  onChange={handleChange}
                  className="block w-full py-3 px-5 rounded-xl border-gray-200 shadow-sm focus:border-red-500 focus:ring-red-500 text-sm transition-all duration-200 bg-white"
                >
                  {ENDPAPERS_OPTIONS.map((e) => (
                    <option key={e.value} value={e.value}>
                      {e.label}
                    </option>
                  ))}
                </select>
                <p className="mt-2 text-[11px] text-gray-400 italic leading-tight">
                  {t('endpapers_help')}
                </p>
              </div>

              <div className="flex flex-col">
                <label className="flex items-center gap-2 font-bold text-gray-700 mb-2 uppercase tracking-wider text-[10px]">
                  <PaintBrushIcon className="w-5 h-5 text-red-600" />
                  {t('endpapers_print_label')}
                </label>
                <select
                  name="endpapers_print"
                  value={payload.endpapers_print}
                  onChange={handleChange}
                  disabled={payload.endpapers === 'none'}
                  className="block w-full py-3 px-5 rounded-xl border-gray-200 shadow-sm focus:border-red-500 focus:ring-red-500 text-sm disabled:opacity-50 transition-all duration-200 bg-white"
                >
                  {ENDPAPERS_PRINT_OPTIONS.map((e) => (
                    <option key={e.value} value={e.value}>
                      {e.label}
                    </option>
                  ))}
                </select>
                <p className="mt-2 text-[11px] text-gray-400 italic leading-tight">
                  {t('endpapers_print_help')}
                </p>
              </div>

              <div className="flex flex-col">
                <label className="flex items-center gap-2 font-bold text-gray-700 mb-2 uppercase tracking-wider text-[10px]">
                  <CogIcon className="w-5 h-5 text-red-600" />
                  {t('paper_type_endpaper_label')}
                </label>
                <select
                  name="paper_type_endpaper"
                  value={payload.paper_type_endpaper}
                  onChange={handleChange}
                  className="block w-full py-3 px-5 rounded-xl border-gray-200 shadow-sm focus:border-red-500 focus:ring-red-500 text-sm transition-all duration-200 bg-white"
                >
                  {PAPER_TYPE_ENDPAPER.map((p) => (
                    <option key={p.value} value={p.value}>
                      {p.label}
                    </option>
                  ))}
                </select>
                <p className="mt-2 text-[11px] text-gray-400 italic leading-tight">
                  {t('paper_type_endpaper_help')}
                </p>
              </div>

              <div className="flex flex-col">
                <label className="flex items-center gap-2 font-bold text-gray-700 mb-2 uppercase tracking-wider text-[10px]">
                  <ScaleIcon className="w-5 h-5 text-red-600" />
                  {t('paper_weight_endpapers_label')}
                </label>
                <select
                  name="paper_weight_endpapers"
                  value={payload.paper_weight_endpapers}
                  onChange={handleChange}
                  className="block w-full py-3 px-5 rounded-xl border-gray-200 shadow-sm focus:border-red-500 focus:ring-red-500 text-sm transition-all duration-200 bg-white"
                >
                  {ENDPAPERS_GSM_OPTIONS.map((n) => (
                    <option key={n} value={n}>
                      {n} gsm
                    </option>
                  ))}
                </select>
                <p className="mt-2 text-[11px] text-gray-400 italic leading-tight">
                  {t('paper_weight_endpapers_help')}
                </p>
              </div>
            </div>
          </div>
        )}


      </div>

      <div className="mt-12 flex justify-end">
        <button
          type="button"
          onClick={handleCalculatePrice}
          disabled={loading}
          className="inline-flex items-center rounded-xl bg-red-600 px-8 py-3 text-sm font-bold text-white shadow-lg hover:bg-red-700 focus:ring-4 focus:ring-red-100 disabled:opacity-50 transition-all duration-200 transform hover:-translate-y-0.5"
        >
          {loading ? (
            <>
              <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              Calculating...
            </>
          ) : (
            'Calculate price'
          )}
        </button>
      </div>
    </div>
  );
};

export default BookPriceForm;
