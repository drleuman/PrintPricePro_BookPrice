import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  UserIcon,
  ChevronDownIcon,
  ArrowLeftOnRectangleIcon,
  XMarkIcon,
  LockClosedIcon,
  EnvelopeIcon,
  ArrowRightIcon,
  ArrowPathIcon,
  ShieldCheckIcon,
  ClipboardDocumentListIcon,
} from '@heroicons/react/24/outline';
import UserOrders from './UserOrders';

// ---------------------------------------------------------------------------
// PPOSLogo (local copy — same SVG as Header)
// ---------------------------------------------------------------------------
const PPOSLogo = ({ className = 'h-9 w-9' }: { className?: string }) => (
  <svg
    viewBox="0 0 375 375"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    className={className}
    style={{ transform: 'none' }}
  >
    <g transform="translate(0 375) scale(1 -1)">
      <path d="M 85.105,36.879 L 123.906,283.831 L 208.244,283.831 L 208.244,283.796 L 223.392,284.277 C 241.132,283.77 259.109,279.984 275.228,272.196 C 298.182,261.111 315.657,242.452 320.168,218.465 C 324.772,193.98 314.629,170.543 295.664,153.354 C 281.594,140.598 263.793,132.049 245.121,127.353 L 233.92,125.013 L 220.073,36.879 L 85.105,36.879 Z" className="fill-corporate-accent" />
      <path d="M 78.73,316.22 C 105.371,346.991 151.966,350.343 182.738,323.702 C 213.509,297.061 216.861,250.466 190.22,219.694 C 163.579,188.923 116.984,185.571 86.212,212.212 C 55.441,238.853 52.089,285.448 78.73,316.22 Z" className="fill-corporate-accent" />
      <path d="M 116.151,63.426 L 146.61,257.283 L 208.244,257.283 C 227.637,257.846 247.271,256.22 263.681,248.292 C 298.68,231.384 305.019,197.664 277.836,173.026 C 261.255,157.996 236.009,149.8 210.898,149.53 L 197.37,63.426 L 116.151,63.426 Z" className="fill-corporate-secondary" />
    </g>
  </svg>
);

// ---------------------------------------------------------------------------
// MenuButton
// ---------------------------------------------------------------------------
const MenuButton: React.FC<{
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
  danger?: boolean;
}> = ({ icon, label, onClick, danger }) => (
  <button
    role="menuitem"
    onClick={onClick}
    className={`w-full flex items-center gap-3 px-3 py-2.5 transition-colors group focus:outline-none ${
      danger
        ? 'text-corporate-accent hover:bg-corporate-accent/5 focus:bg-corporate-accent/10'
        : 'hover:bg-white/5 focus:bg-white/5'
    }`}
  >
    <span className={`shrink-0 transition-colors ${danger ? 'text-corporate-accent' : 'text-corporate-muted group-hover:text-corporate-text'}`}>
      {icon}
    </span>
    <span className={`text-[0.8rem] font-technical font-bold uppercase tracking-tight ${
      danger ? 'text-corporate-accent' : 'text-corporate-text-secondary group-hover:text-corporate-text'
    }`}>
      {label}
    </span>
  </button>
);

// ---------------------------------------------------------------------------
// AuthModal
// ---------------------------------------------------------------------------
type AuthMode = 'LOGIN' | 'REGISTER';

interface AuthUser {
  email: string;
  name?: string;
  token?: string;
  user_id?: string | number;
}

