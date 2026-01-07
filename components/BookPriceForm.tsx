import React, { useState, useEffect } from 'react';
import {
  BOOK_SIZES,
  ORIENTATIONS,
  INTERIOR_PRINT_OPTIONS,
  COVER_PRINT_OPTIONS,
  BINDING_METHODS,
  FINISHING_OPTIONS,
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

const INTERIOR_GSM_OPTIONS = [70, 80, 90, 100, 105, 115, 120, 130, 135, 140, 150, 170];
const COVER_GSM_OPTIONS = [115, 135, 170, 200, 220, 240, 250, 270, 300, 320, 350, 400, 450];
const ENDPAPERS_GSM_OPTIONS = [0, 115, 135, 170];

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

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>
  ) => {
    const { name, value } = e.target;

    // Multi-select para finishing_options
    if (name === 'finishing_options' && e.target instanceof HTMLSelectElement) {
      const selected: string[] = Array.from(e.target.selectedOptions).map(
        (opt) => opt.value
      );
      const nextPayload = {
        ...payload,
        finishing_options: selected as any,
      };
      setPayload(nextPayload);
      onPayloadChange(nextPayload);
      return;
    }

    let newValue: any = value;

    if (name === 'copies' || name === 'interior_pages' || name === 'cover_pages') {
      newValue = Number.isNaN(parseInt(value, 10)) ? 0 : parseInt(value, 10);
    }
    if (
      name === 'paper_weight_interior' ||
      name === 'paper_weight_cover' ||
      name === 'paper_weight_endpapers'
    ) {
      newValue = Number.isNaN(parseInt(value, 10)) ? 0 : parseInt(value, 10);
    }

    const nextPayload = {
      ...payload,
      [name]: newValue,
    } as InitialBookPricePayload;

    setPayload(nextPayload);
    onPayloadChange(nextPayload);
  };

  const handleCheckboxChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const nextPayload = {
      ...payload,
      debug: e.target.checked,
    };
    setPayload(nextPayload);
    onPayloadChange(nextPayload);
  };

  return (
    <div className="bg-white shadow-md rounded-lg p-4 sm:p-6">
      <h2 className="text-sm font-semibold text-gray-800 mb-3">
        Book specifications
      </h2>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs sm:text-sm">
        {/* Copies */}
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

        {/* Interior pages */}
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
              Detected from PDF: approx. interior pages already pre-filled.
            </p>
          )}
        </div>

        {/* Book size */}
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

        {/* Orientation */}
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
                {o}
              </option>
            ))}
          </select>
        </div>

        {/* Interior print */}
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
                {m}
              </option>
            ))}
          </select>
        </div>

        {/* Cover print */}
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
                {m}
              </option>
            ))}
          </select>
        </div>

        {/* Interior GSM */}
        <div>
          <label className="block font-medium text-gray-700 mb-1">
            Interior paper weight (gsm)
          </label>
          <select
            name="paper_weight_interior"
            value={payload.paper_weight_interior}
            onChange={handleChange}
            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-red-600 focus:ring-red-600 text-sm"
          >
            {INTERIOR_GSM_OPTIONS.map((n) => (
              <option key={n} value={n}>
                {n} gsm
              </option>
            ))}
          </select>
        </div>

        {/* Cover GSM */}
        <div>
          <label className="block font-medium text-gray-700 mb-1">
            Cover paper weight (gsm)
          </label>
          <select
            name="paper_weight_cover"
            value={payload.paper_weight_cover}
            onChange={handleChange}
            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-red-600 focus:ring-red-600 text-sm"
          >
            {COVER_GSM_OPTIONS.map((n) => (
              <option key={n} value={n}>
                {n} gsm
              </option>
            ))}
          </select>
        </div>

        {/* Binding */}
        <div>
          <label className="block font-medium text-gray-700 mb-1">
            Binding
          </label>
          <select
            name="binding_method"
            value={payload.binding_method}
            onChange={handleChange}
            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-red-600 focus:ring-red-600 text-sm"
          >
            {BINDING_METHODS.map((b) => (
              <option key={b} value={b}>
                {b}
              </option>
            ))}
          </select>
        </div>

        {/* Finishing (multi-select) */}
        <div>
          <label className="block font-medium text-gray-700 mb-1">
            Finishing
          </label>
          <select
            multiple
            name="finishing_options"
            value={payload.finishing_options}
            onChange={handleChange}
            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-red-600 focus:ring-red-600 text-sm h-20"
          >
            {FINISHING_OPTIONS.map((f) => (
              <option key={f} value={f}>
                {f}
              </option>
            ))}
          </select>
          <p className="mt-1 text-[11px] text-gray-500">
            Ctrl/Cmd + click to select multiple options.
          </p>
        </div>

        {/* Delivery country */}
        <div>
          <label className="block font-medium text-gray-700 mb-1">
            Delivery country
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

        {/* Endpapers mode */}
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
            <option value="none">None</option>
            <option value="auto">Auto</option>
            <option value="blank">Blank</option>
            <option value="1/0">1/0</option>
            <option value="4/0">4/0</option>
            <option value="4/4">4/4</option>
          </select>
        </div>

        {/* Endpapers print */}
        <div>
          <label className="block font-medium text-gray-700 mb-1">
            Endpapers print
          </label>
          <select
            name="endpapers_print"
            value={payload.endpapers_print}
            onChange={handleChange}
            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-red-600 focus:ring-red-600 text-sm"
          >
            <option value="none">None</option>
            <option value="1/0">1/0</option>
            <option value="4/0">4/0</option>
            <option value="4/4">4/4</option>
          </select>
        </div>

        {/* Endpapers GSM */}
        <div>
          <label className="block font-medium text-gray-700 mb-1">
            Endpapers paper weight (gsm)
          </label>
          <select
            name="paper_weight_endpapers"
            value={payload.paper_weight_endpapers}
            onChange={handleChange}
            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-red-600 focus:ring-red-600 text-sm"
          >
            {ENDPAPERS_GSM_OPTIONS.map((n) => (
              <option key={n} value={n}>
                {n === 0 ? '0 (none)' : `${n} gsm`}
              </option>
            ))}
          </select>
        </div>

        {/* Debug */}
        <div className="flex items-center mt-4">
          <input
            id="debug"
            type="checkbox"
            checked={payload.debug}
            onChange={handleCheckboxChange}
            className="h-4 w-4 text-red-600 border-gray-300 rounded"
          />
          <label htmlFor="debug" className="ml-2 block text-xs text-gray-700">
            Debug mode (show internal parameters)
          </label>
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
