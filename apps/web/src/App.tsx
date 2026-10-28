import { useEffect, useState } from "react";
import {
  Archive,
  Box,
  Cpu,
  FileSpreadsheet,
  LayoutGrid,
  Loader2,
  Plus,
  Scissors,
  Sliders,
  Sparkles,
  Trash2,
} from "lucide-react";
import { BomTableView } from "./components/BomTableView";
import { CabinetViewer3D } from "./components/CabinetViewer3D";
import { NestingView } from "./components/NestingView";
import {
  generateProductionPackage,
  parseNaturalLanguagePrompt,
} from "./services/api";
import { ROOM_LINE_PRESETS } from "./services/clientEngine";
import type {
  BackPanelType,
  CabinetConfig,
  CabinetType,
  DoorType,
  ProductionPackageResponse,
  RoomLinePreset,
  SheetSizeOption,
} from "./types/cabinet";

const DEFAULT_CONFIG: CabinetConfig = {
  name: "210x90x58 Çift Kapaklı Gardırop",
  cabinet_type: "wardrobe",
  width_mm: 900,
  height_mm: 2100,
  depth_mm: 580,
  shelf_count: 4,
  door_type: "double",
  drawer_count: 0,
  drawer_front_height_mm: 180,
  has_plinth: true,
  plinth_height_mm: 80,
  body_material: "18mm Beyaz Suntalam",
  body_color_hex: "#F4F1EA",
  door_color_hex: "#C89F70",
  front_pvc_thickness_mm: 2.0,
  hidden_pvc_thickness_mm: 0.4,
  back_panel_type: "grooved_8mm",
  sheet_size: "2800x2100",
  additional_modules: [],
};

const EXAMPLE_PROMPTS: readonly string[] = [
  "90 cm genişliğinde, 85 cm yüksekliğinde, 48 cm derinliğinde, 4 çekmeceli, kapaksız meşe yatak odası şifonyeri",
  "210 cm yüksekliğinde, 90 cm genişliğinde, 58 cm derinliğinde, 3 raflı, 2 çekmeceli, çift kapaklı gardırop",
  "100 cm genişliğinde, 82 cm yüksekliğinde, 55 cm derinliğinde, 2 çekmeceli, çift kapaklı banyo lavabo alt dolabı",
  "180 cm genişliğinde, 48 cm yüksekliğinde, 42 cm derinliğinde, 3 çekmeceli, çift kapaklı ceviz TV konsolu",
];

type ActiveTab = "3d_and_bom" | "nesting" | "bom_only";

