import React from 'react';
import { ShoppingCartIcon, SunIcon, MoonIcon } from '@heroicons/react/24/outline';
import UserMenu from './UserMenu';
import type { AuthUser } from './UserMenu';

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

interface HeaderProps {
  cartCount: number;
  onCartClick: () => void;
  isDark: boolean;
  onThemeToggle: () => void;
  user: AuthUser | null;
  onOpenAuthModal: () => void;
  onLogout: () => void;
}

const Header: React.FC<HeaderProps> = ({ cartCount, onCartClick, isDark, onThemeToggle, user, onOpenAuthModal, onLogout }) => {
  return (
    <header className="sticky top-0 z-50 bg-corporate-secondary border-b border-white/10">
      <div className="container mx-auto px-6 md:px-10 max-w-[1400px] h-20 flex items-center justify-between">
        {/* Logo / Brand */}
        <div className="flex items-center gap-4 min-w-max">
          <PPOSLogo className="h-9 w-9" />
          <div className="hidden md:block">
            <div className="flex items-baseline gap-1.5 leading-none uppercase">
              <span className="text-[0.65rem] font-technical font-black tracking-monolith text-corporate-accent">
                PrintPrice
              </span>
              <span className="text-[0.65rem] font-technical font-black tracking-monolith text-corporate-text">
                Pro
              </span>
            </div>
            <div className="text-[0.6rem] uppercase tracking-[0.55em] text-corporate-muted mt-1 ml-0.5 font-mono opacity-90">
              Book Price
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2 min-w-max">
          {/* Theme toggle */}
          <button
            type="button"
            onClick={onThemeToggle}
            className="group flex items-center gap-2 px-3 py-2 border border-white/10 hover:border-corporate-accent hover:bg-white/5 transition-all text-corporate-text-secondary hover:text-corporate-accent"
            aria-label="Toggle theme"
          >
            {isDark ? (
              <SunIcon className="w-4 h-4" />
            ) : (
              <MoonIcon className="w-4 h-4" />
            )}
            <span className="hidden md:inline text-[0.6rem] font-technical font-black tracking-monolith uppercase">
              {isDark ? 'Light' : 'Dark'}
            </span>
          </button>

          {/* Cart */}
          <button
            type="button"
            onClick={onCartClick}
            className="relative flex items-center justify-center w-9 h-9 text-corporate-text-secondary hover:text-corporate-accent transition-colors"
            aria-label="Cart"
          >
            <ShoppingCartIcon className="w-5 h-5" />
            {cartCount > 0 && (
              <span className="absolute top-1 right-1 flex items-center justify-center w-4 h-4 rounded-full bg-corporate-accent text-white text-[0.5rem] font-black leading-none">
                {cartCount > 9 ? '9+' : cartCount}
              </span>
            )}
          </button>

          <div className="h-5 w-px bg-white/10 mx-1 hidden md:block" />

          {/* User menu */}
          <UserMenu user={user} onOpenModal={onOpenAuthModal} onLogout={onLogout} />
        </div>
      </div>
    </header>
  );
};

export default Header;
