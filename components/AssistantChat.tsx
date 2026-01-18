import React, { useState, useRef, useEffect } from 'react';
import { AI_ASSISTANT_ENDPOINT, PRINTPRICE_ASSISTANT_PROMPT } from '../constants';
import { InitialBookPricePayload, BookPriceResponse } from '../types';
import { PaperAirplaneIcon, ChatBubbleLeftRightIcon } from '@heroicons/react/24/solid';
import { t } from '../i18n/en';

type ChatRole = 'user' | 'assistant';

interface ChatMessage {
  id: string;
  role: ChatRole;
  content: string;
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
  specs_patch?: Partial<InitialBookPricePayload>;
  offers?: BookPriceResponse;
  order_url?: string;
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

    setMessages((prev) => [...prev, userMessage]);
    setInput('');
    setError(null);
    setLoading(true);

    try {
      const payload = {
        system_prompt: PRINTPRICE_ASSISTANT_PROMPT,
        messages: [
          ...messages.map((m) => ({ role: m.role, content: m.content })),
          { role: 'user', content: trimmed },
        ],
        // Current state of the UI: the model can use it
        ui_state: {
          specs,
          offers,
        },
      };

      const res = await fetch(AI_ASSISTANT_ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        // Handle 404 specifically - AI endpoint not available
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

      // Response visible to the user
      if (data.reply) {
        setMessages((prev) => [
          ...prev,
          { id: `a-${Date.now()}`, role: 'assistant', content: data.reply },
        ]);
      }

      // Specification patches (e.g., preset applied, normalization, etc.)
      if (data.specs_patch) {
        onSpecsPatch(data.specs_patch);
      }

      // Offers calculated by the assistant backend (if it already called the BPE)
      if (data.offers) {
        onOffersUpdate(data.offers);
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
    <section className="mb-8">
      <div className="bg-white shadow-xl rounded-2xl border border-gray-100 flex flex-col h-[450px] overflow-hidden">
        <div className="bg-white px-6 py-4 flex items-center justify-between text-gray-900 border-b border-gray-100">
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
        <div className="flex-1 overflow-y-auto space-y-4 p-6 scroll-smooth bg-gray-50/30">
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
                ) : m.content.includes('Offers:') || m.content.includes('Best offers:') ? (
                  <div className="space-y-3">
                    <p className="font-semibold border-b border-gray-200 pb-1 italic">✨ {t('recommended_offers') || 'Recommended Offers'}</p>
                    <div className="space-y-2">
                      {offers?.offers.map((offer) => (
                        <button
                          key={offer.id}
                          onClick={() => onChooseOffer(offer)}
                          className="w-full text-left bg-white hover:bg-red-50 border border-gray-200 hover:border-red-200 rounded-xl p-3 transition-all duration-200 group relative overflow-hidden shadow-sm"
                        >
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
                      ))}
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
        <div className="p-4 bg-white border-t border-gray-100 flex items-center gap-3">
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
