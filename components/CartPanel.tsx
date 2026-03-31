import React, { useState } from 'react';
import { CartItem } from '../types';

interface CartPanelProps {
  cart: CartItem[];
  checkingOut: boolean;
  onRemove: (itemId: string) => void;
  onCheckout: () => void;
}

const CartPanel: React.FC<CartPanelProps> = ({ cart, checkingOut, onRemove, onCheckout }) => {
  const [confirmOpen, setConfirmOpen] = useState(false);

  if (!cart.length) return null;

  const total = cart.reduce((sum, item) => sum + item.offer.total_cost, 0);
  const currency = cart[0]?.offer.currency || 'EUR';

  return (
    <div className="bg-corporate-secondary border border-corporate-accent/20 p-8 md:p-10 relative overflow-hidden">
      <div className="absolute top-0 right-0 opacity-[0.02] font-technical text-[8rem] font-black pointer-events-none uppercase">
        CART
      </div>

      <h2 className="text-[0.7rem] font-technical font-black tracking-monolith text-corporate-accent mb-8 uppercase flex items-center gap-3">
        <span className="w-2 h-2 bg-corporate-accent animate-pulse inline-block" />
        Cart_node — {cart.length} item{cart.length > 1 ? 's' : ''}
      </h2>

      <div className="space-y-4 mb-8">
        {cart.map((item) => (
          <div
            key={item.id}
            className="border border-corporate-text/10 bg-corporate-primary/50 p-6 flex items-start justify-between gap-6"
          >
            <div className="flex-1 min-w-0">
              <p className="text-xs font-technical font-black text-corporate-text uppercase tracking-monolith mb-1">
                {item.offer.print_house}
              </p>
              <p className="text-[10px] font-technical text-corporate-muted uppercase tracking-wider leading-relaxed">
                {item.specs.copies} copies · {item.specs.book_size} · {item.specs.binding_method} · {item.specs.interior_pages}pp
              </p>
              {item.offer.estimated_delivery_time && (
                <p className="text-[10px] font-technical text-corporate-muted uppercase tracking-wider mt-1">
                  ETA: {item.offer.estimated_delivery_time}
                </p>
              )}
            </div>
            <div className="flex items-center gap-6 shrink-0">
              <span className="text-xl font-display font-black text-corporate-text tracking-tighter">
                {item.offer.total_cost.toFixed(2)}{' '}
                <span className="text-corporate-accent text-xs">{item.offer.currency}</span>
              </span>
              <button
                type="button"
                onClick={() => onRemove(item.id)}
                className="text-[10px] font-technical font-black tracking-monolith text-corporate-muted hover:text-corporate-accent uppercase transition-colors"
              >
                [×] Remove
              </button>
            </div>
          </div>
        ))}
      </div>

      <div className="border-t border-corporate-text/10 pt-6 flex items-center justify-between gap-6">
        <div>
          <p className="text-[0.6rem] font-technical font-black tracking-monolith text-corporate-muted uppercase mb-1">
            Total
          </p>
          <p className="text-3xl font-display font-black text-corporate-text tracking-tighter">
            {total.toFixed(2)}{' '}
            <span className="text-corporate-accent text-sm">{currency}</span>
          </p>
        </div>

        {!confirmOpen ? (
          <button
            type="button"
            onClick={() => setConfirmOpen(true)}
            disabled={checkingOut}
            className="inline-flex items-center px-10 py-3 text-xs font-technical font-black tracking-monolith uppercase bg-corporate-accent text-white hover:bg-corporate-hover hover:shadow-[0_0_20px_rgba(220,0,0,0.2)] transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {checkingOut ? 'Processing…' : 'Confirm order →'}
          </button>
        ) : (
          <div className="flex items-center gap-3">
            <p className="text-[10px] font-technical text-corporate-text uppercase tracking-wider">
              Confirm submission?
            </p>
            <button
              type="button"
              onClick={() => { setConfirmOpen(false); onCheckout(); }}
              className="px-6 py-2 text-xs font-technical font-black tracking-monolith uppercase bg-corporate-accent text-white hover:bg-corporate-hover transition-all"
            >
              Yes, submit
            </button>
            <button
              type="button"
              onClick={() => setConfirmOpen(false)}
              className="px-6 py-2 text-xs font-technical font-black tracking-monolith uppercase border border-corporate-text/20 text-corporate-text hover:bg-corporate-text/5 transition-all"
            >
              Cancel
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default CartPanel;
