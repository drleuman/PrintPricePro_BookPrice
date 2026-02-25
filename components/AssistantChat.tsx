import React, { useState, useRef, useEffect } from 'react';
import { AI_ASSISTANT_ENDPOINT, PRINTPRICE_ASSISTANT_PROMPT, BOOK_PRICE_API_ENDPOINT } from '../constants';
import { InitialBookPricePayload, BookPriceResponse } from '../types';
import { PaperAirplaneIcon, ChatBubbleLeftRightIcon } from '@heroicons/react/24/solid';
import { t } from '../i18n/en';

type ChatRole = 'user' | 'assistant';

interface ChatMessage {
  id: string;
  role: ChatRole;
  content: string;
  kind?: 'text' | 'offers';
  ui?: {
    show_offers?: boolean;
    recommended_offer_ids?: string[];
  };
}

interface AssistantChatProps {
  specs: InitialBookPricePayload;
  offers: BookPriceResponse | null;
  onSpecsPatch: (patch: Partial<InitialBookPricePayload>) => void;
  onOffersUpdate: (offers: BookPriceResponse) => void;
  onChooseOffer: (offer: any) => Promise<void>;
}

/**
 * Expected from the assistant backend:
 *
 * {
 *   "reply": "text to show the user",
 *   "specs_patch": { ...patched fields for the form... },
 *   "offers": { success, message?, offers: [...] },
 *   "order_url": "https://printprice.pro/print_order/123"
 * }
 */
interface AssistantResponse {
  reply: string;
  specs_patch?: Partial<InitialBookPricePayload> | null;
  offers?: BookPriceResponse;
  order_url?: string;
  ui?: {
    show_offers?: boolean;
    recommended_offer_ids?: string[];
  };
}