const AuthModal: React.FC<{ onClose: () => void; onLoginSuccess: (user: AuthUser) => void }> = ({ onClose, onLoginSuccess }) => {
  const [mode, setMode] = useState<AuthMode>('LOGIN');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const emailRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setTimeout(() => emailRef.current?.focus(), 50);
  }, []);

  useEffect(() => {
    setTimeout(() => emailRef.current?.focus(), 50);
    setError(null);
  }, [mode]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data?.message || data?.error || 'Invalid credentials. Please try again.');
        return;
      }
      onLoginSuccess({
        email,
        name: data?.name ?? data?.user?.name,
        token: data?.token ?? data?.access_token,
        user_id: data?.user_id ?? data?.user?.id ?? data?.id,
      });
      onClose();
    } catch {
      setError('Connection error. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center backdrop-blur-sm"
      style={{ backgroundColor: 'rgba(0,0,0,0.7)' }}
      onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      {/* Subtle grid pattern */}
      <div className="absolute inset-0 opacity-[0.03] pointer-events-none">
        <div className="h-full w-full bg-[linear-gradient(rgba(220,0,0,0.2)_1px,transparent_1px),linear-gradient(90deg,rgba(220,0,0,0.2)_1px,transparent_1px)] bg-[size:32px_32px]" />
      </div>

      <div className="relative w-full max-w-[480px] border border-white/10 bg-corporate-secondary shadow-[0_0_120px_rgba(220,0,0,0.12)] overflow-hidden">
        {/* Top accent bar */}
        <div className="h-[2px] w-full bg-corporate-accent shadow-[0_0_15px_#dc0000]" />

        {/* Close button */}
        <button
          type="button"
          onClick={onClose}
          className="absolute top-4 right-4 flex items-center justify-center w-8 h-8 text-corporate-muted hover:text-corporate-accent transition-colors z-10"
          aria-label="Close"
        >
          <XMarkIcon className="w-4 h-4" />
        </button>

        <div className="p-12 space-y-10">
          {/* Header */}
          <div className="flex flex-col items-center text-center space-y-6">
            <PPOSLogo className="w-14 h-14 border border-white/10 p-3 bg-white/5" />
            <div className="space-y-2">
              <h2 className="text-3xl font-black tracking-tight text-corporate-text">
                {mode === 'LOGIN' ? 'Welcome back' : 'Create account'}
              </h2>
              <p className="text-corporate-text-secondary text-[0.85rem] font-medium leading-relaxed">
                {mode === 'LOGIN'
                  ? 'Sign in to access your print workspace'
                  : 'Join PrintPrice Pro to manage your projects'}
              </p>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-8">
            {/* Error */}
            {error && (
              <div className="bg-corporate-accent/5 border border-corporate-accent/40 px-5 py-4 text-corporate-accent text-[0.75rem] font-bold uppercase tracking-widest flex items-center gap-4">
                <span className="h-2 w-2 shrink-0 bg-corporate-accent" />
                {error}
              </div>
            )}

            {/* Fields */}
            <div className="space-y-5">
              {/* Email */}
              <div className="space-y-2">
                <label className="text-[0.7rem] font-black text-corporate-text uppercase tracking-[0.15em]">
                  Email
                </label>
                <div className="relative group">
                  <div className="absolute inset-y-0 left-5 flex items-center pointer-events-none">
                    <EnvelopeIcon className="h-4 w-4 text-corporate-muted group-focus-within:text-corporate-accent transition-colors duration-300" />
                  </div>
                  <input
                    ref={emailRef}
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="user@email.com"
                    autoComplete="email"
                    className="h-[56px] w-full bg-corporate-elevated border border-white/10 pl-14 pr-6 text-[0.9rem] text-corporate-text outline-none focus:border-corporate-accent focus:shadow-[0_0_20px_rgba(220,0,0,0.05)] transition-all duration-300 placeholder:text-corporate-muted font-medium"
                  />
                </div>
              </div>

              {/* Password */}
              <div className="space-y-2">
                <label className="text-[0.7rem] font-black text-corporate-text uppercase tracking-[0.15em]">
                  Password
                </label>
                <div className="relative group">
                  <div className="absolute inset-y-0 left-5 flex items-center pointer-events-none">
                    <LockClosedIcon className="h-4 w-4 text-corporate-muted group-focus-within:text-corporate-accent transition-colors duration-300" />
                  </div>
                  <input
                    type="password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    autoComplete={mode === 'LOGIN' ? 'current-password' : 'new-password'}
                    className="h-[56px] w-full bg-corporate-elevated border border-white/10 pl-14 pr-6 text-[0.9rem] text-corporate-text outline-none focus:border-corporate-accent focus:shadow-[0_0_20px_rgba(220,0,0,0.05)] transition-all duration-300 placeholder:text-corporate-muted font-medium"
                  />
                </div>
              </div>
            </div>

            {/* Actions */}
            <div className="space-y-6">
              <button
                type="submit"
                disabled={loading}
                className="h-[64px] w-full bg-corporate-accent hover:bg-corporate-hover active:brightness-90 text-white text-[0.8rem] font-black uppercase tracking-[0.3em] transition-all duration-300 disabled:opacity-30 disabled:cursor-not-allowed flex items-center justify-center gap-4 shadow-[0_4px_20px_rgba(220,0,0,0.2)] group"
              >
                {loading ? (
                  <span className="animate-pulse flex items-center gap-2">
                    <ArrowPathIcon className="w-5 h-5 animate-spin" />
                    Verifying
                  </span>
                ) : (
                  <>
                    <span>{mode === 'LOGIN' ? 'Sign in' : 'Create account'}</span>
                    <ArrowRightIcon className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                  </>
                )}
              </button>

              <div className="flex flex-col items-center space-y-4 pt-1">
                <div className="flex items-center gap-3 text-[0.7rem] font-bold uppercase tracking-widest text-corporate-muted">
                  <span>{mode === 'LOGIN' ? 'No account?' : 'Already have one?'}</span>
                  <button
                    type="button"
                    onClick={() => setMode(m => m === 'LOGIN' ? 'REGISTER' : 'LOGIN')}
                    className="text-corporate-accent hover:underline underline-offset-4 transition-all duration-300"
                  >
                    {mode === 'LOGIN' ? 'Create account' : 'Back to sign in'}
                  </button>
                </div>

                {mode === 'LOGIN' && (
                  <button
                    type="button"
                    className="text-[0.6rem] font-bold text-corporate-muted hover:text-corporate-text-secondary transition-colors uppercase tracking-[0.2em]"
                  >
                    Forgot my password
                  </button>
                )}
              </div>
            </div>
          </form>
        </div>

        {/* Secure footer */}
        <div className="px-12 py-5 bg-corporate-primary border-t border-[var(--border-subtle)] flex items-center justify-center gap-3">
          <ShieldCheckIcon className="h-3.5 w-3.5 text-[#32D74B]" />
          <span className="text-[0.6rem] font-mono text-corporate-muted tracking-widest uppercase">
            Secure encrypted connection
          </span>
        </div>
      </div>
    </div>
  );
};

