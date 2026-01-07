import React, { useState, useRef, useEffect } from 'react';
import { AI_ASSISTANT_ENDPOINT, PRINTPRICE_ASSISTANT_PROMPT } from '../constants';
import { InitialBookPricePayload, BookPriceResponse } from '../types';
import { PaperAirplaneIcon } from '@heroicons/react/24/solid';

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
}) => {
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: 'welcome',
      role: 'assistant',
      content:
        "Hello, I'm PrintPrice Pro AI Assistant. I can help you describe your book printing project and get real quotes. Note: The AI service may not be available yet - if so, please use the form below to enter your specifications manually.",
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
    <section className="mb-6">
      <div className="bg-white shadow-md rounded-lg p-4 sm:p-5 flex flex-col h-80">
        <div className="flex items-center justify-between mb-3">
          <div>
            <h2 className="text-sm font-semibold text-gray-800">
              PrintPrice Pro – AI Assistant
            </h2>
            <p className="text-xs text-gray-500">
              Define presets, normalize specifications, calculate real quotes, and create the order.
            </p>
          </div>
          <span className="inline-flex items-center rounded-full bg-green-100 px-2 py-0.5 text-[10px] font-medium text-green-800">
            ● Online
          </span>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto space-y-2 pr-1 text-sm">
          {messages.map((m) => (
            <div
              key={m.id}
              className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              <div
                className={`max-w-[80%] rounded-lg px-3 py-2 ${m.role === 'user'
                  ? 'bg-indigo-600 text-white rounded-br-none'
                  : 'bg-gray-100 text-gray-800 rounded-bl-none'
                  }`}
              >
                {m.content}
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
        <div className="mt-3 flex items-center gap-2">
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
            placeholder="Describe your book project..."
            className="flex-1 resize-none rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
          />
          <button
            type="button"
            onClick={sendMessage}
            disabled={loading || !input.trim()}
            className="inline-flex items-center justify-center rounded-md bg-indigo-600 px-3 py-2 text-sm font-medium text-white shadow-sm hover:bg-indigo-700 disabled:opacity-50"
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
