import React, { useState } from 'react';
import { BookPriceResponse, BookPriceOffer } from '../types';

interface PrintOffersPanelProps {
  offers: BookPriceResponse | null;
  loading: boolean;
  error?: string | null;
  onChooseOffer: (offer: BookPriceOffer) => void;
}

const PrintOffersPanel: React.FC<PrintOffersPanelProps> = ({
  offers,
  loading,
  error,
  onChooseOffer,
}) => {
  const [openBreakdownId, setOpenBreakdownId] = useState<string | null>(null);

  if (loading) {
    return (
      <div className="bg-white shadow-md rounded-lg p-4 sm:p-6">
        <p className="text-sm text-gray-600">Calculating offers…</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-white shadow-md rounded-lg p-4 sm:p-6">
        <p className="text-sm text-red-600">Error: {error}</p>
      </div>
    );
  }

  if (!offers || !offers.offers.length) {
    return (
      <div className="bg-white shadow-md rounded-lg p-4 sm:p-6">
        <p className="text-sm text-gray-500">
          No offers yet. Upload a PDF and fill in the form, then click “Calculate price”.
        </p>
      </div>
    );
  }

  // Tomar solo las 3 mejores (más baratas)
  const sorted = [...offers.offers].sort(
    (a, b) => a.total_cost - b.total_cost
  );
  const topThree = sorted.slice(0, 3);

  const handleToggleBreakdown = (id: string) => {
    setOpenBreakdownId((prev) => (prev === id ? null : id));
  };

  return (
    <div className="bg-white shadow-md rounded-lg p-4 sm:p-6">
      <h2 className="text-sm font-semibold text-gray-800 mb-3">
        Best print offers (top 3)
      </h2>

      <div className="space-y-3">
        {topThree.map((offer, index) => {
          const isBest = index === 0;
          const isOpen = openBreakdownId === offer.id;

          return (
            <div
              key={offer.id}
              className={`border rounded-lg p-3 text-sm flex flex-col gap-2 ${
                isBest ? 'border-red-600 bg-red-50/60' : 'border-gray-200'
              }`}
            >
              <div className="flex justify-between items-start gap-2">
                <div>
                  <p className="font-semibold text-gray-800">
                    {offer.print_house}
                  </p>
                  {offer.estimated_delivery_time && (
                    <p className="text-xs text-gray-500">
                      ETA: {offer.estimated_delivery_time}
                    </p>
                  )}
                </div>
                <div className="text-right">
                  <p className="text-base font-semibold text-gray-900">
                    {offer.total_cost.toFixed(2)} {offer.currency}
                  </p>
                  {isBest && (
                    <p className="text-[11px] text-red-700 font-medium">
                      Best price
                    </p>
                  )}
                </div>
              </div>

              {/* Breakdown toggle */}
              {offer.breakdown && offer.breakdown.length > 0 && (
                <div>
                  <button
                    type="button"
                    onClick={() => handleToggleBreakdown(offer.id)}
                    className="text-xs text-gray-700 underline underline-offset-2"
                  >
                    {isOpen ? 'Hide cost breakdown' : 'Show cost breakdown'}
                  </button>
                  {isOpen && (
                    <ul className="mt-2 space-y-1 text-xs text-gray-700">
                      {offer.breakdown.map((line, idx) => (
                        <li
                          key={idx}
                          className="flex justify-between border-b border-dashed border-gray-200 pb-0.5"
                        >
                          <span>{line.label}</span>
                          <span>
                            {line.amount.toFixed(2)} {offer.currency}
                          </span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              )}

              <div className="flex justify-end pt-1">
                <button
                  type="button"
                  onClick={() => onChooseOffer(offer)}
                  className={`inline-flex items-center rounded-md px-3 py-1.5 text-xs font-medium shadow-sm
                    ${isBest
                      ? 'bg-red-700 text-white hover:bg-red-800'
                      : 'bg-emerald-600 text-white hover:bg-emerald-700'
                    }`}
                >
                  {isBest ? 'Choose this offer' : 'Choose this offer'}
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default PrintOffersPanel;
