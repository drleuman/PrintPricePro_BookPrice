import React, { useEffect, useState } from 'react';
import {
  XMarkIcon,
  ArrowPathIcon,
  ExclamationCircleIcon,
  ClipboardDocumentListIcon,
} from '@heroicons/react/24/outline';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
interface Order {
  id: number;
  order_ref: string;
  user_id: string | number;
  specs: Record<string, unknown>;
  offer_print_house: string;
  offer_price: number;
  status: string;
  created_at: string;
}

interface UserOrdersProps {
  userId: string | number;
  onClose: () => void;
}

// ---------------------------------------------------------------------------
// Status badge
// ---------------------------------------------------------------------------
const STATUS_COLORS: Record<string, string> = {
  pending:    'bg-yellow-500/10 text-yellow-400 border-yellow-500/30',
  confirmed:  'bg-blue-500/10 text-blue-400 border-blue-500/30',
  processing: 'bg-purple-500/10 text-purple-400 border-purple-500/30',
  shipped:    'bg-indigo-500/10 text-indigo-400 border-indigo-500/30',
  delivered:  'bg-green-500/10 text-green-400 border-green-500/30',
  cancelled:  'bg-red-500/10 text-red-400 border-red-500/30',
};

const StatusBadge: React.FC<{ status: string }> = ({ status }) => {
  const colors = STATUS_COLORS[status] ?? 'bg-white/5 text-corporate-muted border-white/10';
  return (
    <span className={`inline-flex items-center px-2 py-0.5 text-[0.6rem] font-black uppercase tracking-widest border ${colors}`}>
      {status}
    </span>
  );
};

// ---------------------------------------------------------------------------
// UserOrders modal
// ---------------------------------------------------------------------------
const UserOrders: React.FC<UserOrdersProps> = ({ userId, onClose }) => {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchOrders = async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(`/api/orders?user_id=${encodeURIComponent(userId)}`);
        const data = await res.json();
        if (!res.ok) {
          setError(data?.error || 'Failed to load orders.');
          return;
        }
        setOrders(data.orders ?? []);
      } catch {
        setError('Connection error. Please try again.');
      } finally {
        setLoading(false);
      }
    };
    fetchOrders();
  }, [userId]);

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center backdrop-blur-sm"
      style={{ backgroundColor: 'rgba(0,0,0,0.75)' }}
      onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="relative w-full max-w-[680px] max-h-[85vh] flex flex-col border border-white/10 bg-corporate-secondary shadow-[0_0_120px_rgba(220,0,0,0.1)] overflow-hidden">
        {/* Top accent bar */}
        <div className="h-[2px] w-full shrink-0 bg-corporate-accent shadow-[0_0_15px_#dc0000]" />

        {/* Header */}
        <div className="flex items-center justify-between px-8 py-5 border-b border-white/5 shrink-0">
          <div className="flex items-center gap-3">
            <ClipboardDocumentListIcon className="w-5 h-5 text-corporate-accent" />
            <h2 className="text-[0.85rem] font-black uppercase tracking-[0.2em] text-corporate-text">
              My Orders
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex items-center justify-center w-8 h-8 text-corporate-muted hover:text-corporate-accent transition-colors"
            aria-label="Close"
          >
            <XMarkIcon className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-8 py-6">
          {loading && (
            <div className="flex items-center justify-center py-16 gap-3 text-corporate-muted">
              <ArrowPathIcon className="w-5 h-5 animate-spin" />
              <span className="text-[0.75rem] font-technical uppercase tracking-widest">Loading orders…</span>
            </div>
          )}

          {!loading && error && (
            <div className="flex items-center gap-4 bg-corporate-accent/5 border border-corporate-accent/30 px-5 py-4">
              <ExclamationCircleIcon className="w-5 h-5 text-corporate-accent shrink-0" />
              <span className="text-[0.75rem] font-bold text-corporate-accent uppercase tracking-wider">{error}</span>
            </div>
          )}

          {!loading && !error && orders.length === 0 && (
            <div className="flex flex-col items-center justify-center py-16 gap-4">
              <ClipboardDocumentListIcon className="w-12 h-12 text-corporate-muted opacity-30" />
              <p className="text-[0.75rem] font-technical text-corporate-muted uppercase tracking-widest">
                No orders yet
              </p>
            </div>
          )}

          {!loading && !error && orders.length > 0 && (
            <div className="flex flex-col gap-3">
              {orders.map((order) => (
                <div
                  key={order.id}
                  className="border border-white/8 bg-corporate-elevated/50 hover:bg-corporate-elevated transition-colors"
                >
                  {/* Order header row */}
                  <div className="flex items-center justify-between px-5 py-3 border-b border-white/5">
                    <span className="text-[0.75rem] font-mono font-bold text-corporate-text tracking-tight">
                      {order.order_ref}
                    </span>
                    <StatusBadge status={order.status} />
                  </div>

                  {/* Order detail row */}
                  <div className="grid grid-cols-3 gap-4 px-5 py-3">
                    <div>
                      <div className="text-[0.6rem] font-black text-corporate-muted uppercase tracking-[0.15em] mb-0.5">
                        Print house
                      </div>
                      <div className="text-[0.75rem] font-medium text-corporate-text-secondary">
                        {order.offer_print_house}
                      </div>
                    </div>
                    <div>
                      <div className="text-[0.6rem] font-black text-corporate-muted uppercase tracking-[0.15em] mb-0.5">
                        Total
                      </div>
                      <div className="text-[0.75rem] font-bold text-corporate-text">
                        ${Number(order.offer_price).toFixed(2)}
                      </div>
                    </div>
                    <div>
                      <div className="text-[0.6rem] font-black text-corporate-muted uppercase tracking-[0.15em] mb-0.5">
                        Date
                      </div>
                      <div className="text-[0.75rem] font-medium text-corporate-text-secondary">
                        {new Date(order.created_at).toLocaleDateString()}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="shrink-0 px-8 py-4 border-t border-white/5 bg-corporate-primary flex items-center justify-between">
          <span className="text-[0.6rem] font-mono text-corporate-muted uppercase tracking-widest">
            {!loading && !error ? `${orders.length} order${orders.length !== 1 ? 's' : ''}` : ''}
          </span>
          <button
            type="button"
            onClick={onClose}
            className="text-[0.7rem] font-black uppercase tracking-widest text-corporate-muted hover:text-corporate-text transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

export default UserOrders;
