import { useMemo, useRef, useState } from "react";
import {
  ArrowRight,
  Bookmark,
  Check,
  Download,
  FileJson,
  Filter,
  LayoutGrid,
  Plus,
  Search,
  Sparkles,
  Star,
  Trash2,
  Upload,
  X,
} from "lucide-react";
import { CATALOG_CATEGORIES, ROOM_LINE_PRESETS } from "../services/clientEngine";
import {
  deleteUserCustomPreset,
  exportAllPresetsAsJsonFile,
  exportSinglePresetAsJsonFile,
  getUserCustomPresets,
  importPresetsFromJsonText,
  saveUserCustomPreset,
} from "../services/customPresetsManager";
import type {
  CabinetConfig,
  CatalogCategoryId,
  RoomLinePreset,
  UserCustomPreset,
} from "../types/cabinet";

interface TemplateCatalogDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  activePresetId: string | null;
  onSelectPreset: (preset: RoomLinePreset) => void;
  onSelectPrompt: (prompt: string) => void;
  currentConfig?: CabinetConfig;
  onSelectCustomConfig?: (config: CabinetConfig) => void;
}

export function TemplateCatalogDrawer({
  isOpen,
  onClose,
  activePresetId,
  onSelectPreset,
  onSelectPrompt,
  currentConfig,
  onSelectCustomConfig,
}: TemplateCatalogDrawerProps) {
  const [mainTab, setMainTab] = useState<"standard" | "custom">("standard");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [activeCategory, setActiveCategory] = useState<CatalogCategoryId | "all">("all");
  const [scopeFilter, setScopeFilter] = useState<"all" | "single" | "multi">("all");

  // Özel şablonlar state'i
  const [userPresets, setUserPresets] = useState<UserCustomPreset[]>(() =>
    getUserCustomPresets()
  );
  const [showSaveForm, setShowSaveForm] = useState<boolean>(false);
  const [saveTitle, setSaveTitle] = useState<string>("");
  const [saveDesc, setSaveDesc] = useState<string>("");
  const [saveTagInput, setSaveTagInput] = useState<string>("");
  const [importStatus, setImportStatus] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const refreshUserPresets = () => {
    setUserPresets(getUserCustomPresets());
  };

  const handleSaveCurrent = (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentConfig) return;
    const tags = saveTagInput
      .split(",")
      .map((t) => t.trim())
      .filter(Boolean);

    saveUserCustomPreset(
      saveTitle || currentConfig.name || "Özel Tasarım",
      saveDesc,
      currentConfig,
      tags
    );
    refreshUserPresets();
    setShowSaveForm(false);
    setSaveTitle("");
    setSaveDesc("");
    setSaveTagInput("");
  };

  const handleDeletePreset = (id: string) => {
    deleteUserCustomPreset(id);
    refreshUserPresets();
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      const res = importPresetsFromJsonText(text);
      if (res.importedCount > 0) {
        setImportStatus(`Başarıyla ${res.importedCount} adet şablon içe aktarıldı!`);
        refreshUserPresets();
      } else {
        setImportStatus(`Hata: ${res.errors.join(", ")}`);
      }
      setTimeout(() => setImportStatus(null), 4000);
    };
    reader.readAsText(file);
    e.target.value = "";
  };

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

  const filteredCustomPresets = useMemo(() => {
    if (!searchQuery.trim()) return userPresets;
    const q = searchQuery.toLowerCase();
    return userPresets.filter(
      (p) =>
        p.title.toLowerCase().includes(q) ||
        p.description.toLowerCase().includes(q) ||
        p.tags?.some((t) => t.toLowerCase().includes(q)) ||
        `${p.config.width_mm} ${p.config.height_mm} ${p.config.depth_mm}`.includes(q)
    );
  }, [userPresets, searchQuery]);

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
                Şablon Kütüphanesi &amp; Özel Tasarım Yöneticisi
              </h2>
              <p className="text-xs text-slate-400">
                {ROOM_LINE_PRESETS.length} Fabrika Şablonu · {userPresets.length} Özel Tasarım · JSON Dışa/İçe Aktar
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

        {/* Ana Tab Switcher: Standart vs Özel Şablonlar */}
        <div className="flex items-center justify-between border-b border-slate-800 bg-slate-900/60 px-6 py-2">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setMainTab("standard")}
              className={`flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-bold transition ${
                mainTab === "standard"
                  ? "bg-indigo-600 text-white shadow-md shadow-indigo-600/30"
                  : "bg-slate-800/80 text-slate-400 hover:text-slate-200"
              }`}
            >
              <LayoutGrid className="h-4 w-4" />
              <span>Standart Fabrika Şablonları ({ROOM_LINE_PRESETS.length})</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setMainTab("custom");
                refreshUserPresets();
              }}
              className={`flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-bold transition ${
                mainTab === "custom"
                  ? "bg-amber-600 text-white shadow-md shadow-amber-600/30"
                  : "bg-slate-800/80 text-slate-400 hover:text-slate-200"
              }`}
            >
              <Star className="h-4 w-4 text-amber-300" />
              <span>Özel Tasarımlarım ({userPresets.length})</span>
            </button>
          </div>

          {/* Gizli JSON dosya yükleme inputu */}
          <input
            ref={fileInputRef}
            type="file"
            accept=".json,application/json"
            onChange={handleFileUpload}
            className="hidden"
          />

          {mainTab === "custom" && (
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                title="Bilgisayarınızdan .JSON tasarım yükleyin"
                className="flex items-center gap-1.5 rounded-lg border border-slate-700 bg-slate-800 px-3 py-1.5 text-xs font-semibold text-slate-300 hover:bg-slate-700 transition"
              >
                <Upload className="h-3.5 w-3.5" />
                <span>JSON İçe Aktar</span>
              </button>
              <button
                type="button"
                onClick={exportAllPresetsAsJsonFile}
                title="Tüm özel tasarımları tek bir JSON dosyası olarak indirin"
                className="flex items-center gap-1.5 rounded-lg border border-slate-700 bg-slate-800 px-3 py-1.5 text-xs font-semibold text-slate-300 hover:bg-slate-700 transition"
              >
                <Download className="h-3.5 w-3.5" />
                <span>Tümünü İndir</span>
              </button>
            </div>
          )}
        </div>

        {/* Bildirim Durumu */}
        {importStatus && (
          <div className="bg-emerald-950/70 border-b border-emerald-500/40 px-6 py-2 text-xs text-emerald-300 font-medium">
            {importStatus}
          </div>
        )}

        {/* Search & Filter Bar */}
        <div className="space-y-3 border-b border-slate-800 bg-slate-900/50 p-4 sm:px-6">
          <div className="relative">
            <Search className="absolute left-3.5 top-3 h-4 w-4 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={
                mainTab === "standard"
                  ? "Şablon ara (örn: buzdolabı nişi, gardırop, şifonyer, 210 cm, meşe)..."
                  : "Özel tasarımlarımda ara (örn: merdiven altı, l-köşe, ada, vestiyer)..."
              }
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

          {mainTab === "standard" ? (
            <div className="flex flex-wrap items-center justify-between gap-2">
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
          ) : (
            <div className="flex items-center justify-between">
              <span className="text-xs text-slate-400">
                Tarayıcınızda kayıtlı şablonlar: {filteredCustomPresets.length} adet
              </span>

              {currentConfig && (
                <button
                  type="button"
                  onClick={() => setShowSaveForm((prev) => !prev)}
                  className="flex items-center gap-1.5 rounded-lg border border-amber-500/50 bg-amber-500/10 px-3 py-1.5 text-xs font-bold text-amber-300 hover:bg-amber-500/20 transition"
                >
                  <Plus className="h-3.5 w-3.5" />
                  <span>Mevcut Tasarımı Özel Şablon Kaydet</span>
                </button>
              )}
            </div>
          )}
        </div>

        {/* Mevcut Tasarımı Kaydetme Formu (Accordion) */}
        {mainTab === "custom" && showSaveForm && currentConfig && (
          <form
            onSubmit={handleSaveCurrent}
            className="border-b border-slate-800 bg-slate-900/90 p-4 sm:px-6 space-y-3"
          >
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-bold text-amber-300 flex items-center gap-1.5">
                <Bookmark className="h-4 w-4" />
                Mevcut Çalışmayı Kütüphaneye Kaydet
              </h3>
              <button
                type="button"
                onClick={() => setShowSaveForm(false)}
                className="text-slate-400 hover:text-slate-200 text-xs"
              >
                ✕ İptal
              </button>
            </div>

            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              <div>
                <label className="block text-[11px] text-slate-400 mb-1">Şablon Başlığı</label>
                <input
                  type="text"
                  required
                  value={saveTitle}
                  onChange={(e) => setSaveTitle(e.target.value)}
                  placeholder={currentConfig.name || "Örn: Salon Meşe Kitaplık"}
                  className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-1.5 text-xs text-slate-100"
                />
              </div>

              <div>
                <label className="block text-[11px] text-slate-400 mb-1">Etiketler (virgülle ayırın)</label>
                <input
                  type="text"
                  value={saveTagInput}
                  onChange={(e) => setSaveTagInput(e.target.value)}
                  placeholder="Örn: Merdiven Altı, Eğimli, Salon, Meşe"
                  className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-1.5 text-xs text-slate-100"
                />
              </div>
            </div>

            <div>
              <label className="block text-[11px] text-slate-400 mb-1">Kısa Açıklama / Notlar</label>
              <input
                type="text"
                value={saveDesc}
                onChange={(e) => setSaveDesc(e.target.value)}
                placeholder="Örn: Sol dikmesi 120 cm eğimli üst tablalı çatı arası dolabı"
                className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-1.5 text-xs text-slate-100"
              />
            </div>

            <div className="flex justify-end gap-2 pt-1">
              <button
                type="submit"
                className="rounded-lg bg-amber-600 px-4 py-2 text-xs font-bold text-white shadow hover:bg-amber-500 transition"
              >
                Kütüphaneye Kaydet
              </button>
            </div>
          </form>
        )}

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6">
          {mainTab === "standard" ? (
            /* Standart Şablonlar Grid */
            filteredPresets.length === 0 ? (
              <div className="flex h-64 flex-col items-center justify-center rounded-2xl border border-dashed border-slate-800 text-center text-slate-400">
                <Filter className="mb-2 h-8 w-8 text-slate-600" />
                <p className="text-sm font-semibold">Eşleşen şablon bulunamadı.</p>
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
            )
          ) : (
            /* Özel Tasarımlarım Grid */
            filteredCustomPresets.length === 0 ? (
              <div className="flex h-64 flex-col items-center justify-center rounded-2xl border border-dashed border-slate-800 text-center text-slate-400">
                <Star className="mb-2 h-8 w-8 text-amber-500/40" />
                <p className="text-sm font-semibold">Henüz özel tasarım kaydedilmedi.</p>
                <p className="mt-1 text-xs text-slate-500">
                  Tasarladığınız dolapları &quot;Mevcut Tasarımı Özel Şablon Kaydet&quot; butonuna basarak kütüphanenize ekleyebilirsiniz.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-3.5 md:grid-cols-2">
                {filteredCustomPresets.map((preset) => (
                  <div
                    key={preset.id}
                    className="flex flex-col justify-between rounded-xl border border-amber-500/20 bg-slate-900/80 p-4 text-slate-200 shadow-md hover:border-amber-500/40 transition"
                  >
                    <div>
                      <div className="flex items-center justify-between gap-1.5">
                        <span className="rounded bg-amber-500/20 border border-amber-500/30 px-2 py-0.5 text-[10px] font-bold text-amber-300">
                          ÖZEL TASARIM
                        </span>
                        <span className="font-mono text-xs font-bold text-emerald-400">
                          {preset.config.width_mm} × {preset.config.height_mm} × {preset.config.depth_mm} mm
                        </span>
                      </div>

                      <h3 className="mt-2 text-sm font-bold text-slate-100 flex items-center gap-1.5">
                        <Star className="h-4 w-4 text-amber-400 fill-amber-400/20" />
                        {preset.title}
                      </h3>
                      <p className="mt-1 text-xs text-slate-400 line-clamp-2 leading-relaxed">
                        {preset.description}
                      </p>

                      {preset.tags && preset.tags.length > 0 && (
                        <div className="mt-2.5 flex flex-wrap gap-1">
                          {preset.tags.map((tag, tIdx) => (
                            <span
                              key={tIdx}
                              className="rounded-md border border-slate-800 bg-slate-950 px-2 py-0.5 text-[10px] text-slate-300"
                            >
                              #{tag}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>

                    <div className="mt-4 flex items-center gap-2 border-t border-slate-800/80 pt-3">
                      <button
                        type="button"
                        onClick={() => {
                          if (onSelectCustomConfig) {
                            onSelectCustomConfig(preset.config);
                          } else {
                            onSelectPreset({
                              id: preset.id,
                              categoryId: "living",
                              category: "Özel Tasarım",
                              title: preset.title,
                              subtitle: preset.description,
                              highlights: preset.tags || [],
                              prompt: `Özel tasarım: ${preset.title}`,
                              config: preset.config,
                              totalWidthMm: preset.config.width_mm,
                            });
                          }
                          onClose();
                        }}
                        className="flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-amber-600/90 py-2 text-xs font-bold text-white hover:bg-amber-500 transition shadow"
                      >
                        <ArrowRight className="h-3.5 w-3.5" />
                        3D &amp; Üretime Yükle
                      </button>

                      <button
                        type="button"
                        onClick={() => exportSinglePresetAsJsonFile(preset)}
                        title="JSON olarak indir"
                        className="rounded-lg border border-slate-700 bg-slate-800 p-2 text-slate-300 hover:text-white transition"
                      >
                        <FileJson className="h-4 w-4" />
                      </button>

                      <button
                        type="button"
                        onClick={() => handleDeletePreset(preset.id)}
                        title="Şablonu sil"
                        className="rounded-lg border border-rose-900/40 bg-rose-950/20 p-2 text-rose-400 hover:bg-rose-950/50 transition"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )
          )}
        </div>

        {/* Drawer Footer */}
        <div className="flex items-center justify-between border-t border-slate-800 bg-slate-900/90 px-6 py-3 text-xs text-slate-400">
          <span>
            {mainTab === "standard"
              ? `Standart Şablon: ${filteredPresets.length} / ${ROOM_LINE_PRESETS.length}`
              : `Özel Şablon: ${filteredCustomPresets.length} adet`}
          </span>
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
