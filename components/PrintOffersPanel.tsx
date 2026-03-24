import React, { useState } from 'react';
import { BookPriceResponse, BookPriceOffer } from '../types';
import { t } from '../i18n/en';

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

  const handleToggleBreakdown = (id: string) => {
    setOpenBreakdownId((prev) => (prev === id ? null : id));
  };

  if (loading) {
    return (
      <div className="bg-corporate-secondary p-8 border border-white/5 flex items-center gap-4">
        <div className="w-4 h-4 bg-corporate-accent animate-pulse" />
        <p className="text-[0.6rem] font-technical font-black tracking-monolith text-corporate-text-secondary uppercase">
          Calculating node_offers…
        </p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-corporate-secondary p-8 border border-corporate-accent/20">
        <p className="text-[0.6rem] font-technical font-black tracking-monolith text-corporate-accent uppercase mb-2">System Error</p>
        <p className="text-sm text-corporate-text-secondary">{error}</p>
      </div>
    );
  }

  if (!offers || !offers.offers.length) {
    return (
      <div className="bg-corporate-secondary p-12 border border-white/5 relative overflow-hidden">
        <div className="absolute top-0 right-0 opacity-[0.02] font-technical text-[8rem] font-black pointer-events-none uppercase">
          NULL
        </div>
        <p className="text-[0.6rem] font-technical font-black tracking-monolith text-corporate-muted uppercase mb-4">status: waiting_for_input</p>
        <p className="text-xs text-corporate-text-secondary leading-relaxed uppercase tracking-wider">
          {t('enter_specs_or_upload_pdf')}
        </p>
      </div>
    );
  }

  // Tomar solo las 3 mejores (más baratas)
  const sorted = [...offers.offers].sort(
    (a, b) => a.total_cost - b.total_cost
  );
  const topThree = sorted.slice(0, 3);

  return (
    <div className="bg-corporate-secondary p-8 md:p-12 border border-white/5 relative overflow-hidden">
      <div className="absolute top-0 right-0 opacity-[0.02] font-technical text-[8rem] font-black pointer-events-none uppercase">
        PR_H
      </div>
      <h2 className="text-[0.7rem] font-technical font-black tracking-monolith text-corporate-accent mb-12 flex items-center gap-4 uppercase relative z-10">
        Best print offers (top 3)
      </h2>

      <div className="space-y-6">
        {topThree.map((offer, index) => {
          const isBest = index === 0;
          const isOpen = openBreakdownId === offer.id;

          return (
            <div
              key={offer.id}
              className={`border p-8 flex flex-col gap-6 transition-all duration-300 relative group overflow-hidden ${
                isBest ? 'border-corporate-accent/30 bg-corporate-primary' : 'border-white/5 bg-corporate-primary/50'
              }`}
            >
              <div className="absolute top-0 right-0 h-1 bg-corporate-accent w-0 group-hover:w-full transition-all duration-500" />
              <div className="flex justify-between items-start gap-6 relative z-10">
                <div>
                  <p className="text-[10px] font-technical font-black text-white uppercase tracking-monolith mb-2">
                    {offer.print_house}
                  </p>
                  {offer.estimated_delivery_time && (
                    <div className="flex items-center gap-2">
                      <div className="w-1 h-1 bg-corporate-accent animate-pulse" />
                      <p className="text-[0.6rem] font-technical text-corporate-muted uppercase tracking-wider">
                        ETA: {offer.estimated_delivery_time}
                      </p>
                    </div>
                  )}
                </div>
                <div className="text-right">
                  <p className="text-3xl font-display font-black text-white tracking-tighter">
                    {offer.total_cost.toFixed(2)} <span className="text-corporate-accent text-sm">{offer.currency}</span>
                  </p>
                  {isBest && (
                    <p className="text-[10px] text-corporate-accent font-technical font-black uppercase tracking-monolith mt-1">
                      OPTIMAL_VALUE
                    </p>
                  )}
                </div>
              </div>

              {/* Breakdown toggle */}
              {offer.breakdown && offer.breakdown.length > 0 && (
                <div className="border-t border-white/5 pt-6 mt-4">
                  <button
                    type="button"
                    onClick={() => handleToggleBreakdown(offer.id)}
                    className="text-[0.6rem] font-technical font-black text-corporate-accent uppercase tracking-monolith flex items-center gap-2 hover:text-white transition-colors"
                  >
                    {isOpen ? 'Close system_breakdown [-]' : 'View system_breakdown [+]'}
                  </button>
                  {isOpen && (
                    <ul className="mt-6 space-y-3">
                      {offer.breakdown.map((line, idx) => (
                        <li
                          key={idx}
                          className="flex justify-between border-b border-white/5 pb-2 last:border-none"
                        >
                          <span className="text-[10px] font-technical text-corporate-text-secondary uppercase tracking-wider">{line.label}</span>
                          <span className="text-[10px] font-technical text-white font-bold">
                            {line.amount.toFixed(2)} {offer.currency}
                          </span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              )}

              <div className="flex justify-end pt-4">
                <button
                  type="button"
                  onClick={() => onChooseOffer(offer)}
                  className={`inline-flex items-center px-8 py-3 text-[0.6rem] font-technical font-black tracking-monolith uppercase transition-all duration-300
                    ${isBest
                      ? 'bg-corporate-accent text-white hover:bg-corporate-hover hover:shadow-[0_0_20px_rgba(220,0,0,0.2)]'
                      : 'bg-transparent border border-white/10 text-white hover:bg-white/5'
                    }`}
                >
                  Choose this node
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