// ---------------------------------------------------------------------------
// UserMenu
// ---------------------------------------------------------------------------
interface UserMenuProps {
  user: AuthUser | null;
  onOpenModal: () => void;
  onLogout: () => void;
}

const UserMenu: React.FC<UserMenuProps> = ({ user, onOpenModal, onLogout }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [showOrders, setShowOrders] = useState(false);

  const menuRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  // Close on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsOpen(false);
        setTimeout(() => triggerRef.current?.focus(), 0);
        return;
      }
      if (!isOpen || !menuRef.current) return;

      const items = Array.from(
        menuRef.current.querySelectorAll('[role="menuitem"]:not([disabled])')
      ) as HTMLElement[];
      if (items.length === 0) return;

      const idx = items.indexOf(document.activeElement as HTMLElement);
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        items[(idx + 1) % items.length].focus();
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        items[(idx - 1 + items.length) % items.length].focus();
      } else if (e.key === 'Home') {
        e.preventDefault();
        items[0].focus();
      } else if (e.key === 'End') {
        e.preventDefault();
        items[items.length - 1].focus();
      }
    };

    if (isOpen) document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen]);

  const openSignIn = useCallback(() => {
    setIsOpen(false);
    onOpenModal();
  }, [onOpenModal]);

  const handleLogoutClick = useCallback(() => {
    setIsOpen(false);
    onLogout();
  }, [onLogout]);

  return (
    <>
      <div
        ref={menuRef}
        className="relative"
        onBlur={(e) => {
          if (!menuRef.current?.contains(e.relatedTarget as Node)) {
            setIsOpen(false);
          }
        }}
      >
        {/* Trigger */}
        <button
          ref={triggerRef}
          type="button"
          onClick={() => setIsOpen(o => !o)}
          aria-expanded={isOpen}
          aria-haspopup="true"
          aria-controls="user-dropdown-menu"
          id="user-menu-button"
          className="flex items-center gap-2 px-3 py-2 border border-white/10 hover:border-corporate-accent/40 hover:bg-white/5 transition-all group focus:outline-none focus:ring-1 focus:ring-corporate-accent/50"
        >
          <div className="flex h-7 w-7 items-center justify-center border border-white/10 bg-corporate-elevated group-hover:border-white/20 transition-colors">
            <UserIcon className="w-4 h-4 text-corporate-muted group-hover:text-corporate-text transition-colors" />
          </div>
          <ChevronDownIcon
            className={`w-3 h-3 text-corporate-muted transition-transform ${isOpen ? 'rotate-180' : ''}`}
          />
        </button>

        {/* Dropdown */}
        {isOpen && (
          <div
            id="user-dropdown-menu"
            role="menu"
            aria-labelledby="user-menu-button"
            className="absolute right-0 mt-2 w-56 bg-corporate-primary border border-white/10 shadow-[0_20px_50px_rgba(0,0,0,0.4)] z-[100]"
          >
            {/* Header info */}
            <div className="px-4 py-3 border-b border-white/5 bg-corporate-elevated/50">
              <div className="text-[0.6rem] font-technical font-black text-corporate-muted uppercase tracking-monolith">
                Account
              </div>
              <div className="mt-1 text-[0.75rem] font-technical text-corporate-text-secondary italic truncate">
                {user ? (user.name || user.email) : 'Not signed in'}
              </div>
              {user && (
                <div className="mt-0.5 text-[0.65rem] font-mono text-corporate-muted truncate">
                  {user.email}
                </div>
              )}
            </div>

            {/* Actions */}
            {!user && (
              <div className="p-2 flex flex-col gap-0.5">
                <MenuButton
                  icon={<UserIcon className="w-4 h-4" />}
                  label="Sign in"
                  onClick={openSignIn}
                />
              </div>
            )}

            {/* Authenticated actions */}
            {user && (
              <div className="p-2 flex flex-col gap-0.5">
                <MenuButton
                  icon={<ClipboardDocumentListIcon className="w-4 h-4" />}
                  label="My Orders"
                  onClick={() => { setIsOpen(false); setShowOrders(true); }}
                />
              </div>
            )}

            {/* Sign out */}
            {user && (
              <div className="p-2 border-t border-white/5 bg-corporate-elevated/30">
                <MenuButton
                  icon={<ArrowLeftOnRectangleIcon className="w-4 h-4" />}
                  label="Sign out"
                  onClick={handleLogoutClick}
                  danger
                />
              </div>
            )}
          </div>
        )}
      </div>

      {showOrders && user?.user_id && (
        <UserOrders
          userId={user.user_id}
          onClose={() => setShowOrders(false)}
        />
      )}
    </>
  );
};

export { AuthModal };
export type { AuthUser };

export default UserMenu;
