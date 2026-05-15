import React, { useState } from 'react';
import { BookPriceResponse, BookPriceOffer } from '../types';
import { t } from '../i18n/en';

interface PrintOffersPanelProps {
  offers: BookPriceResponse | null;
  loading: boolean;
  error?: string | null;
  onChooseOffer: (offer: BookPriceOffer) => void;
  selectedOfferId?: string | null;
}

const PrintOffersPanel: React.FC<PrintOffersPanelProps> = ({
  offers,
  loading,
  error,
  onChooseOffer,
  selectedOfferId,
}) => {
  const [openBreakdownId, setOpenBreakdownId] = useState<string | null>(null);

  const handleToggleBreakdown = (id: string) => {
    setOpenBreakdownId((prev) => (prev === id ? null : id));
  };

  if (loading) {
    return (
      <div className="bg-corporate-secondary p-8 border border-corporate-text/10 flex items-center gap-4">
        <div className="w-4 h-4 bg-corporate-accent animate-pulse" />
        <p className="text-xs font-technical font-black tracking-monolith text-corporate-text-secondary uppercase">
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
        <p className="text-[0.6rem] font-technical font-black tracking-monolith text-corporate-muted uppercase mb-4">status: waiting_for_input</p>
        <p className="text-xs text-corporate-text-secondary leading-relaxed uppercase tracking-wider">
          {t('enter_specs_or_upload_pdf')}
        </p>
      </div>
    );
  }

  const getDisplayPrice = (offer: BookPriceOffer) =>
    Number(offer.total_price ?? offer.total_cost ?? Number.MAX_SAFE_INTEGER);

  const sorted = [...offers.offers].sort(
    (a, b) => getDisplayPrice(a) - getDisplayPrice(b)
  );

  const recommended = offers.offers.find(o => o.recommended);
  const topThree = sorted.slice(0, 3);

  const visibleOffers =
    recommended && !topThree.some(o => o.id === recommended.id)
      ? [...topThree, recommended]
      : topThree;

  return (
    <div className="bg-corporate-secondary p-8 md:p-12 border border-white/5 relative overflow-hidden">
      <div className="absolute top-0 right-0 opacity-[0.02] font-technical text-[8rem] font-black pointer-events-none uppercase">
        PR_H
      </div>
      <h2 className="text-[0.7rem] font-technical font-black tracking-monolith text-corporate-accent mb-12 flex items-center gap-4 uppercase relative z-10">
        Best print offers
      </h2>

      <div className="space-y-6">
        {visibleOffers.map((offer, index) => {
          const isBestPrice = index === 0;
          const isSelected = selectedOfferId === offer.id;
          const isOpen = openBreakdownId === offer.id;
          const displayPrice = getDisplayPrice(offer);
          const hasFiniteDisplayPrice = Number.isFinite(displayPrice) && displayPrice < Number.MAX_SAFE_INTEGER;

          return (
            <div
              key={offer.id}
              className={`border p-8 flex flex-col gap-6 transition-all duration-300 relative group overflow-hidden ${
                isSelected ? 'border-corporate-accent/30 bg-corporate-primary' : 'border-corporate-text/10 bg-corporate-primary/50'
              }`}
            >
              <div className="absolute top-0 right-0 h-1 bg-corporate-accent w-0 group-hover:w-full transition-all duration-500" />
              <div className="flex justify-between items-start gap-6 relative z-10">
                <div>
                  <div className="flex items-center gap-3 mb-2">
                    <p className="text-xs font-technical font-black text-corporate-text uppercase tracking-monolith">
                      {offer.print_house}
                    </p>
                    {isRecommended && (
                      <span className="bg-corporate-accent/10 text-corporate-accent text-[9px] font-technical font-black px-2 py-0.5 border border-corporate-accent/20 tracking-tighter">
                        RECOMMENDED BY BPE
                      </span>
                    )}
                  </div>
                  {offer.checkout_allowed === false && (
                    <p className="text-[10px] font-technical text-corporate-accent uppercase tracking-wider mb-2">
                      {offer.message || offer.status || 'Precision quote required'}
                    </p>
                  )}
                  {offer.estimated_delivery_time && (
                    <div className="flex items-center gap-2">
                      <div className="w-1 h-1 bg-corporate-accent animate-pulse" />
                      <p className="text-[10px] font-technical text-corporate-muted uppercase tracking-wider">
                        ETA: {offer.estimated_delivery_time}
                      </p>
                    </div>
                  )}
                </div>
                <div className="text-right">
                  {offer.range ? (
                    <p className="text-2xl font-display font-black text-corporate-text tracking-tighter">
                      {offer.range}
                    </p>
                  ) : hasFiniteDisplayPrice ? (
                    <p className="text-3xl font-display font-black text-corporate-text tracking-tighter">
                      {displayPrice.toFixed(2)} <span className="text-corporate-accent text-sm">{offer.currency}</span>
                    </p>
                  ) : (
                    <p className="text-xl font-display font-black text-corporate-muted tracking-tighter uppercase">
                      Price unavailable
                    </p>
                  )}
                  {isSelected && (
                    <p className="text-[10px] text-corporate-accent font-technical font-black uppercase tracking-monolith mt-1">
                      SELECTED BY YOU
                    </p>
                  )}
                  {!isSelected && isBestPrice && (
                    <p className="text-[10px] text-corporate-muted font-technical font-black uppercase tracking-monolith mt-1">
                      BEST PRICE
                    </p>
                  )}
                </div>
              </div>

              {/* Breakdown toggle */}
              {offer.checkout_allowed !== false && offer.breakdown && offer.breakdown.length > 0 && (
                <div className="border-t border-corporate-text/10 pt-6 mt-4">
                  <button
                    type="button"
                    onClick={() => handleToggleBreakdown(offer.id)}
                    className="text-xs font-technical font-black text-corporate-accent uppercase tracking-monolith flex items-center gap-2 hover:text-corporate-text transition-colors"
                  >
                    {isOpen ? 'Close system_breakdown [-]' : 'View system_breakdown [+]'}
                  </button>
                  {isOpen && (
                    <ul className="mt-6 space-y-3">
                      {offer.breakdown.map((line, idx) => (
                        <li
                          key={idx}
                          className="flex justify-between border-b border-corporate-text/10 pb-2 last:border-none"
                        >
                          <span className="text-[11px] font-technical text-corporate-text-secondary uppercase tracking-wider">{line.label}</span>
                          <span className="text-[11px] font-technical text-corporate-text font-bold">
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
                  disabled={offer.checkout_allowed === false}
                  onClick={() => onChooseOffer(offer)}
                  className={`inline-flex items-center px-8 py-3 text-xs font-technical font-black tracking-monolith uppercase transition-all duration-300
                    ${isSelected
                      ? 'bg-corporate-accent/20 border border-corporate-accent/40 text-corporate-accent cursor-default'
                      : offer.checkout_allowed === false
                        ? 'bg-corporate-muted/20 border border-corporate-muted/20 text-corporate-muted cursor-not-allowed'
                        : isBestPrice || isRecommended
                          ? 'bg-corporate-accent text-white hover:bg-corporate-hover hover:shadow-[0_0_20px_rgba(220,0,0,0.2)]'
                          : 'bg-transparent border border-corporate-text/20 text-corporate-text hover:bg-corporate-text/5'
                    }`}
                >
                  {isSelected 
                    ? '[✓] SELECTED_FOR_CART' 
                    : offer.checkout_allowed === false
                      ? '[!] Precision Quote Required'
                      : selectedOfferId 
                        ? 'Replace selection →' 
                        : 'Choose this offer →'}
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
