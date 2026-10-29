import { useEffect, useRef, useState } from "react";
import {
  Bot,
  CheckCircle2,
  CornerDownLeft,
  Loader2,
  RotateCcw,
  Send,
  Sparkles,
  Trash2,
  User,
  Wand2,
  X,
} from "lucide-react";
import { reviseCabinet } from "../services/revisionClient";
import type { CabinetConfig, ChatMessage } from "../types/cabinet";

interface AIChatDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  currentConfig: CabinetConfig;
  onApplyConfig: (newConfig: CabinetConfig, diffs: string[]) => void;
  canUndo: boolean;
  onUndo: () => void;
  undoCount: number;
}

const QUICK_REVISION_CHIPS: string[] = [
  "Genişliği 120 cm yap",
  "Altına 2 çekmece ekle",
  "Kapakları antrasit yap",
  "Ortaya ahşap kahve nişi ekle",
  "Tavandan tabana bazasız yap",
  "3 raf daha ekle",
  "Üst kalkar kapaklı buzdolabı dolabına çevir",
  "Arka süpürgelik kertmesi ekle",
  "Sağ ve sol rölöve kör çıtaları ekle",
  "Açık raflı yap (kapakları kaldır)",
];

const INITIAL_WELCOME_MESSAGE: ChatMessage = {
  role: "assistant",
  content:
    "Merhaba! Ben Marangoz AI Tasarım ve Canlı Revizyon Asistanınızım. 📐\n\n" +
    "Mevcut dolabınızın ölçülerini, kapaklarını, çekmecelerini, nişlerini veya renklerini konuşarak anında güncelleyebilirsiniz. " +
    "Önceki ayarlarınız ve özel detaylarınız kaybolmaz, sadece istediğiniz kısımlar hassasça revize edilir.",
  timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
};

