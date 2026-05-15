import React, { useState } from 'react';
import { ProductionFilesState, ProductionFileKind, CartItem, ProductionFileSourceType } from '../types';

interface ProductionFilesPanelProps {
  cartItem: CartItem;
  filesState: ProductionFilesState;
  onFileSelect: (kind: ProductionFileKind, file: File) => void;
  onUrlSelect: (kind: ProductionFileKind, url: string) => void;
  onFileRemove: (kind: ProductionFileKind) => void;
  onContinue: () => void;
  disabled?: boolean;
}

const ProductionFilesPanel: React.FC<ProductionFilesPanelProps> = ({
  cartItem,
  filesState,
  onFileSelect,
  onUrlSelect,
  onFileRemove,
  onContinue,
  disabled = false,
}) => {
  // Local state to track active tab per slot
  const [activeTab, setActiveTab] = useState<Record<ProductionFileKind, ProductionFileSourceType>>({
    INTERIOR_PDF: 'UPLOAD',
    COVER_SPINE_BACK_PDF: 'UPLOAD'
  });

  // Local state for URL inputs
  const [urlInputs, setUrlInputs] = useState<Record<ProductionFileKind, string>>({
    INTERIOR_PDF: '',
    COVER_SPINE_BACK_PDF: ''
  });

  const handleFileInput = (kind: ProductionFileKind, e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      onFileSelect(kind, file);
    }
  };

  const handleUrlSubmit = (kind: ProductionFileKind) => {
    const url = urlInputs[kind]?.trim();
    if (url) {
      onUrlSelect(kind, url);
    }
  };

  const renderFileSlot = (kind: ProductionFileKind, label: string) => {
    const draft = kind === 'INTERIOR_PDF' ? filesState.interior_pdf : filesState.cover_spine_back_pdf;
    const isDeclared = ['SELECTED', 'UPLOADED', 'VALIDATED', 'LINK_PROVIDED', 'LINK_PENDING_FETCH'].includes(draft.status);
    const currentTab = activeTab[kind];

    return (
      <div className={`border p-6 flex flex-col gap-4 transition-all duration-300 relative group overflow-hidden ${
        isDeclared ? 'border-corporate-accent/30 bg-corporate-primary' : 'border-corporate-text/10 bg-corporate-primary/50'
      }`}>
        <div className="flex justify-between items-start gap-4">
          <div>
            <p className="text-[0.6rem] font-technical font-black tracking-monolith text-corporate-accent uppercase mb-1">
              Required Asset
            </p>
            <h3 className="text-sm font-display font-black text-corporate-text uppercase tracking-wider">
              {label}
            </h3>
          </div>
          <div className="flex items-center gap-2">
            {draft.status === 'SELECTED' && (
              <span className="bg-corporate-accent/10 text-corporate-accent text-[8px] font-technical font-black px-1.5 py-0.5 border border-corporate-accent/20 tracking-tighter uppercase">
                PDF SELECTED
              </span>
            )}
            {draft.status === 'LINK_PROVIDED' && (
              <span className="bg-blue-500/10 text-blue-500 text-[8px] font-technical font-black px-1.5 py-0.5 border border-blue-500/20 tracking-tighter uppercase">
                LINK PROVIDED
              </span>
            )}
            {draft.status === 'PENDING' && (
              <span className="bg-corporate-muted/10 text-corporate-muted text-[8px] font-technical font-black px-1.5 py-0.5 border border-corporate-muted/20 tracking-tighter uppercase">
                FILE PENDING
              </span>
            )}
            {draft.status === 'ERROR' && (
              <span className="bg-red-500/10 text-red-500 text-[8px] font-technical font-black px-1.5 py-0.5 border border-red-500/20 tracking-tighter uppercase">
                {draft.error || 'INVALID_SOURCE'}
              </span>
            )}
          </div>
        </div>

        {isDeclared ? (
          <div className="flex items-center justify-between bg-corporate-secondary/50 p-3 border border-white/5">
            <div className="flex items-center gap-3 overflow-hidden">
              <div className="w-8 h-8 bg-corporate-accent/10 flex items-center justify-center shrink-0">
                <span className="text-[10px] font-technical font-black text-corporate-accent uppercase">
                  {draft.source_type === 'DOWNLOAD_URL' ? 'URL' : 'PDF'}
                </span>
              </div>
              <div className="overflow-hidden">
                <p className="text-xs font-technical text-corporate-text truncate max-w-[200px]">
                  {draft.source_type === 'DOWNLOAD_URL' ? draft.download_url_host : draft.filename}
                </p>
                <p className="text-[10px] font-technical text-corporate-muted uppercase truncate max-w-[200px]">
                  {draft.source_type === 'DOWNLOAD_URL' ? draft.download_url : `${((draft.size_bytes || 0) / (1024 * 1024)).toFixed(2)} MB`}
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => onFileRemove(kind)}
              className="text-corporate-accent hover:text-corporate-hover text-[10px] font-technical font-black uppercase tracking-monolith p-2"
            >
              [ REMOVE ]
            </button>
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            {/* Tabs Selector */}
            <div className="flex border-b border-corporate-text/10">
              <button
                type="button"
                onClick={() => setActiveTab(prev => ({ ...prev, [kind]: 'UPLOAD' }))}
                className={`px-4 py-2 text-[10px] font-technical font-black uppercase tracking-widest transition-colors ${
                  currentTab === 'UPLOAD' ? 'text-corporate-accent border-b-2 border-corporate-accent' : 'text-corporate-muted hover:text-corporate-text'
                }`}
              >
                Upload PDF
              </button>
              <button
                type="button"
                onClick={() => setActiveTab(prev => ({ ...prev, [kind]: 'DOWNLOAD_URL' }))}
                className={`px-4 py-2 text-[10px] font-technical font-black uppercase tracking-widest transition-colors ${
                  currentTab === 'DOWNLOAD_URL' ? 'text-corporate-accent border-b-2 border-corporate-accent' : 'text-corporate-muted hover:text-corporate-text'
                }`}
              >
                Download Link
              </button>
            </div>

            {/* Tab Content */}
            <div className="min-h-[140px] flex flex-col justify-center">
              {currentTab === 'UPLOAD' ? (
                <label className="cursor-pointer group/label">
                  <input
                    type="file"
                    accept=".pdf,application/pdf"
                    className="hidden"
                    onChange={(e) => handleFileInput(kind, e)}
                  />
                  <div className="border-2 border-dashed border-corporate-text/10 p-8 flex flex-col items-center justify-center gap-3 hover:border-corporate-accent/30 transition-all bg-transparent group-hover/label:bg-corporate-accent/5">
                    <div className="w-10 h-10 border border-corporate-text/20 flex items-center justify-center group-hover/label:border-corporate-accent/50 transition-colors">
                      <span className="text-xl font-technical text-corporate-muted group-hover/label:text-corporate-accent">+</span>
                    </div>
                    <p className="text-[10px] font-technical font-black text-corporate-muted uppercase tracking-monolith group-hover/label:text-corporate-text transition-colors">
                      Select PDF
                    </p>
                  </div>
                </label>
              ) : (
                <div className="flex flex-col gap-3">
                  <div className="relative">
                    <input
                      type="url"
                      placeholder="https://example.com/file.pdf"
                      value={urlInputs[kind]}
                      onChange={(e) => setUrlInputs(prev => ({ ...prev, [kind]: e.target.value }))}
                      className="w-full bg-corporate-primary/50 border border-corporate-text/20 p-4 text-xs font-technical text-corporate-text focus:outline-none focus:border-corporate-accent/50 transition-colors placeholder:text-corporate-muted/50"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={() => handleUrlSubmit(kind)}
                    disabled={!urlInputs[kind]?.trim().startsWith('https://')}
                    className="w-full py-3 bg-corporate-text/5 hover:bg-corporate-accent/10 border border-corporate-text/10 text-corporate-text hover:text-corporate-accent text-[10px] font-technical font-black uppercase tracking-monolith transition-all disabled:opacity-30 disabled:cursor-not-allowed"
                  >
                    Use download link →
                  </button>
                  <p className="text-[9px] font-technical text-corporate-muted uppercase text-center tracking-tighter">
                    HTTPS ONLY • BACKEND WILL FETCH & VALIDATE
                  </p>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    );
  };

  const isInteriorReady = ['SELECTED', 'UPLOADED', 'VALIDATED', 'LINK_PROVIDED', 'LINK_PENDING_FETCH'].includes(filesState.interior_pdf.status);
  const isCoverReady = ['SELECTED', 'UPLOADED', 'VALIDATED', 'LINK_PROVIDED', 'LINK_PENDING_FETCH'].includes(filesState.cover_spine_back_pdf.status);
  const allReady = isInteriorReady && isCoverReady;

  const selectedOfferPriceRaw = cartItem.pricing?.total_price ?? cartItem.offer.total_price ?? cartItem.offer.total_cost ?? 0;
  const selectedOfferPrice = Number(selectedOfferPriceRaw);
  const safeSelectedOfferPrice = Number.isFinite(selectedOfferPrice) ? selectedOfferPrice : 0;

  return (
    <div className="bg-corporate-secondary p-8 md:p-12 border border-white/5 relative overflow-hidden animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="absolute top-0 right-0 opacity-[0.02] font-technical text-[8rem] font-black pointer-events-none uppercase">
        UPLD
      </div>
      
      <div className="flex flex-col md:flex-row justify-between items-start gap-8 mb-8 relative z-10">
        <div>
          <h2 className="text-[0.7rem] font-technical font-black tracking-monolith text-corporate-accent mb-2 uppercase">
            Step: Production Intake
          </h2>
          <p className="text-xl font-display font-black text-corporate-text uppercase tracking-tighter">
            Files or External Links
          </p>
        </div>
        <div className="flex flex-col items-end gap-1">
          <span className="bg-corporate-accent/20 text-corporate-accent text-[10px] font-technical font-black px-3 py-1 border border-corporate-accent/30 tracking-widest uppercase">
            OFFER SELECTED
          </span>
          <span className="text-[10px] font-technical text-corporate-muted uppercase tracking-widest mt-1">
            Payment Pending
          </span>
        </div>
      </div>

      <div className="mb-8 p-6 border border-corporate-text/10 bg-corporate-primary/40 relative z-10">
        <p className="text-[0.6rem] font-technical font-black tracking-monolith text-corporate-muted uppercase mb-1">
          Selected offer
        </p>
        <div className="flex items-center justify-between gap-4">
          <p className="text-xs font-technical font-black text-corporate-text uppercase tracking-monolith">
            {cartItem.offer.print_house}
          </p>
          <p className="text-lg font-display font-black text-corporate-text tracking-tighter">
            {safeSelectedOfferPrice.toFixed(2)}{' '}
            <span className="text-corporate-accent text-xs">
              {cartItem.pricing?.currency || cartItem.offer.currency}
            </span>
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 relative z-10">
        {renderFileSlot('INTERIOR_PDF', 'Interior PDF File')}
        {renderFileSlot('COVER_SPINE_BACK_PDF', 'Cover / Spine / Back PDF')}
      </div>

      <div className="mt-12 flex flex-col md:flex-row items-center justify-between gap-8 pt-8 border-t border-white/5 relative z-10">
        <div className="max-w-md">
          <p className="text-[10px] font-technical text-corporate-muted leading-relaxed uppercase tracking-wider">
            Production assets are required before the order request can continue. PDFs or secure download links are accepted. Ingestion, production validation, invoice generation and payment happen after this step.
          </p>
        </div>
        <button
          type="button"
          onClick={onContinue}
          disabled={!allReady || disabled}
          className={`px-10 py-4 font-technical font-black tracking-monolith uppercase transition-all duration-300 text-sm
            ${allReady && !disabled
              ? 'bg-corporate-accent text-white hover:bg-corporate-hover hover:shadow-[0_0_20px_rgba(220,0,0,0.3)]'
              : 'bg-corporate-muted/20 text-corporate-muted cursor-not-allowed grayscale'
            }`}
        >
          {allReady ? 'Create order request →' : 'Production assets required'}
        </button>
      </div>
    </div>
  );
};

export default ProductionFilesPanel;