export function App() {
  const [prompt, setPrompt] = useState<string>(EXAMPLE_PROMPTS[0]);
  const [config, setConfig] = useState<CabinetConfig>(DEFAULT_CONFIG);
  const [activeModuleIndex, setActiveModuleIndex] = useState<number>(0);
  const [activePresetId, setActivePresetId] = useState<string | null>(null);
  const [pkg, setPkg] = useState<ProductionPackageResponse | null>(null);
  const [selectedPartId, setSelectedPartId] = useState<string | null>("P01");
  const [activeTab, setActiveTab] = useState<ActiveTab>("3d_and_bom");
  const [isParsing, setIsParsing] = useState<boolean>(false);
  const [isGenerating, setIsGenerating] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const allModules: CabinetConfig[] = [
    config,
    ...(config.additional_modules ?? []),
  ];
  const safeModuleIndex =
    activeModuleIndex < allModules.length ? activeModuleIndex : 0;
  const activeModule: CabinetConfig = allModules[safeModuleIndex];

  const updateActiveModule = (patch: Partial<CabinetConfig>) => {
    if (safeModuleIndex === 0) {
      setConfig((prev) => ({
        ...prev,
        ...patch,
      }));
    } else {
      setConfig((prev) => {
        const extras = [...(prev.additional_modules ?? [])];
        const targetIdx = safeModuleIndex - 1;
        if (extras[targetIdx]) {
          extras[targetIdx] = {
            ...extras[targetIdx],
            ...patch,
          };
        }
        return {
          ...prev,
          additional_modules: extras,
        };
      });
    }
  };

  const handleAddSideModule = () => {
    const nextIdx = (config.additional_modules?.length ?? 0) + 2;
    const clonedModule: CabinetConfig = {
      ...activeModule,
      name: `Ek Modül #${nextIdx}`,
      additional_modules: [],
    };
    const nextConfig: CabinetConfig = {
      ...config,
      additional_modules: [...(config.additional_modules ?? []), clonedModule],
    };
    setConfig(nextConfig);
    setActiveModuleIndex((config.additional_modules?.length ?? 0) + 1);
    void runGeneration(nextConfig);
  };

  const handleRemoveModule = (idxToRemove: number) => {
    if (idxToRemove === 0) return;
    const extras = (config.additional_modules ?? []).filter(
      (_, i) => i !== idxToRemove - 1
    );
    const nextConfig: CabinetConfig = {
      ...config,
      additional_modules: extras,
    };
    setConfig(nextConfig);
    setActiveModuleIndex(0);
    void runGeneration(nextConfig);
  };

  const handleSelectRoomPreset = (preset: RoomLinePreset) => {
    const clonedPrimary: CabinetConfig = JSON.parse(
      JSON.stringify(preset.config)
    ) as CabinetConfig;
    setActivePresetId(preset.id);
    setActiveModuleIndex(0);
    setConfig(clonedPrimary);
    void runGeneration(clonedPrimary);
  };

  const runGeneration = async (targetConfig: CabinetConfig) => {
    setIsGenerating(true);
    setErrorMsg(null);
    try {
      const result = await generateProductionPackage(targetConfig);
      setPkg(result);
      if (result.bom.parts.length > 0) {
        setSelectedPartId(result.bom.parts[0].part_id);
      }
    } catch (err) {
      const msg =
        err instanceof Error ? err.message : "Bilinmeyen üretim hatası.";
      setErrorMsg(msg);
    } finally {
      setIsGenerating(false);
    }
  };

  useEffect(() => {
    void runGeneration(DEFAULT_CONFIG);
  }, []);

  const handleParseAndGenerate = async (promptText: string) => {
    if (!promptText.trim()) return;
    setIsParsing(true);
    setErrorMsg(null);
    setActivePresetId(null);
    setActiveModuleIndex(0);
    try {
      const parsedConfig = await parseNaturalLanguagePrompt(promptText);
      setConfig(parsedConfig);
      await runGeneration(parsedConfig);
    } catch (err) {
      const msg =
        err instanceof Error ? err.message : "Doğal dil ayrıştırma hatası.";
      setErrorMsg(msg);
    } finally {
      setIsParsing(false);
    }
  };

  const handleFormSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    void runGeneration(config);
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      {/* Üst Mühendislik Başlığı */}
      <header className="sticky top-0 z-30 border-b border-slate-800/90 bg-slate-950/90 backdrop-blur">
        <div className="mx-auto flex max-w-[1600px] flex-wrap items-center justify-between gap-3 px-4 py-3 sm:px-6">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-sky-500 to-indigo-600 shadow-lg shadow-sky-500/20">
              <Cpu className="h-5 w-5 text-white" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-base font-bold tracking-tight text-white sm:text-lg">
                  MARANGOZ CAD/CAM
                </h1>
                <span className="rounded-full border border-sky-500/30 bg-sky-500/10 px-2 py-0.5 text-[11px] font-semibold text-sky-400">
                  Deterministik Çekirdek v0.2
                </span>
              </div>
              <p className="text-xs text-slate-400">
                Çoklu Modül Oda Hatları, Çekmece Kutu Mühendisliği, CNC Post-Processor
                (DXF / G-Code .NC / WoodWOP .MPR) ve Giyotin Nesting
              </p>
            </div>
          </div>

          {pkg && (
            <div className="flex items-center gap-2.5">
              <div className="hidden text-right text-xs sm:block">
                <span className="text-slate-400">Aktif İş Kimliği: </span>
                <code className="font-mono font-semibold text-sky-400">
                  #{pkg.job_id}
                </code>
              </div>
              <a
                href={pkg.zip_download_url}
                download={`marangoz_uretim_paketi_${pkg.job_id}.zip`}
                className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2 text-xs font-bold text-white shadow-lg shadow-emerald-600/25 transition hover:bg-emerald-500"
              >
                <Archive className="h-4 w-4" />
                Üretim Paketini İndir (.ZIP — GLB + DXF + NC + MPR + SVG + CSV)
              </a>
            </div>
          )}
        </div>
      </header>

      <main className="mx-auto max-w-[1600px] space-y-5 px-4 py-5 sm:px-6">
        {/* Doğal Dil İstem Çubuğu (Semantic Parser) */}
        <section className="rounded-2xl border border-slate-800 bg-slate-900/70 p-4 shadow-lg">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
            <div className="flex-1">
              <label
                htmlFor="nl-prompt-input"
                className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-sky-400"
              >
                <Sparkles className="h-3.5 w-3.5" />
                Doğal Dil Mobilya İstemi (Semantic Parser → CabinetConfig JSON)
              </label>
              <div className="flex flex-col gap-2 sm:flex-row">
                <input
                  id="nl-prompt-input"
                  type="text"
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                  placeholder="Örn: 90 cm genişliğinde, 85 cm yüksekliğinde, 48 cm derinliğinde, 4 çekmeceli şifonyer..."
                  className="flex-1 rounded-xl border border-slate-700 bg-slate-950 px-3.5 py-2.5 text-sm text-slate-100 placeholder-slate-500 focus:border-sky-500 focus:outline-none"
                />
                <button
                  type="button"
                  disabled={isParsing || isGenerating}
                  onClick={() => void handleParseAndGenerate(prompt)}
                  className="inline-flex items-center justify-center gap-2 rounded-xl bg-sky-600 px-5 py-2.5 text-xs font-bold text-white shadow-md shadow-sky-600/20 transition hover:bg-sky-500 disabled:opacity-50"
                >
                  {isParsing || isGenerating ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Sparkles className="h-4 w-4" />
                  )}
                  Ayrıştır &amp; Üret
                </button>
              </div>
            </div>
          </div>

          {/* Hazır Fabrika Senaryoları */}
          <div className="mt-3 flex flex-wrap items-center gap-1.5">
            <span className="text-[11px] font-medium text-slate-400">
              Örnek İstemler:
            </span>
            {EXAMPLE_PROMPTS.map((sample, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => {
                  setPrompt(sample);
                  void handleParseAndGenerate(sample);
                }}
                className="rounded-lg border border-slate-800 bg-slate-950/80 px-2.5 py-1 text-[11px] text-slate-300 transition hover:border-sky-500/50 hover:text-sky-300"
              >
                {sample.slice(0, 65)}...
              </button>
            ))}
          </div>
        </section>

        {/* Çoklu Modül Oda & Kategori Hatları (6 Farklı Oda/Kategori Hattı) */}
        <section className="rounded-2xl border border-slate-800 bg-slate-900/70 p-4 shadow-lg">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <LayoutGrid className="h-4 w-4 text-indigo-400" />
              <h2 className="text-xs font-bold uppercase tracking-wider text-slate-200">
                Çoklu Modül Oda &amp; Kategori Üretim Hatları (Tek Tıkla Tüm Oda
                Nesting &amp; CNC)
              </h2>
            </div>
            <span className="text-[11px] text-slate-400">
              Yan yana dizili modüller ortak plaka optimizasyonuna (Nesting) girer
            </span>
          </div>

          <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
            {ROOM_LINE_PRESETS.map((preset) => {
              const isSelected = activePresetId === preset.id;
              const moduleCount =
                1 + (preset.config.additional_modules?.length ?? 0);
              return (
                <button
                  key={preset.id}
                  type="button"
                  onClick={() => handleSelectRoomPreset(preset)}
                  className={`flex flex-col justify-between rounded-xl border p-3 text-left transition ${
                    isSelected
                      ? "border-indigo-500 bg-indigo-950/50 text-white shadow-md shadow-indigo-500/10"
                      : "border-slate-800 bg-slate-950/70 text-slate-300 hover:border-indigo-500/50 hover:bg-slate-900"
                  }`}
                >
                  <div>
                    <div className="flex items-center justify-between gap-2">
                      <span className="rounded bg-indigo-500/20 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-indigo-300">
                        {preset.category}
                      </span>
                      <span className="font-mono text-[11px] font-semibold text-emerald-400">
                        {moduleCount} Modül · {preset.totalWidthMm} mm
                      </span>
                    </div>
                    <p className="mt-1.5 text-xs font-bold text-slate-100">
                      {preset.title}
                    </p>
                    <p className="mt-0.5 text-[11px] text-slate-400">
                      {preset.subtitle}
                    </p>
                  </div>
                </button>
              );
            })}
          </div>
        </section>

        {errorMsg && (
          <div
            role="alert"
            className="rounded-xl border border-red-500/40 bg-red-950/50 px-4 py-3 text-xs font-medium text-red-200"
          >
            {errorMsg}
          </div>
        )}

        {/* Ana Çalışma Alanı: Sol Parametrik Kontrol Paneli + Sağ Mühendislik Çıktıları */}
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-12">
          {/* Sol Sütun: Parametrik Mühendislik Kontrolleri */}
          <aside className="lg:col-span-4 xl:col-span-3">
            <form
              onSubmit={handleFormSubmit}
              className="space-y-4 rounded-2xl border border-slate-800 bg-slate-900/80 p-4"
            >
              <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                <h2 className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-200">
                  <Sliders className="h-4 w-4 text-sky-400" />
                  Parametrik Ölçü &amp; Kural Girişi
                </h2>
                <span className="text-[11px] text-slate-400">18mm Gövde</span>
              </div>

              {/* Çoklu Modül Seçici ve Yanına Modül Ekleme */}
              <div className="rounded-xl border border-slate-800 bg-slate-950/80 p-2.5">
                <div className="mb-2 flex items-center justify-between">
                  <span className="text-[11px] font-semibold text-slate-300">
                    Hattaki Modüller ({allModules.length} Adet)
                  </span>
                  <button
                    type="button"
                    onClick={handleAddSideModule}
                    className="inline-flex items-center gap-1 rounded-lg bg-indigo-600/90 px-2 py-1 text-[11px] font-semibold text-white transition hover:bg-indigo-500"
                  >
                    <Plus className="h-3 w-3" />
                    Yanına Modül Ekle
                  </button>
                </div>

                <div className="flex flex-wrap gap-1.5">
                  {allModules.map((mod, idx) => {
                    const isCurrent = idx === safeModuleIndex;
                    return (
                      <div
                        key={idx}
                        className={`inline-flex items-center gap-1 rounded-lg border px-2 py-1 text-[11px] font-medium transition ${
                          isCurrent
                            ? "border-sky-500 bg-sky-500/20 text-sky-200"
                            : "border-slate-800 bg-slate-900 text-slate-400 hover:text-slate-200"
                        }`}
                      >
                        <button
                          type="button"
                          onClick={() => setActiveModuleIndex(idx)}
                          className="text-left"
                        >
                          M{idx + 1}: {mod.width_mm}mm
                        </button>
                        {idx > 0 && (
                          <button
                            type="button"
                            onClick={() => handleRemoveModule(idx)}
                            title="Modülü Hattan Sil"
                            className="ml-1 text-slate-400 hover:text-red-400"
                          >
                            <Trash2 className="h-3 w-3" />
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Modül Tipi */}
              <div>
                <label
                  htmlFor="cabinet-type"
                  className="mb-1 block text-xs font-medium text-slate-300"
                >
                  Modül Tipi (M{safeModuleIndex + 1})
                </label>
                <select
                  id="cabinet-type"
                  value={activeModule.cabinet_type}
                  onChange={(e) =>
                    updateActiveModule({
                      cabinet_type: e.target.value as CabinetType,
                    })
                  }
                  className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-xs text-slate-100"
                >
                  <option value="wardrobe">Gardırop / Yüklük</option>
                  <option value="kitchen_base">Mutfak Alt Modül</option>
                  <option value="kitchen_wall">Mutfak Üst Modül</option>
                  <option value="kitchen_tall">Mutfak Boy / Ankastre Kule</option>
                  <option value="bathroom_vanity">Banyo Lavabo Alt Modül</option>
                  <option value="bathroom_tall">Banyo Boy Dolabı</option>
                  <option value="dresser">Şifonyer / Komodin</option>
                  <option value="shoe_cabinet">Ayakkabılık / Portmanto</option>
                  <option value="tv_unit">TV Ünitesi / Medya Konsolu</option>
                  <option value="bookshelf">Kitaplık / Açık Raf</option>
                </select>
              </div>

              {/* Dış Ölçüler: Genişlik, Yükseklik, Derinlik */}
              <div className="grid grid-cols-3 gap-2.5">
                <div>
                  <label
                    htmlFor="width-mm"
                    className="block text-xs font-medium text-slate-300"
                  >
                    Genişlik (W)
                  </label>
                  <span id="width-hint" className="field-hint">
                    300–2700 mm
                  </span>
                  <input
                    id="width-mm"
                    type="number"
                    required
                    min={300}
                    max={2700}
                    aria-describedby="width-hint"
                    value={activeModule.width_mm}
                    onChange={(e) =>
                      updateActiveModule({
                        width_mm: Number(e.target.value),
                      })
                    }
                    className="param-input w-full rounded-lg border border-slate-700 bg-slate-950 px-2.5 py-1.5 font-mono text-xs text-slate-100"
                  />
                  <div className="error-msg">300–2700 mm arası giriniz.</div>
                </div>

                <div>
                  <label
                    htmlFor="height-mm"
                    className="block text-xs font-medium text-slate-300"
                  >
                    Yükseklik (H)
                  </label>
                  <span id="height-hint" className="field-hint">
                    300–2750 mm
                  </span>
                  <input
                    id="height-mm"
                    type="number"
                    required
                    min={300}
                    max={2750}
                    aria-describedby="height-hint"
                    value={activeModule.height_mm}
                    onChange={(e) =>
                      updateActiveModule({
                        height_mm: Number(e.target.value),
                      })
                    }
                    className="param-input w-full rounded-lg border border-slate-700 bg-slate-950 px-2.5 py-1.5 font-mono text-xs text-slate-100"
                  />
                  <div className="error-msg">300–2750 mm arası giriniz.</div>
                </div>

                <div>
                  <label
                    htmlFor="depth-mm"
                    className="block text-xs font-medium text-slate-300"
                  >
                    Derinlik (D)
                  </label>
                  <span id="depth-hint" className="field-hint">
                    200–900 mm
                  </span>
                  <input
                    id="depth-mm"
                    type="number"
                    required
                    min={200}
                    max={900}
                    aria-describedby="depth-hint"
                    value={activeModule.depth_mm}
                    onChange={(e) =>
                      updateActiveModule({
                        depth_mm: Number(e.target.value),
                      })
                    }
                    className="param-input w-full rounded-lg border border-slate-700 bg-slate-950 px-2.5 py-1.5 font-mono text-xs text-slate-100"
                  />
                  <div className="error-msg">200–900 mm arası giriniz.</div>
                </div>
              </div>

              {/* Raf Adedi ve Kapak Tipi */}
              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label
                    htmlFor="shelf-count"
                    className="block text-xs font-medium text-slate-300"
                  >
                    Hareketli Raf
                  </label>
                  <span id="shelf-hint" className="field-hint">
                    0–12 Adet
                  </span>
                  <input
                    id="shelf-count"
                    type="number"
                    required
                    min={0}
                    max={12}
                    aria-describedby="shelf-hint"
                    value={activeModule.shelf_count}
                    onChange={(e) =>
                      updateActiveModule({
                        shelf_count: Number(e.target.value),
                      })
                    }
                    className="param-input w-full rounded-lg border border-slate-700 bg-slate-950 px-2.5 py-1.5 font-mono text-xs text-slate-100"
                  />
                  <div className="error-msg">0–12 arası raf giriniz.</div>
                </div>

                <div>
                  <label
                    htmlFor="door-type"
                    className="block text-xs font-medium text-slate-300"
                  >
                    Kapak Konfigürasyonu
                  </label>
                  <span className="field-hint">Menteşe Ø35mm</span>
                  <select
                    id="door-type"
                    value={activeModule.door_type}
                    onChange={(e) =>
                      updateActiveModule({
                        door_type: e.target.value as DoorType,
                      })
                    }
                    className="w-full rounded-lg border border-slate-700 bg-slate-950 px-2.5 py-1.5 text-xs text-slate-100"
                  >
                    <option value="double">Çift Kapak</option>
                    <option value="single_left">Tek Kapak (Sol Menteşe)</option>
                    <option value="single_right">Tek Kapak (Sağ Menteşe)</option>
                    <option value="none">Kapaksız (Açık)</option>
                  </select>
                </div>
              </div>

              {/* Çekmece Adedi ve Klapa Yüksekliği */}
              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label
                    htmlFor="drawer-count"
                    className="block text-xs font-medium text-slate-300"
                  >
                    Çekmece Adedi
                  </label>
                  <span id="drawer-count-hint" className="field-hint">
                    0–6 Adet (Ray Boşluğu 26mm)
                  </span>
                  <input
                    id="drawer-count"
                    type="number"
                    required
                    min={0}
                    max={6}
                    aria-describedby="drawer-count-hint"
                    value={activeModule.drawer_count ?? 0}
                    onChange={(e) =>
                      updateActiveModule({
                        drawer_count: Number(e.target.value),
                      })
                    }
                    className="param-input w-full rounded-lg border border-slate-700 bg-slate-950 px-2.5 py-1.5 font-mono text-xs text-slate-100"
                  />
                  <div className="error-msg">0–6 arası çekmece giriniz.</div>
                </div>

                <div>
                  <label
                    htmlFor="drawer-height"
                    className="block text-xs font-medium text-slate-300"
                  >
                    Klapa Yüksekliği
                  </label>
                  <span id="drawer-height-hint" className="field-hint">
                    120–350 mm
                  </span>
                  <input
                    id="drawer-height"
                    type="number"
                    required
                    min={120}
                    max={350}
                    aria-describedby="drawer-height-hint"
                    value={activeModule.drawer_front_height_mm ?? 180}
                    onChange={(e) =>
                      updateActiveModule({
                        drawer_front_height_mm: Number(e.target.value),
                      })
                    }
                    className="param-input w-full rounded-lg border border-slate-700 bg-slate-950 px-2.5 py-1.5 font-mono text-xs text-slate-100"
                  />
                  <div className="error-msg">120–350 mm arası giriniz.</div>
                </div>
              </div>

              {/* Ön PVC Kalınlığı ve Arkalık Tipi */}
              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label
                    htmlFor="front-pvc"
                    className="mb-1 block text-xs font-medium text-slate-300"
                  >
                    Ön Kenar PVC Bandı
                  </label>
                  <select
                    id="front-pvc"
                    value={activeModule.front_pvc_thickness_mm}
                    onChange={(e) =>
                      updateActiveModule({
                        front_pvc_thickness_mm: Number(e.target.value),
                      })
                    }
                    className="w-full rounded-lg border border-slate-700 bg-slate-950 px-2.5 py-2 text-xs text-slate-100"
                  >
                    <option value={2.0}>2.0 mm PVC (Kesimden Düşülür)</option>
                    <option value={1.0}>1.0 mm PVC (Kesimden Düşülür)</option>
                    <option value={0.4}>0.4 mm PVC (İhmal Edilir)</option>
                  </select>
                </div>

                <div>
                  <label
                    htmlFor="back-panel-type"
                    className="mb-1 block text-xs font-medium text-slate-300"
                  >
                    Arkalık Sistemi
                  </label>
                  <select
                    id="back-panel-type"
                    value={activeModule.back_panel_type}
                    onChange={(e) =>
                      updateActiveModule({
                        back_panel_type: e.target.value as BackPanelType,
                      })
                    }
                    className="w-full rounded-lg border border-slate-700 bg-slate-950 px-2.5 py-2 text-xs text-slate-100"
                  >
                    <option value="grooved_8mm">8 mm MDF-Lam (Kanal İçi)</option>
                    <option value="nailed_3mm">3 mm Duralit (Arkadan Çakma)</option>
                  </select>
                </div>
              </div>

              {/* Baza ve Standart Plaka Ebadı */}
              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label className="mb-1 flex items-center gap-2 text-xs font-medium text-slate-300">
                    <input
                      type="checkbox"
                      checked={activeModule.has_plinth}
                      onChange={(e) =>
                        updateActiveModule({
                          has_plinth: e.target.checked,
                          plinth_height_mm: e.target.checked ? 80 : 0,
                        })
                      }
                      className="rounded border-slate-700 bg-slate-950 text-sky-500"
                    />
                    Alt Baza ({activeModule.plinth_height_mm} mm)
                  </label>
                  {activeModule.has_plinth && (
                    <input
                      type="number"
                      min={50}
                      max={200}
                      value={activeModule.plinth_height_mm}
                      onChange={(e) =>
                        updateActiveModule({
                          plinth_height_mm: Number(e.target.value),
                        })
                      }
                      className="param-input w-full rounded-lg border border-slate-700 bg-slate-950 px-2.5 py-1.5 font-mono text-xs text-slate-100"
                    />
                  )}
                </div>

                <div>
                  <label
                    htmlFor="sheet-size"
                    className="mb-1 block text-xs font-medium text-slate-300"
                  >
                    Standart Plaka Ebadı
                  </label>
                  <select
                    id="sheet-size"
                    value={config.sheet_size}
                    onChange={(e) =>
                      setConfig({
                        ...config,
                        sheet_size: e.target.value as SheetSizeOption,
                      })
                    }
                    className="w-full rounded-lg border border-slate-700 bg-slate-950 px-2.5 py-1.5 text-xs text-slate-100"
                  >
                    <option value="2800x2100">2800 × 2100 mm (Standart)</option>
                    <option value="3660x1830">3660 × 1830 mm (Jumbo)</option>
                  </select>
                </div>
              </div>

              {/* Gövde ve Kapak Renk Seçicileri */}
              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label
                    htmlFor="body-color"
                    className="mb-1 block text-xs font-medium text-slate-300"
                  >
                    Gövde Rengi
                  </label>
                  <div className="flex items-center gap-2">
                    <input
                      id="body-color"
                      type="color"
                      value={activeModule.body_color_hex}
                      onChange={(e) =>
                        updateActiveModule({ body_color_hex: e.target.value })
                      }
                      className="h-8 w-10 cursor-pointer rounded border border-slate-700 bg-slate-950"
                    />
                    <span className="font-mono text-xs text-slate-400">
                      {activeModule.body_color_hex}
                    </span>
                  </div>
                </div>

                <div>
                  <label
                    htmlFor="door-color"
                    className="mb-1 block text-xs font-medium text-slate-300"
                  >
                    Kapak / Klapa Rengi
                  </label>
                  <div className="flex items-center gap-2">
                    <input
                      id="door-color"
                      type="color"
                      value={activeModule.door_color_hex}
                      onChange={(e) =>
                        updateActiveModule({ door_color_hex: e.target.value })
                      }
                      className="h-8 w-10 cursor-pointer rounded border border-slate-700 bg-slate-950"
                    />
                    <span className="font-mono text-xs text-slate-400">
                      {activeModule.door_color_hex}
                    </span>
                  </div>
                </div>
              </div>

              <button
                type="submit"
                disabled={isGenerating}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-sky-600 to-indigo-600 px-4 py-2.5 text-xs font-bold text-white shadow-lg shadow-sky-600/20 transition hover:from-sky-500 hover:to-indigo-500 disabled:opacity-50"
              >
                {isGenerating ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Cpu className="h-4 w-4" />
                )}
                Hesapla &amp; CAD / CNC / Nesting Üret
              </button>
            </form>
          </aside>

          {/* Sağ Sütun: 3D Görüntüleyici, BOM Tablosu, CNC DXF ve Nesting Şeması */}
          <section className="space-y-4 lg:col-span-8 xl:col-span-9">
            {/* Görünüm Sekmeleri */}
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800 pb-3">
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => setActiveTab("3d_and_bom")}
                  className={`flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-bold transition ${
                    activeTab === "3d_and_bom"
                      ? "bg-sky-600 text-white shadow-md shadow-sky-600/20"
                      : "bg-slate-900 text-slate-400 hover:bg-slate-800 hover:text-slate-200"
                  }`}
                >
                  <Box className="h-4 w-4" />
                  3D Önizleme + Kesim &amp; CNC Post-Processor
                </button>

                <button
                  type="button"
                  onClick={() => setActiveTab("nesting")}
                  className={`flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-bold transition ${
                    activeTab === "nesting"
                      ? "bg-sky-600 text-white shadow-md shadow-sky-600/20"
                      : "bg-slate-900 text-slate-400 hover:bg-slate-800 hover:text-slate-200"
                  }`}
                >
                  <Scissors className="h-4 w-4" />
                  Plaka Kesim Optimizasyonu (Nesting SVG)
                </button>

                <button
                  type="button"
                  onClick={() => setActiveTab("bom_only")}
                  className={`flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-bold transition ${
                    activeTab === "bom_only"
                      ? "bg-sky-600 text-white shadow-md shadow-sky-600/20"
                      : "bg-slate-900 text-slate-400 hover:bg-slate-800 hover:text-slate-200"
                  }`}
                >
                  <FileSpreadsheet className="h-4 w-4" />
                  Detaylı BOM &amp; CNC Delik Planı
                </button>
              </div>
            </div>

            {pkg ? (
              <>
                {activeTab === "3d_and_bom" && (
                  <div className="space-y-5">
                    <CabinetViewer3D
                      bom={pkg.bom}
                      glbBase64={pkg.glb_base64}
                      selectedPartId={selectedPartId}
                      onSelectPart={(id) => setSelectedPartId(id)}
                    />
                    <BomTableView
                      jobId={pkg.job_id}
                      bom={pkg.bom}
                      selectedPartId={selectedPartId}
                      onSelectPart={(id) => setSelectedPartId(id)}
                    />
                  </div>
                )}

                {activeTab === "nesting" && (
                  <NestingView nesting={pkg.nesting} />
                )}

                {activeTab === "bom_only" && (
                  <BomTableView
                    jobId={pkg.job_id}
                    bom={pkg.bom}
                    selectedPartId={selectedPartId}
                    onSelectPart={(id) => setSelectedPartId(id)}
                  />
                )}
              </>
            ) : (
              <div className="flex h-96 items-center justify-center rounded-2xl border border-slate-800 bg-slate-900/50 text-sm text-slate-400">
                <Loader2 className="mr-2 h-5 w-5 animate-spin text-sky-400" />
                Mühendislik motorları çalıştırılıyor...
              </div>
            )}
          </section>
        </div>
      </main>
    </div>
  );
}
export default App;
