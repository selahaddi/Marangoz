import { useMemo, useState } from "react";
import {
  Check,
  Filter,
  LayoutGrid,
  Search,
  Sparkles,
  X,
  ArrowRight,
} from "lucide-react";
import { CATALOG_CATEGORIES, ROOM_LINE_PRESETS } from "../services/clientEngine";
import type { CatalogCategoryId, RoomLinePreset } from "../types/cabinet";

interface TemplateCatalogDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  activePresetId: string | null;
  onSelectPreset: (preset: RoomLinePreset) => void;
  onSelectPrompt: (prompt: string) => void;
}

export function TemplateCatalogDrawer({
  isOpen,
  onClose,
  activePresetId,
  onSelectPreset,
  onSelectPrompt,
}: TemplateCatalogDrawerProps) {
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [activeCategory, setActiveCategory] = useState<CatalogCategoryId | "all">("all");
  const [scopeFilter, setScopeFilter] = useState<"all" | "single" | "multi">("all");

  const filteredPresets = useMemo(() => {
    return ROOM_LINE_PRESETS.filter((preset) => {
      // 1. Kategori filtresi
      if (activeCategory !== "all" && preset.categoryId !== activeCategory) {
        return false;
      }

      // 2. Kapsam filtresi (Tekil vs Çoklu modül)
      const modCount = 1 + (preset.config.additional_modules?.length ?? 0);
      if (scopeFilter === "single" && modCount > 1) return false;
      if (scopeFilter === "multi" && modCount <= 1) return false;

      // 3. Arama sorgusu filtresi
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchTitle = preset.title.toLowerCase().includes(q);
        const matchSubtitle = preset.subtitle.toLowerCase().includes(q);
        const matchCategory = preset.category.toLowerCase().includes(q);
        const matchHighlights = preset.highlights.some((h) => h.toLowerCase().includes(q));
        const matchDims = `${preset.totalWidthMm} ${preset.config.height_mm} ${preset.config.depth_mm}`.includes(q);
        if (!matchTitle && !matchSubtitle && !matchCategory && !matchHighlights && !matchDims) {
          return false;
        }
      }

      return true;
    });
  }, [activeCategory, scopeFilter, searchQuery]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-end bg-black/70 backdrop-blur-sm transition-opacity">
      {/* Drawer Container */}
      <div className="relative flex h-full w-full max-w-4xl flex-col border-l border-slate-800 bg-slate-950 text-slate-100 shadow-2xl animate-in slide-in-from-right duration-200">
        {/* Drawer Header */}
        <div className="flex items-center justify-between border-b border-slate-800 bg-slate-900/90 px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-600/20 text-indigo-400">
              <LayoutGrid className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white">
                Üretim Şablon &amp; Oda Hattı Kütüphanesi
              </h2>
              <p className="text-xs text-slate-400">
                {CATALOG_CATEGORIES.length} Kategori · Toplam {ROOM_LINE_PRESETS.length} Hazır Parametrik Şablon
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border border-slate-800 p-2 text-slate-400 hover:bg-slate-800 hover:text-white transition"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Search & Filter Bar */}
        <div className="space-y-3 border-b border-slate-800 bg-slate-900/50 p-4 sm:px-6">
          <div className="relative">
            <Search className="absolute left-3.5 top-3 h-4 w-4 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Şablon ara (örn: buzdolabı nişi, gardırop, şifonyer, 210 cm, meşe)..."
              className="w-full rounded-xl border border-slate-700 bg-slate-950 py-2.5 pl-10 pr-4 text-xs text-slate-100 placeholder-slate-500 focus:border-indigo-500 focus:outline-none"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery("")}
                className="absolute right-3 top-2.5 text-xs text-slate-400 hover:text-white"
              >
                Temizle
              </button>
            )}
          </div>

          {/* Scope Filters & Category Pills */}
          <div className="flex flex-wrap items-center justify-between gap-2">
            {/* Kategori Seçicileri */}
            <div className="flex flex-wrap items-center gap-1.5 overflow-x-auto py-1">
              <button
                type="button"
                onClick={() => setActiveCategory("all")}
                className={`rounded-lg border px-2.5 py-1 text-xs font-semibold transition ${
                  activeCategory === "all"
                    ? "border-indigo-500 bg-indigo-600/30 text-white"
                    : "border-slate-800 bg-slate-900/80 text-slate-400 hover:text-slate-200"
                }`}
              >
                Tümü ({ROOM_LINE_PRESETS.length})
              </button>
              {CATALOG_CATEGORIES.map((cat) => {
                const count = ROOM_LINE_PRESETS.filter((p) => p.categoryId === cat.id).length;
                return (
                  <button
                    key={cat.id}
                    type="button"
                    onClick={() => setActiveCategory(cat.id)}
                    className={`rounded-lg border px-2.5 py-1 text-xs font-semibold transition ${
                      activeCategory === cat.id
                        ? "border-indigo-500 bg-indigo-600/30 text-white"
                        : "border-slate-800 bg-slate-900/80 text-slate-400 hover:text-slate-200"
                    }`}
                  >
                    <span>{cat.label}</span>
                    <span className="ml-1 rounded bg-slate-800 px-1 py-0.2 font-mono text-[10px] text-slate-300">
                      {count}
                    </span>
                  </button>
                );
              })}
            </div>

            {/* Tekil vs Çoklu Modül */}
            <div className="flex items-center gap-1 rounded-lg border border-slate-800 bg-slate-900 p-0.5 text-[11px]">
              <button
                type="button"
                onClick={() => setScopeFilter("all")}
                className={`rounded px-2 py-0.5 font-medium transition ${
                  scopeFilter === "all" ? "bg-indigo-600 text-white" : "text-slate-400 hover:text-white"
                }`}
              >
                Tümü
              </button>
              <button
                type="button"
                onClick={() => setScopeFilter("single")}
                className={`rounded px-2 py-0.5 font-medium transition ${
                  scopeFilter === "single" ? "bg-indigo-600 text-white" : "text-slate-400 hover:text-white"
                }`}
              >
                Tekil
              </button>
              <button
                type="button"
                onClick={() => setScopeFilter("multi")}
                className={`rounded px-2 py-0.5 font-medium transition ${
                  scopeFilter === "multi" ? "bg-indigo-600 text-white" : "text-slate-400 hover:text-white"
                }`}
              >
                Çoklu Hat
              </button>
            </div>
          </div>
        </div>

        {/* Presets Grid (Scrollable) */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6">
          {filteredPresets.length === 0 ? (
            <div className="flex h-64 flex-col items-center justify-center rounded-2xl border border-dashed border-slate-800 text-center text-slate-400">
              <Filter className="mb-2 h-8 w-8 text-slate-600" />
              <p className="text-sm font-semibold">Eşleşen şablon bulunamadı.</p>
              <p className="mt-1 text-xs text-slate-500">
                Arama terimini değiştirebilir veya kategori filtrelerini sıfırlayabilirsiniz.
              </p>
              <button
                type="button"
                onClick={() => {
                  setSearchQuery("");
                  setActiveCategory("all");
                  setScopeFilter("all");
                }}
                className="mt-3 rounded-lg bg-slate-800 px-3 py-1.5 text-xs font-semibold text-slate-300 hover:bg-slate-700"
              >
                Filtreleri Temizle
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-3.5 md:grid-cols-2">
              {filteredPresets.map((preset) => {
                const isSelected = activePresetId === preset.id;
                const moduleCount = 1 + (preset.config.additional_modules?.length ?? 0);
                const isMulti = moduleCount > 1;

                return (
                  <div
                    key={preset.id}
                    className={`flex flex-col justify-between rounded-xl border p-4 transition ${
                      isSelected
                        ? "border-indigo-500 bg-indigo-950/40 text-white shadow-lg shadow-indigo-500/10 ring-1 ring-indigo-500/50"
                        : "border-slate-800/90 bg-slate-900/70 text-slate-300 hover:border-slate-700 hover:bg-slate-900"
                    }`}
                  >
                    <div>
                      {/* Üst Başlık & Rozetler */}
                      <div className="flex flex-wrap items-center justify-between gap-1.5">
                        <span
                          className={`rounded px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${
                            isMulti
                              ? "bg-indigo-500/20 text-indigo-300 border border-indigo-500/30"
                              : "bg-sky-500/20 text-sky-300 border border-sky-500/30"
                          }`}
                        >
                          {isMulti ? `${moduleCount} Modül Oda Hattı` : "Tekil Modül"}
                        </span>
                        <span className="font-mono text-xs font-bold text-emerald-400">
                          {isMulti
                            ? `${preset.totalWidthMm} × ${preset.config.height_mm} × ${preset.config.depth_mm} mm`
                            : `${preset.config.width_mm} × ${preset.config.height_mm} × ${preset.config.depth_mm} mm`}
                        </span>
                      </div>

                      <h3 className="mt-2 text-sm font-bold text-slate-100">{preset.title}</h3>
                      <p className="mt-1 text-xs text-slate-400 line-clamp-2 leading-relaxed">
                        {preset.subtitle}
                      </p>

                      {/* Öne Çıkan Özellikler */}
                      <div className="mt-3 flex flex-wrap gap-1">
                        {preset.highlights.map((h, hIdx) => (
                          <span
                            key={hIdx}
                            className="rounded-md border border-slate-800 bg-slate-950/80 px-2 py-0.5 text-[10px] font-medium text-slate-300"
                          >
                            {h}
                          </span>
                        ))}
                      </div>
                    </div>

                    {/* Butonlar */}
                    <div className="mt-4 flex items-center gap-2 border-t border-slate-800/80 pt-3">
                      <button
                        type="button"
                        onClick={() => {
                          onSelectPreset(preset);
                          onClose();
                        }}
                        className={`flex flex-1 items-center justify-center gap-1.5 rounded-lg py-2 text-xs font-bold transition ${
                          isSelected
                            ? "bg-indigo-600 text-white shadow-md shadow-indigo-600/30"
                            : "bg-indigo-600/20 text-indigo-300 hover:bg-indigo-600 hover:text-white"
                        }`}
                      >
                        {isSelected ? (
                          <>
                            <Check className="h-3.5 w-3.5" />
                            Aktif Şablon
                          </>
                        ) : (
                          <>
                            <ArrowRight className="h-3.5 w-3.5" />
                            3D &amp; Üretime Yükle
                          </>
                        )}
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          onSelectPrompt(preset.prompt);
                          onClose();
                        }}
                        title="Bu şablonun metin istemini AI çubuğuna aktar"
                        className="inline-flex items-center gap-1 rounded-lg border border-sky-500/30 bg-sky-500/10 px-2.5 py-2 text-xs font-semibold text-sky-300 hover:bg-sky-500/20 transition"
                      >
                        <Sparkles className="h-3.5 w-3.5" />
                        AI İstem
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Drawer Footer */}
        <div className="flex items-center justify-between border-t border-slate-800 bg-slate-900/90 px-6 py-3 text-xs text-slate-400">
          <span>Gösterilen Şablon: {filteredPresets.length} / {ROOM_LINE_PRESETS.length}</span>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg bg-slate-800 px-4 py-1.5 font-semibold text-slate-200 hover:bg-slate-700 transition"
          >
            Kapat
          </button>
        </div>
      </div>
    </div>
  );
}