export function AIChatDrawer({
  isOpen,
  onClose,
  currentConfig,
  onApplyConfig,
  canUndo,
  onUndo,
  undoCount,
}: AIChatDrawerProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([INITIAL_WELCOME_MESSAGE]);
  const [inputPrompt, setInputPrompt] = useState<string>("");
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      setTimeout(() => {
        inputRef.current?.focus();
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
      }, 150);
    }
  }, [isOpen, messages]);

  if (!isOpen) return null;

  const handleSend = async (customText?: string) => {
    const textToSend = (customText || inputPrompt).trim();
    if (!textToSend || isProcessing) return;

    setError(null);
    setInputPrompt("");

    const userMsg: ChatMessage = {
      role: "user",
      content: textToSend,
      timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    };

    setMessages((prev) => [...prev, userMsg]);
    setIsProcessing(true);

    try {
      const response = await reviseCabinet(currentConfig, textToSend, messages);

      const assistantMsg: ChatMessage = {
        role: "assistant",
        content: response.assistant_message,
        diff_summary: response.diff_summary,
        timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      };

      setMessages((prev) => [...prev, assistantMsg]);
      onApplyConfig(response.updated_config, response.diff_summary);
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : String(err);
      setError(`Revizyon sırasında hata: ${errMsg}`);
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: `⚠️ İşlem gerçekleştirilemedi: ${errMsg}`,
          timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        },
      ]);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      void handleSend();
    }
  };

  const handleClearHistory = () => {
    setMessages([INITIAL_WELCOME_MESSAGE]);
    setError(null);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-end bg-black/70 backdrop-blur-sm transition-opacity">
      {/* Drawer Container */}
      <div className="relative flex h-full w-full max-w-xl flex-col border-l border-slate-800 bg-slate-950 text-slate-100 shadow-2xl animate-in slide-in-from-right duration-200">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-800 bg-slate-900/95 px-5 py-3.5 backdrop-blur">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-tr from-amber-600 to-indigo-600 text-white shadow-lg shadow-indigo-900/30">
              <Sparkles className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-slate-100">AI Canlı Revizyon Asistanı</h2>
                <span className="rounded-full bg-emerald-500/20 px-2 py-0.5 text-[10px] font-semibold text-emerald-400 border border-emerald-500/30">
                  Canlı & İnteraktif
                </span>
              </div>
              <p className="text-xs text-slate-400">
                Dolabınızı konuşarak cerrahi olarak modifiye edin (Mevcut: {currentConfig.width_mm}x{currentConfig.height_mm}x{currentConfig.depth_mm} mm)
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            {canUndo && (
              <button
                type="button"
                onClick={onUndo}
                title="Son Revizyonu Geri Al"
                className="flex items-center gap-1.5 rounded-lg border border-amber-500/40 bg-amber-500/10 px-2.5 py-1.5 text-xs font-semibold text-amber-300 hover:bg-amber-500/20 transition-colors"
              >
                <RotateCcw className="h-3.5 w-3.5" />
                <span>Geri Al ({undoCount})</span>
              </button>
            )}

            <button
              type="button"
              onClick={handleClearHistory}
              title="Sohbeti Temizle"
              className="rounded-lg p-2 text-slate-400 hover:bg-slate-800 hover:text-slate-200 transition-colors"
            >
              <Trash2 className="h-4 w-4" />
            </button>

            <button
              type="button"
              onClick={onClose}
              title="Kapat"
              className="rounded-lg p-2 text-slate-400 hover:bg-slate-800 hover:text-slate-200 transition-colors"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* Current Active Config Indicator */}
        <div className="flex items-center justify-between border-b border-slate-800/80 bg-slate-900/40 px-5 py-2 text-xs text-slate-300">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-amber-400">{currentConfig.name}</span>
            <span className="text-slate-500">|</span>
            <span>{currentConfig.shelf_count} Raf</span>
            <span className="text-slate-500">|</span>
            <span>{currentConfig.drawer_count} Çekmece</span>
            <span className="text-slate-500">|</span>
            <span>{currentConfig.has_plinth ? `${currentConfig.plinth_height_mm}mm Baza` : "Bazasız"}</span>
          </div>
          <span className="text-[11px] text-slate-400">Çift yönlü 3D & CAD senkronize</span>
        </div>

        {/* Quick Suggestion Chips */}
        <div className="border-b border-slate-800/80 bg-slate-950/80 px-4 py-2.5">
          <div className="mb-1.5 flex items-center gap-1.5 text-[11px] font-semibold text-slate-400">
            <Wand2 className="h-3.5 w-3.5 text-indigo-400" />
            <span>Hızlı Revizyon Önerileri (Tıklayın):</span>
          </div>
          <div className="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto pr-1">
            {QUICK_REVISION_CHIPS.map((chip, idx) => (
              <button
                key={idx}
                type="button"
                disabled={isProcessing}
                onClick={() => void handleSend(chip)}
                className="rounded-full border border-slate-700/80 bg-slate-900/90 px-2.5 py-1 text-xs text-slate-300 hover:border-indigo-500 hover:bg-indigo-950/40 hover:text-indigo-200 transition-all disabled:opacity-50"
              >
                + {chip}
              </button>
            ))}
          </div>
        </div>

        {/* Messages Body */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {messages.map((msg, idx) => (
            <div
              key={idx}
              className={`flex gap-3 ${
                msg.role === "user" ? "justify-end" : "justify-start"
              }`}
            >
              {msg.role === "assistant" && (
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-indigo-600/30 border border-indigo-500/40 text-indigo-300">
                  <Bot className="h-4 w-4" />
                </div>
              )}

              <div
                className={`max-w-[85%] rounded-2xl px-4 py-3 text-sm shadow-md ${
                  msg.role === "user"
                    ? "bg-indigo-600 text-white rounded-br-none"
                    : "bg-slate-900/90 border border-slate-800 text-slate-200 rounded-bl-none"
                }`}
              >
                <div className="whitespace-pre-wrap leading-relaxed">
                  {msg.content}
                </div>

                {/* Diff badges */}
                {msg.diff_summary && msg.diff_summary.length > 0 && (
                  <div className="mt-2.5 pt-2.5 border-t border-slate-800/80 space-y-1">
                    <div className="flex items-center gap-1.5 text-xs font-semibold text-emerald-400">
                      <CheckCircle2 className="h-3.5 w-3.5" />
                      <span>Uygulanan CAD/CAM Değişiklikleri:</span>
                    </div>
                    <div className="flex flex-wrap gap-1.5 pt-1">
                      {msg.diff_summary.map((diff, dIdx) => (
                        <span
                          key={dIdx}
                          className="inline-flex items-center rounded-md bg-emerald-950/50 border border-emerald-500/30 px-2 py-0.5 text-xs font-medium text-emerald-300"
                        >
                          {diff}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {msg.timestamp && (
                  <div
                    className={`mt-1.5 text-[10px] text-right ${
                      msg.role === "user" ? "text-indigo-200" : "text-slate-500"
                    }`}
                  >
                    {msg.timestamp}
                  </div>
                )}
              </div>

              {msg.role === "user" && (
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-slate-800 border border-slate-700 text-slate-300">
                  <User className="h-4 w-4" />
                </div>
              )}
            </div>
          ))}

          {isProcessing && (
            <div className="flex items-center gap-3">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-600/30 border border-indigo-500/40 text-indigo-300">
                <Bot className="h-4 w-4" />
              </div>
              <div className="flex items-center gap-2 rounded-2xl bg-slate-900/90 border border-slate-800 px-4 py-2.5 text-sm text-slate-400">
                <Loader2 className="h-4 w-4 animate-spin text-indigo-400" />
                <span>Parametreler hesaplanıyor ve 3D modele işleniyor...</span>
              </div>
            </div>
          )}

          {error && (
            <div className="rounded-xl border border-rose-500/30 bg-rose-950/30 px-3.5 py-2.5 text-xs text-rose-300">
              {error}
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Input Bar */}
        <div className="border-t border-slate-800 bg-slate-900/90 p-4">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void handleSend();
            }}
            className="flex items-center gap-2"
          >
            <div className="relative flex-1">
              <input
                ref={inputRef}
                type="text"
                value={inputPrompt}
                onChange={(e) => setInputPrompt(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Örn: Genişliği 120 yap, altına 2 çekmece ekle, kapakları antrasit yap..."
                disabled={isProcessing}
                className="w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-sm text-slate-100 placeholder-slate-500 shadow-inner focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 disabled:opacity-50"
              />
            </div>

            <button
              type="submit"
              disabled={isProcessing || !inputPrompt.trim()}
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-gradient-to-tr from-amber-500 to-indigo-600 text-white shadow-lg shadow-indigo-900/30 hover:opacity-95 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
              title="Gönder (Enter)"
            >
              {isProcessing ? (
                <Loader2 className="h-5 w-5 animate-spin" />
              ) : (
                <Send className="h-5 w-5" />
              )}
            </button>
          </form>

          <div className="mt-2 flex items-center justify-between text-[11px] text-slate-500">
            <span>Enter tuşuyla gönderilir • Türkçe doğal dil desteği</span>
            <span className="flex items-center gap-1 text-slate-400">
              <CornerDownLeft className="h-3 w-3" /> Shift+Enter gerekmez
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