const AssistantChat: React.FC<AssistantChatProps> = ({
  specs,
  offers,
  onSpecsPatch,
  onOffersUpdate,
  onChooseOffer,
}) => {
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: 'welcome',
      role: 'assistant',
      content:
        "Hello, I'm PrintPrice Pro AI Assistant. I can help you describe your book printing project and get real quotes.",
    },
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  // Auto-scroll dentro del área de chat cada vez que cambian los mensajes
  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth', block: 'end' });
    }
  }, [messages, loading]);

  const sendMessage = async () => {
    const trimmed = input.trim();
    if (!trimmed || loading) return;

    const userMessage: ChatMessage = {
      id: `u-${Date.now()}`,
      role: 'user',
      content: trimmed,
    };

    const nextMessages = [...messages, userMessage];
    setMessages(nextMessages);
    setInput('');
    setError(null);
    setLoading(true);

    try {
      const payload = {
        system_prompt: PRINTPRICE_ASSISTANT_PROMPT,
        messages: nextMessages.map((m) => ({ role: m.role, content: m.content })),
        ui_state: {
          ORIGINAL_SPECS_BEFORE_THIS_MESSAGE: specs,
          offers,
        },
      };

      console.log("ASSISTANT PAYLOAD messages:", payload.messages.slice(-2));
      console.log("ASSISTANT PAYLOAD specs:", payload.ui_state.ORIGINAL_SPECS_BEFORE_THIS_MESSAGE);

      const res = await fetch(AI_ASSISTANT_ENDPOINT, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-App-Proxy-Key': process.env.INTERNAL_PROXY_KEY || ''
        },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        if (res.status === 404) {
          setMessages((prev) => [
            ...prev,
            {
              id: `a-${Date.now()}`,
              role: 'assistant',
              content: "I'm sorry, but the AI Assistant service is currently unavailable. Please use the form below to manually enter your book specifications and calculate prices. The AI Assistant will be available soon!",
            },
          ]);
          setLoading(false);
          return;
        }
        throw new Error(`HTTP ${res.status}`);
      }

      const data: AssistantResponse = await res.json();
      console.log('AI Assistant Raw Response:', data);

      let finalReply = data.reply || '';
      let patch = data.specs_patch;

      if (!finalReply && typeof data === 'string') {
        finalReply = data;
      }

      // 1) Normalize the patch coming from the backend
      if (patch) {
        if (typeof patch.book_size === 'string') {
          const bs = patch.book_size;
          if (bs.includes('A5')) patch.book_size = 'A5' as any;
          else if (bs.includes('A4')) patch.book_size = 'A4' as any;
          else if (bs.includes('A6')) patch.book_size = 'A6' as any;
          else if (bs.includes('170') && bs.includes('240')) patch.book_size = '170 x 240 mm' as any;
          else if (bs.includes('210') && bs.includes('210')) patch.book_size = '210 x 210 mm' as any;
        }
        if (typeof patch.delivery_country === 'string') {
          patch.delivery_country = patch.delivery_country.toUpperCase().substring(0, 2);
        }
      }

      // 2) HEURISTIC EXTRACTION: Parse the USER'S message (trimmed)
      const heuristicPatch: Partial<InitialBookPricePayload> = {};
      const userLower = trimmed.toLowerCase();

      // Copies: handle English and Spanish variants
      const copiesMatch = userLower.match(/(\d+)\s*(copies|copys|copie|copias|cop)\b/);
      if (copiesMatch) heuristicPatch.copies = Number(copiesMatch[1]);

      // Interior Pages: handle English and Spanish variants
      const pagesMatch = userLower.match(/(\d+)\s*(interior\s*)?(pages?|pp|paginas?|páginas?|pag)\b/);
      if (pagesMatch) heuristicPatch.interior_pages = Number(pagesMatch[1]);

      // Interior Print: B&W interior
      if (/\b(b&w|bw|black\s*&\s*white|black\s*(and|y)\s*white|monochrome|grayscale|bn|b\/n)\b/.test(userLower)) {
        heuristicPatch.interior_print = '1/1';
      }
      // Interior Print: Full color
      if (/\b(interior\s*(in\s*)?color|interior\s*full\s*color|4\/4\s*interior)\b/.test(userLower)) {
        heuristicPatch.interior_print = '4/4';
      }

      // Cover Print: Color cover
      const colorCoverMatch = /\b(cover\s*(in\s*)?color|colour\s*cover|color\s*cover|cubierta\s*(a\s*)?color)\b/.test(userLower);
      if (colorCoverMatch) {
        // Detect if they want both sides
        const bothSides = /\b(both\s*sides|2\s*caras|dos\s*caras|4\/4)\b/.test(userLower);
        heuristicPatch.cover_print = bothSides ? '4/4' : '4/0';
      }

      // Binding
      if (userLower.includes('hardcover') || userLower.includes('hard cover') || userLower.includes('dura')) {
        heuristicPatch.binding_method = 'thread_sewn_hc';
      }
      if (userLower.includes('softcover') || userLower.includes('soft cover') || userLower.includes('blanda') || userLower.includes('perfect')) {
        heuristicPatch.binding_method = 'perfect_bound';
      }

      // Size
      if (userLower.includes('a5')) heuristicPatch.book_size = 'A5' as any;
      if (userLower.includes('a4')) heuristicPatch.book_size = 'A4' as any;
      if (userLower.includes('a6')) heuristicPatch.book_size = 'A6' as any;
      if (userLower.includes('170') && userLower.includes('240')) heuristicPatch.book_size = '170 x 240 mm' as any;

      // Orientation
      if (userLower.includes('landscape') || userLower.includes('horizontal')) heuristicPatch.orientation = 'landscape';
      if (userLower.includes('portrait') || userLower.includes('vertical')) heuristicPatch.orientation = 'portrait';

      // Delivery
      if (userLower.includes('germany') || userLower.includes('alemania')) heuristicPatch.delivery_country = 'DE';
      if (userLower.includes('spain') || userLower.includes('españa')) heuristicPatch.delivery_country = 'ES';
      if (userLower.includes('uk') || userLower.includes('united kingdom') || userLower.includes('reino unido') || userLower.includes('england')) heuristicPatch.delivery_country = 'GB';

      // GSM Detection (Interior, Cover, Endpapers)
      // Interior GSM: "120 gsm interior" or "interior 120gsm"
      const interiorGsmMatch = userLower.match(/(?:interior|pages?).*?(\d{2,3})\s*gsm|(\d{2,3})\s*gsm.*?(?:interior|pages?)/);
      if (interiorGsmMatch) {
        const gsm = Number(interiorGsmMatch[1] || interiorGsmMatch[2]);
        heuristicPatch.paper_weight_interior = gsm;
      }

      // Cover GSM: "250 gsm cover" or "cover 250gsm"
      const coverGsmMatch = userLower.match(/(?:cover|cubierta).*?(\d{2,3})\s*gsm|(\d{2,3})\s*gsm.*?(?:cover|cubierta)/);
      if (coverGsmMatch) {
        const gsm = Number(coverGsmMatch[1] || coverGsmMatch[2]);
        heuristicPatch.paper_weight_cover = gsm;
      }

      // Endpapers GSM: "endpapers 150gsm" or "150 gsm endpapers"
      const endpapersGsmMatch = userLower.match(/(?:endpapers?|guardas?).*?(\d{2,3})\s*gsm|(\d{2,3})\s*gsm.*?(?:endpapers?|guardas?)/);
      if (endpapersGsmMatch) {
        const gsm = Number(endpapersGsmMatch[1] || endpapersGsmMatch[2]);
        heuristicPatch.paper_weight_endpapers = gsm;
      }

      // Endpapers presence
      if (/\b(endpapers?|guardas?)\b/.test(userLower)) {
        heuristicPatch.endpapers = 'standard';

        // Endpapers print: "endpapers 1/1" or "endpapers b&w"
        if (/endpapers?.*?(1\/1|b&w|bw|black\s*&\s*white)/i.test(userLower)) {
          heuristicPatch.endpapers_print = '1/1';
        } else if (/endpapers?.*?(4\/4|color|colour)/i.test(userLower)) {
          heuristicPatch.endpapers_print = '4/4';
        }
      }

      // Paper Types
      if (/\b(offset|woodfree|mc)\b/.test(userLower)) {
        // Check context to determine if it's for interior, cover, or endpapers
        if (/(?:interior|pages?).*?(?:offset|woodfree|mc)|(?:offset|woodfree|mc).*?(?:interior|pages?)/i.test(userLower)) {
          heuristicPatch.paper_type_interior = 'offset';
        }
        if (/(?:endpapers?|guardas?).*?(?:offset|woodfree|mc)|(?:offset|woodfree|mc).*?(?:endpapers?|guardas?)/i.test(userLower)) {
          heuristicPatch.paper_type_endpaper = 'offset';
        }
      }
      if (/\b(artboard|estucado)\b/.test(userLower)) {
        heuristicPatch.paper_type_cover = 'artboard';
      }

      console.log('Backend Patch:', patch);
      console.log('Heuristic Patch:', heuristicPatch);

      // 3) MERGE & OVERRIDE: Heuristic overrides patch if conflict detected for critical fields
      let finalPatch = { ...patch };

      // Conflict guards: if user clearly stated intent, heuristic wins over backend patch
      if (heuristicPatch.copies !== undefined) finalPatch.copies = heuristicPatch.copies;
      if (heuristicPatch.interior_pages !== undefined) finalPatch.interior_pages = heuristicPatch.interior_pages;
      if (heuristicPatch.binding_method !== undefined) finalPatch.binding_method = heuristicPatch.binding_method;
      if (heuristicPatch.book_size !== undefined) finalPatch.book_size = heuristicPatch.book_size;
      if (heuristicPatch.orientation !== undefined) finalPatch.orientation = heuristicPatch.orientation;
      if (heuristicPatch.delivery_country !== undefined) finalPatch.delivery_country = heuristicPatch.delivery_country;
      if (heuristicPatch.interior_print !== undefined) finalPatch.interior_print = heuristicPatch.interior_print;
      if (heuristicPatch.cover_print !== undefined) finalPatch.cover_print = heuristicPatch.cover_print;

      // GSM overrides
      if (heuristicPatch.paper_weight_interior !== undefined) finalPatch.paper_weight_interior = heuristicPatch.paper_weight_interior;
      if (heuristicPatch.paper_weight_cover !== undefined) finalPatch.paper_weight_cover = heuristicPatch.paper_weight_cover;
      if (heuristicPatch.paper_weight_endpapers !== undefined) finalPatch.paper_weight_endpapers = heuristicPatch.paper_weight_endpapers;

      // Paper types
      if (heuristicPatch.paper_type_interior !== undefined) finalPatch.paper_type_interior = heuristicPatch.paper_type_interior;
      if (heuristicPatch.paper_type_cover !== undefined) finalPatch.paper_type_cover = heuristicPatch.paper_type_cover;
      if (heuristicPatch.paper_type_endpaper !== undefined) finalPatch.paper_type_endpaper = heuristicPatch.paper_type_endpaper;

      // Endpapers
      if (heuristicPatch.endpapers !== undefined) finalPatch.endpapers = heuristicPatch.endpapers;
      if (heuristicPatch.endpapers_print !== undefined) finalPatch.endpapers_print = heuristicPatch.endpapers_print;

      console.log('Final merged patch to apply:', finalPatch);
      const appliedSpecs = { ...specs, ...finalPatch };

      // 4) REPAIR HALLUCINATIONS in the reply text
      // If the reply contains a Project Summary, we replace it with the ACTUAL data we are applying.
      const summaryRegex = /Project Summary:[\s\S]*?(?=\n\n|\n[A-Z]|$)/i;

      if (summaryRegex.test(finalReply)) {
        const getBindingLabel = (m: string) => {
          if (m === 'thread_sewn_hc') return 'Hardcover';
          if (m === 'perfect_bound') return 'Softcover';
          return m;
        };
        const getPrintLabel = (p: string) => {
          if (p === '4/4') return 'Full Color (2 sides)';
          if (p === '4/0') return 'Full Color (1 side)';
          if (p === '1/1') return 'Black & White';
          if (p === '1/0') return 'B&W (1 side)';
          return p;
        };

        const truthSummary = `Project Summary:
• Copies: ${appliedSpecs.copies}
• Size: ${appliedSpecs.book_size} (${appliedSpecs.orientation})
• Interior Pages: ${appliedSpecs.interior_pages}
• Binding: ${getBindingLabel(appliedSpecs.binding_method)}
• Interior Print: ${getPrintLabel(appliedSpecs.interior_print)}
• Cover Print: ${getPrintLabel(appliedSpecs.cover_print)}
• Delivery: ${appliedSpecs.delivery_country}`;

        // Find and replace the summary block
        finalReply = finalReply.replace(summaryRegex, truthSummary);

        // Remove the "no offers" message if we are about to heal them
        if (appliedSpecs.interior_pages > 0) {
          finalReply = finalReply.replace(/It has not been possible to get offers at this time\./gi, '');
        }
      }

      // Add text message
      if (finalReply) {
        setMessages((prev) => [
          ...prev,
          {
            id: `a-${Date.now()}`,
            role: 'assistant',
            content: finalReply.trim(),
            kind: 'text',
          },
        ]);
      }

      // 5) APPLY PATCH to form
      if (Object.keys(finalPatch).length > 0) {
        onSpecsPatch(finalPatch);
      }

      // 6) OFFERS AUTO-HEALING
      // If backend returned no offers (likely because of hallucinated 0 pages),
      // but we now have valid pages, fetch offers manually.
      let healedOffers = data.offers;
      if (!healedOffers?.offers?.length && appliedSpecs.interior_pages > 0) {
        console.log('Backend failed to provide offers. Auto-healing offers using corrected specs...');
        try {
          const bpeRes = await fetch(BOOK_PRICE_API_ENDPOINT, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(appliedSpecs),
          });
          if (bpeRes.ok) {
            const bpeData = await bpeRes.json();
            // Normalise manually as we do in App.tsx (simplified for internal use)
            const rawOffers = bpeData.print_houses || bpeData.offers || [];
            if (rawOffers.length > 0) {
              healedOffers = {
                success: true,
                offers: rawOffers.map((o: any, idx: number) => ({
                  id: String(o.house_id || o.id || `healed-${idx}`),
                  print_house: o.print_house || 'Print house',
                  total_cost: o.total_cost || o.total_price || 0,
                  currency: o.currency || 'EUR',
                  estimated_delivery_time: o.estimated_delivery_time || '',
                  breakdown: o.lines || o.breakdown || [],
                })),
              };
              onOffersUpdate(healedOffers);
              console.log('Offers successfully healed:', healedOffers);
            }
          }
        } catch (e) {
          console.error('Failed to heal offers:', e);
        }
      } else if (healedOffers) {
        onOffersUpdate(healedOffers);
      }

      // 7) SHOW OFFERS if UI requested or we have them
      const shouldShowOffers =
        data.ui?.show_offers === true || !!healedOffers?.offers?.length;

      if (shouldShowOffers) {
        setMessages((prev) => [
          ...prev,
          {
            id: `a-offers-${Date.now()}`,
            role: 'assistant',
            content: '',
            kind: 'offers',
            ui: {
              show_offers: true,
              recommended_offer_ids: data.ui?.recommended_offer_ids || [],
            },
          },
        ]);
      }

      // Order created
      if (data.order_url) {
        setMessages((prev) => [
          ...prev,
          {
            id: `a-order-${Date.now()}`,
            role: 'assistant',
            content: `Order created successfully. Link to the order: ${data.order_url}`,
          },
        ]);
      }
    } catch (err: any) {
      console.error('Assistant error:', err);
      // Don't show technical error to user if it's a 404 (already handled above)
      if (!err.message?.includes('404')) {
        setError(err?.message || 'Error contacting the assistant.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <section className="mb-12 mx-2 sm:mx-4">
      <div className="bg-white shadow-xl rounded-2xl border border-gray-100 flex flex-col h-[480px] overflow-hidden transition-all duration-300">
        <div className="bg-white pl-10 pr-6 py-5 flex items-center justify-between text-gray-900 border-b border-gray-100">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-gray-50 rounded-xl">
              <ChatBubbleLeftRightIcon className="w-5 h-5 text-gray-400" />
            </div>
            <div>
              <h2 className="text-sm font-bold tracking-tight">
                PrintPrice Pro – AI Assistant
              </h2>
              <p className="text-[10px] text-gray-400 font-medium uppercase tracking-wider">
                Expert knowledge at your service
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 bg-green-50 px-2 py-1 rounded-full border border-green-100">
            <span className="relative flex h-1.5 w-1.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-green-500"></span>
            </span>
            <span className="text-[9px] font-bold uppercase tracking-widest text-green-700">Online</span>
          </div>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto space-y-4 pl-10 pr-6 py-6 scroll-smooth bg-gray-50/30">
          {messages.map((m) => (
            <div
              key={m.id}
              className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              <div
                className={`max-w-[85%] rounded-2xl px-4 py-3 shadow-sm ${m.role === 'user'
                  ? 'bg-indigo-600 text-white rounded-tr-none'
                  : 'bg-white text-gray-800 rounded-tl-none border border-gray-100'
                  }`}
              >
                {m.content.includes('Project Summary') ? (
                  <div className="space-y-4">
                    <p className="font-semibold border-b border-gray-200 pb-1 mb-2">📋 {t('project_summary_title') || 'Project Summary'}</p>
                    <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-[11px]">
                      {m.content.split('\n').filter(line => line.includes(':')).map((line, idx) => {
                        const [label, value] = line.replace(/^[•\-\*]\s*/, '').split(':');
                        return (
                          <div key={idx} className="flex flex-col">
                            <span className="text-gray-400 uppercase text-[9px] font-bold tracking-tight">{label.trim()}</span>
                            <span className="font-medium text-gray-700">{value?.trim()}</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ) : m.kind === 'offers' ? (
                  <div className="space-y-3">
                    <p className="font-semibold border-b border-gray-200 pb-1 italic">✨ {t('recommended_offers') || 'Recommended Offers'}</p>
                    <div className="space-y-2">
                      {offers?.offers?.length ? (
                        [...offers.offers].sort((a, b) => a.total_cost - b.total_cost).slice(0, 3).map((offer, index) => {
                          const isBest = index === 0;
                          return (
                            <button
                              key={offer.id}
                              onClick={() => onChooseOffer(offer)}
                              className={`w-full text-left bg-white hover:bg-red-50 border ${isBest ? 'border-red-500 ring-1 ring-red-500' : 'border-gray-200'} hover:border-red-200 rounded-xl p-3 transition-all duration-200 group relative overflow-hidden shadow-sm`}
                            >
                              {isBest && (
                                <div className="absolute top-0 right-0 bg-red-500 text-white text-[8px] font-bold px-2 py-0.5 rounded-bl-lg uppercase tracking-widest">
                                  Best Price
                                </div>
                              )}
                              <div className="flex justify-between items-start mb-1">
                                <span className="text-xs font-bold text-gray-800 group-hover:text-red-700">{offer.print_house}</span>
                                <span className="text-xs font-bold text-red-600">{offer.total_cost.toLocaleString()} {offer.currency}</span>
                              </div>
                              <div className="flex items-center gap-2 text-[10px] text-gray-500 italic">
                                <span>🚚 {offer.estimated_delivery_time || 'Check delivery'}</span>
                              </div>
                              <div className="mt-2 text-[9px] font-bold text-red-600 uppercase tracking-widest opacity-0 group-hover:opacity-100 transition-opacity">
                                Select this offer →
                              </div>
                            </button>
                          );
                        })
                      ) : (
                        <div className="text-xs text-gray-400 italic py-2">
                          Calculating offers... please wait.
                        </div>
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="whitespace-pre-line">{m.content}</div>
                )}
              </div>
            </div>
          ))}
          {error && (
            <p className="text-xs text-red-600 mt-1">
              Error: {error}
            </p>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Input */}
        <div className="pl-10 pr-6 py-5 bg-white border-t border-gray-100 flex items-center gap-3">
          <textarea
            rows={1}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                sendMessage();
              }
            }}
            placeholder="E.g., I want to print 500 copies of a hardcover novel in A5..."
            className="flex-1 resize-none border-none focus:ring-0 text-sm py-2 placeholder-gray-400"
          />
          <button
            type="button"
            onClick={sendMessage}
            disabled={loading || !input.trim()}
            className="inline-flex items-center justify-center rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-bold text-white shadow-lg shadow-indigo-200 hover:bg-indigo-700 disabled:opacity-50 transition-all duration-200"
          >
            {loading ? (
              <span className="animate-spin rounded-full h-4 w-4 border-b-2 border-white" />
            ) : (
              <PaperAirplaneIcon className="h-4 w-4" />
            )}
          </button>
        </div>
      </div>
    </section>
  );
};

export default AssistantChat;
