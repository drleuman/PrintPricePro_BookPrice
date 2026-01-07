import React, { useState, useEffect } from 'react';
import {
  BOOK_SIZES,
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
} from '../constants';
import { InitialBookPricePayload } from '../types';

interface BookPriceFormProps {
  initialPayload: InitialBookPricePayload;
  onPayloadChange: (payload: InitialBookPricePayload) => void;
  onCalculatePrice: () => void;
  loading: boolean;
  hasPdf: boolean;
}

const BookPriceForm: React.FC<BookPriceFormProps> = ({
  initialPayload,
  onPayloadChange,
  onCalculatePrice,
  loading,
  hasPdf,
}) => {
  const [payload, setPayload] = useState<InitialBookPricePayload>(initialPayload);

  useEffect(() => {
    setPayload(initialPayload);
  }, [initialPayload]);

  // Check if hardcover is selected
  const isHardcover = payload.binding_method === 'thread_sewn_hc';

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

    setPayload(nextPayload);
    onPayloadChange(nextPayload);
  };

  return (
    <div className="bg-white shadow-md rounded-lg p-4 sm:p-6">
      <h2 className="text-sm font-semibold text-gray-800 mb-3">
        Book specifications
      </h2>

      <div className="flex flex-col gap-4 text-xs sm:text-sm">
        {/* Row 1: Copies, Country, Size */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div>
            <label className="block font-medium text-gray-700 mb-1">
              Copies
            </label>
            <input
              type="number"
              name="copies"
              min={1}
              value={payload.copies}
              onChange={handleChange}
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-red-600 focus:ring-red-600 text-sm"
            />
          </div>

          <div>
            <label className="block font-medium text-gray-700 mb-1">
              Delivery country (ISO2)
            </label>
            <select
              name="delivery_country"
              value={payload.delivery_country}
              onChange={handleChange}
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-red-600 focus:ring-red-600 text-sm"
            >
              {DELIVERY_COUNTRIES.map((c) => (
                <option key={c.code} value={c.code}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block font-medium text-gray-700 mb-1">
              Book size
            </label>
            <select
              name="book_size"
              value={payload.book_size}
              onChange={handleChange}
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-red-600 focus:ring-red-600 text-sm"
            >
              {BOOK_SIZES.map((size) => (
                <option key={size} value={size}>
                  {size}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Row 2: Interior pages, Cover pages, Orientation */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div>
            <label className="block font-medium text-gray-700 mb-1">
              Interior pages
            </label>
            <input
              type="number"
              name="interior_pages"
              min={0}
              value={payload.interior_pages}
              onChange={handleChange}
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-red-600 focus:ring-red-600 text-sm"
            />
            {hasPdf && (
              <p className="mt-1 text-[11px] text-gray-500">
                Detected from PDF
              </p>
            )}
          </div>

          <div>
            <label className="block font-medium text-gray-700 mb-1">
              Cover pages
            </label>
            <input
              type="number"
              name="cover_pages"
              min={0}
              value={payload.cover_pages}
              onChange={handleChange}
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-red-600 focus:ring-red-600 text-sm"
            />
          </div>

          <div>
            <label className="block font-medium text-gray-700 mb-1">
              Orientation
            </label>
            <select
              name="orientation"
              value={payload.orientation}
              onChange={handleChange}
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-red-600 focus:ring-red-600 text-sm"
            >
              {ORIENTATIONS.map((o) => (
                <option key={o} value={o}>
                  {o.charAt(0).toUpperCase() + o.slice(1)}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Row 3: Interior print, Paper type interior, Interior GSM, PMS interior */}
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
          <div>
            <label className="block font-medium text-gray-700 mb-1">
              Interior print
            </label>
            <select
              name="interior_print"
              value={payload.interior_print}
              onChange={handleChange}
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-red-600 focus:ring-red-600 text-sm"
            >
              {INTERIOR_PRINT_OPTIONS.map((m) => (
                <option key={m} value={m}>
                  {m === '4/4' ? '4/4 colors' : m === '2/2' ? '2/2 colors' : '1/1 bw'}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block font-medium text-gray-700 mb-1">
              Paper Interior (type)
            </label>
            <select
              name="paper_type_interior"
              value={payload.paper_type_interior}
              onChange={handleChange}
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-red-600 focus:ring-red-600 text-sm"
            >
              {PAPER_TYPE_INTERIOR.map((p) => (
                <option key={p.value} value={p.value}>
                  {p.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block font-medium text-gray-700 mb-1">
              Interior Paper Weight (gsm)
            </label>
            <select
              name="paper_weight_interior"
              value={payload.paper_weight_interior}
              onChange={handleChange}
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-red-600 focus:ring-red-600 text-sm"
            >
              {INTERIOR_GSM_OPTIONS.map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block font-medium text-gray-700 mb-1">
              PMS in interior
            </label>
            <input
              type="number"
              name="pms_interior"
              min={1}
              max={3}
              value={payload.pms_interior}
              onChange={handleChange}
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-red-600 focus:ring-red-600 text-sm"
            />
          </div>
        </div>

        {/* Row 4: Cover print, Paper type cover, Cover GSM, PMS cover */}
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
          <div>
            <label className="block font-medium text-gray-700 mb-1">
              Cover print
            </label>
            <select
              name="cover_print"
              value={payload.cover_print}
              onChange={handleChange}
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-red-600 focus:ring-red-600 text-sm"
            >
              {COVER_PRINT_OPTIONS.map((m) => (
                <option key={m} value={m}>
                  {m === '4/0' ? '4/0 standard' : m === '4/4' ? '4/4 both sides' : '1/0 bw'}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block font-medium text-gray-700 mb-1">
              Paper Cover (type)
            </label>
            <select
              name="paper_type_cover"
              value={payload.paper_type_cover}
              onChange={handleChange}
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-red-600 focus:ring-red-600 text-sm"
            >
              {PAPER_TYPE_COVER.map((p) => (
                <option key={p.value} value={p.value}>
                  {p.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block font-medium text-gray-700 mb-1">
              Cover Paper Weight (gsm)
            </label>
            <select
              name="paper_weight_cover"
              value={payload.paper_weight_cover}
              onChange={handleChange}
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-red-600 focus:ring-red-600 text-sm"
            >
              {COVER_GSM_OPTIONS.map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block font-medium text-gray-700 mb-1">
              PMS on cover
            </label>
            <input
              type="number"
              name="pms_cover"
              min={1}
              max={3}
              value={payload.pms_cover}
              onChange={handleChange}
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-red-600 focus:ring-red-600 text-sm"
            />
          </div>
        </div>

        {/* Row 5: Cover print rev, Binding, Finishing, UV varnish */}
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
          <div>
            <label className="block font-medium text-gray-700 mb-1">
              Cover print reverse
            </label>
            <input
              type="number"
              name="cover_print_rev"
              min={1}
              max={6}
              value={payload.cover_print_rev}
              onChange={handleChange}
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-red-600 focus:ring-red-600 text-sm"
            />
          </div>

          <div>
            <label className="block font-medium text-gray-700 mb-1">
              Binding method
            </label>
            <select
              name="binding_method"
              value={payload.binding_method}
              onChange={handleChange}
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-red-600 focus:ring-red-600 text-sm"
            >
              {BINDING_METHODS.map((b) => (
                <option key={b.value} value={b.value}>
                  {b.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block font-medium text-gray-700 mb-1">
              Finishing
            </label>
            <select
              name="finishing_options"
              value={payload.finishing_options}
              onChange={handleChange}
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-red-600 focus:ring-red-600 text-sm"
            >
              {FINISHING_OPTIONS.map((f) => (
                <option key={f.value} value={f.value}>
                  {f.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block font-medium text-gray-700 mb-1">
              Extra UV Varnish
            </label>
            <div className="mt-1 flex items-center h-10">
              <input
                id="uv_varnish"
                type="checkbox"
                name="uv_varnish"
                checked={payload.uv_varnish}
                onChange={handleChange}
                className="h-4 w-4 text-red-600 border-gray-300 rounded focus:ring-red-600"
              />
              <label htmlFor="uv_varnish" className="ml-2 block text-sm text-gray-700">
                {payload.uv_varnish ? 'Yes' : 'No'}
              </label>
            </div>
          </div>
        </div>

        {/* Hardcover options (conditional) */}
        {isHardcover && (
          <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
            <h3 className="text-sm font-semibold text-gray-800 mb-3">
              Hardcover options
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
              <div>
                <label className="block font-medium text-gray-700 mb-1">
                  Endpapers
                </label>
                <select
                  name="endpapers"
                  value={payload.endpapers}
                  onChange={handleChange}
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-red-600 focus:ring-red-600 text-sm"
                >
                  {ENDPAPERS_OPTIONS.map((e) => (
                    <option key={e.value} value={e.value}>
                      {e.label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block font-medium text-gray-700 mb-1">
                  Endpapers print
                </label>
                <select
                  name="endpapers_print"
                  value={payload.endpapers_print}
                  onChange={handleChange}
                  disabled={payload.endpapers === 'none'}
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-red-600 focus:ring-red-600 text-sm disabled:opacity-50"
                >
                  {ENDPAPERS_PRINT_OPTIONS.map((e) => (
                    <option key={e.value} value={e.value}>
                      {e.label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block font-medium text-gray-700 mb-1">
                  Paper endpapers (type)
                </label>
                <select
                  name="paper_type_endpaper"
                  value={payload.paper_type_endpaper}
                  onChange={handleChange}
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-red-600 focus:ring-red-600 text-sm"
                >
                  {PAPER_TYPE_ENDPAPER.map((p) => (
                    <option key={p.value} value={p.value}>
                      {p.label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block font-medium text-gray-700 mb-1">
                  Endpapers Paper Weight (gsm)
                </label>
                <select
                  name="paper_weight_endpapers"
                  value={payload.paper_weight_endpapers}
                  onChange={handleChange}
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-red-600 focus:ring-red-600 text-sm"
                >
                  {ENDPAPERS_GSM_OPTIONS.map((n) => (
                    <option key={n} value={n}>
                      {n}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <p className="mt-2 text-[11px] text-gray-500">
              These options are sent as <code className="bg-gray-200 px-1 rounded">endpapers</code>, <code className="bg-gray-200 px-1 rounded">endpapers_print</code>, <code className="bg-gray-200 px-1 rounded">paper_type_endpaper</code>, <code className="bg-gray-200 px-1 rounded">paper_weight_endpapers</code>.
            </p>
          </div>
        )}

        {/* Extra costs section */}
        <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
          <h3 className="text-sm font-semibold text-gray-800 mb-3">
            Extra options
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
            <div>
              <label className="block font-medium text-gray-700 mb-1">
                Per book
              </label>
              <input
                type="number"
                name="extra_book"
                min={0}
                step={1}
                value={payload.extra_book}
                onChange={handleChange}
                placeholder="0"
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-red-600 focus:ring-red-600 text-sm"
              />
            </div>

            <div>
              <label className="block font-medium text-gray-700 mb-1">
                Per section
              </label>
              <input
                type="number"
                name="extra_section"
                min={0}
                step={1}
                value={payload.extra_section}
                onChange={handleChange}
                placeholder="0"
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-red-600 focus:ring-red-600 text-sm"
              />
            </div>

            <div>
              <label className="block font-medium text-gray-700 mb-1">
                Fixed
              </label>
              <input
                type="number"
                name="extra_fixed"
                min={0}
                max={999.99}
                step={0.01}
                value={payload.extra_fixed}
                onChange={handleChange}
                placeholder="0"
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-red-600 focus:ring-red-600 text-sm"
              />
            </div>

            <div>
              <label className="block font-medium text-gray-700 mb-1">
                Variable
              </label>
              <input
                type="number"
                name="extra_variable"
                min={0}
                max={999.99}
                step={0.01}
                value={payload.extra_variable}
                onChange={handleChange}
                placeholder="0"
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-red-600 focus:ring-red-600 text-sm"
              />
            </div>
          </div>
          <p className="mt-2 text-[11px] text-gray-500">
            These options are sent as <code className="bg-gray-200 px-1 rounded">extra_book</code>, <code className="bg-gray-200 px-1 rounded">extra_section</code>, <code className="bg-gray-200 px-1 rounded">extra_fixed</code>, <code className="bg-gray-200 px-1 rounded">extra_variable</code>.
          </p>
        </div>
      </div>

      <div className="mt-4 flex justify-end">
        <button
          type="button"
          onClick={onCalculatePrice}
          disabled={loading}
          className="inline-flex items-center rounded-md bg-red-700 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-red-800 disabled:opacity-50"
        >
          {loading ? 'Calculating…' : 'Calculate price'}
        </button>
      </div>
    </div>
  );
};

export default BookPriceForm;
