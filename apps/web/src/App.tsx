import { useEffect, useRef, useState } from "react";
import {
  Archive,
  Box,
  Calculator,
  Camera,
  Check,
  Cpu,
  FileSpreadsheet,
  Image as ImageIcon,
  LayoutGrid,
  Loader2,
  Plus,
  QrCode,
  Scan,
  Scissors,
  Sliders,
  Sparkles,
  Trash2,
  UploadCloud,
  X,
} from "lucide-react";
import { BomTableView } from "./components/BomTableView";
import { CabinetViewer3D } from "./components/CabinetViewer3D";
import { CostQuoteView } from "./components/CostQuoteView";
import { NestingView } from "./components/NestingView";
import { PartLabelsView } from "./components/PartLabelsView";
import { WorkshopScannerView } from "./components/WorkshopScannerView";
import {
  generateProductionPackage,
  parseNaturalLanguagePrompt,
  parseSketchImage,
  type ParseResult,
} from "./services/api";
import { CATALOG_CATEGORIES, ROOM_LINE_PRESETS } from "./services/clientEngine";
import {
  getStoredGeminiApiKey,
  setStoredGeminiApiKey,
} from "./services/geminiClient";
import type {
  BackPanelType,
  CabinetConfig,
  CabinetType,
  CatalogCategoryId,
  CuttingMode,
  DoorType,
  FastenerType,
  PlinthType,
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
  plinth_type: "wood_plinth",
  fastener_type: "minifix_dowel",
  cutting_mode: "panel_saw",
  router_bit_diameter_mm: 10,
  left_filler_width_mm: 0,
  right_filler_width_mm: 0,
  has_baseboard_notch: false,
  baseboard_notch_height_mm: 80,
  baseboard_notch_depth_mm: 15,
  has_column_notch: false,
  column_notch_width_mm: 120,
  column_notch_depth_mm: 120,
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
  "Mutfakta solo buzdolabımızın etrafını saracak bir buzdolabı çevreleme (gömme) dolap modülü tasarlamak istiyorum. Dolabın toplam dış ölçüleri: Yükseklik 235 cm, genişlik 85 cm, derinlik 65 cm olsun. Alt kısımda buzdolabının rahat oturması ve hava sirkülasyonu için net 80 cm genişliğinde ve 185 cm yüksekliğinde açık bir niş (boşluk) bırakılsın; buzdolabının arkasına arkalık konmasın, açık kalsın. Buzdolabının üstünde kalan boşluğa ise yukarı doğru açılan (gazlı pistonlu) tek parça kalkar kapaklı derin bir üst depolama dolabı yerleştirilsin. Yan dikmeler tavandan tabana kadar yekpare 18 mm gövde malzemesi olarak insin. Gövde 18 mm beyaz suntalam, üst kapak 18 mm meşe desen MDF-Lam olsun. Üst dolabın arkalığı 8 mm kanala geçme yapılsın. Birleşimler minifix ve kavela ile System 32 standardında delinsin.",
  "90 cm genişliğinde, 85 cm yüksekliğinde, 48 cm derinliğinde, 4 çekmeceli, kapaksız meşe yatak odası şifonyeri",
  "210 cm yüksekliğinde, 90 cm genişliğinde, 58 cm derinliğinde, 3 raflı, 2 çekmeceli, çift kapaklı gardırop",
  "100 cm genişliğinde, 82 cm yüksekliğinde, 55 cm derinliğinde, 2 çekmeceli, çift kapaklı banyo lavabo alt dolabı",
  "180 cm genişliğinde, 48 cm yüksekliğinde, 42 cm derinliğinde, 3 çekmeceli, çift kapaklı ceviz TV konsolu",
];

const SAMPLE_REFRIGERATOR_SKETCH_SVG = `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 600 700" width="600" height="700"><rect width="100%" height="100%" fill="%23FFFFFF" stroke="%23000" stroke-width="2" /><text x="30" y="45" font-family="monospace" font-size="18" font-weight="bold" fill="%23111">ROLEVE KROKISI - BUZDOLABI CEVRELEME MODULU</text><rect x="120" y="80" width="360" height="560" fill="none" stroke="%23222" stroke-width="4" stroke-dasharray="2,1" /><rect x="130" y="90" width="340" height="110" fill="%23F3F4F6" stroke="%23111" stroke-width="3" /><text x="160" y="150" font-family="monospace" font-size="15" fill="%23333">Ust Kalkar Kapak (Gazli Piston)</text><rect x="130" y="210" width="340" height="420" fill="%23E5E7EB" stroke="%23111" stroke-width="3" /><text x="180" y="430" font-family="monospace" font-size="16" font-weight="bold" fill="%23555">ACIK NIS (Buzdolabi Boslugu)</text><text x="210" y="460" font-family="monospace" font-size="14" fill="%23666">Yukseklik: 1850 mm</text><line x1="80" y1="80" x2="80" y2="640" stroke="%23DC2626" stroke-width="2" /><text x="20" y="370" font-family="monospace" font-size="16" font-weight="bold" fill="%23DC2626">235 cm</text><line x1="120" y1="665" x2="480" y2="665" stroke="%232563EB" stroke-width="2" /><text x="270" y="688" font-family="monospace" font-size="16" font-weight="bold" fill="%232563EB">85 cm</text><text x="360" y="45" font-family="monospace" font-size="14" fill="%23059669">Derinlik: 65 cm</text></svg>`;

const SAMPLE_WARDROBE_SKETCH_SVG = `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 600 700" width="600" height="700"><rect width="100%" height="100%" fill="%23FFFFFF" stroke="%23000" stroke-width="2" /><text x="30" y="45" font-family="monospace" font-size="18" font-weight="bold" fill="%23111">OLCULU ATOLYE CIZIMI - 2 KAPAKLI GARDIROP</text><rect x="140" y="80" width="320" height="550" fill="none" stroke="%23222" stroke-width="4" /><line x1="140" y1="200" x2="460" y2="200" stroke="%23333" stroke-width="3" /><line x1="140" y1="310" x2="460" y2="310" stroke="%23333" stroke-width="3" /><line x1="140" y1="420" x2="460" y2="420" stroke="%23333" stroke-width="3" /><rect x="145" y="430" width="310" height="95" fill="%23F3F4F6" stroke="%23222" stroke-width="2" /><text x="240" y="485" font-family="monospace" font-size="14" fill="%23444">Cekmece 1 (180mm)</text><rect x="145" y="530" width="310" height="95" fill="%23F3F4F6" stroke="%23222" stroke-width="2" /><text x="240" y="585" font-family="monospace" font-size="14" fill="%23444">Cekmece 2 (180mm)</text><rect x="140" y="630" width="320" height="25" fill="%23D1D5DB" stroke="%23222" stroke-width="2" /><text x="270" y="647" font-family="monospace" font-size="11" fill="%23111">Baza 8 cm</text><line x1="90" y1="80" x2="90" y2="655" stroke="%23DC2626" stroke-width="2" /><text x="30" y="380" font-family="monospace" font-size="16" font-weight="bold" fill="%23DC2626">210 cm</text><line x1="140" y1="675" x2="460" y2="675" stroke="%232563EB" stroke-width="2" /><text x="280" y="695" font-family="monospace" font-size="16" font-weight="bold" fill="%232563EB">90 cm</text><text x="360" y="45" font-family="monospace" font-size="14" fill="%23059669">Derinlik: 58 cm</text></svg>`;

type ActiveTab =
  | "3d_and_bom"
  | "nesting"
  | "bom_only"
  | "qr_labels"
  | "cost_quote"
  | "workshop_terminal";

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
  const [apiKey, setApiKey] = useState<string>(() => getStoredGeminiApiKey());
  const [showKeyModal, setShowKeyModal] = useState<boolean>(false);
  const [tempApiKey, setTempApiKey] = useState<string>("");

  // Multimodal Vision / Eskiz Yükleme Modalı State'leri
  const [showSketchModal, setShowSketchModal] = useState<boolean>(false);
  const [sketchBase64, setSketchBase64] = useState<string | null>(null);
  const [sketchMimeType, setSketchMimeType] = useState<string>("image/jpeg");
  const [sketchUserPrompt, setSketchUserPrompt] = useState<string>("");
  const [isParsingSketch, setIsParsingSketch] = useState<boolean>(false);

  const [parseInfo, setParseInfo] = useState<ParseResult | null>(null);
  const [activeCategory, setActiveCategory] = useState<
    CatalogCategoryId | "all"
  >("all");
  const [scopeFilter, setScopeFilter] = useState<"all" | "single" | "multi">(
    "all"
  );
  const [supportsUntilFound] = useState<boolean>(
    () =>
      typeof HTMLElement !== "undefined" &&
      "onbeforematch" in HTMLElement.prototype
  );
  const catalogContainerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const container = catalogContainerRef.current;
    if (!container) return;

    const handleBeforeMatch = (event: Event) => {
      const target = event.target;
      if (!(target instanceof HTMLElement)) return;
      const panel = target.closest<HTMLElement>("[data-category-id]");
      const matchedCategory = panel?.dataset.categoryId as
        | CatalogCategoryId
        | undefined;
      if (matchedCategory) {
        setActiveCategory(matchedCategory);
      }
    };

    container.addEventListener("beforematch", handleBeforeMatch);
    return () => {
      container.removeEventListener("beforematch", handleBeforeMatch);
    };
  }, []);

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
    setPrompt(preset.prompt);
    setConfig(clonedPrimary);
    void runGeneration(clonedPrimary);
  };

  const singleModuleCount = ROOM_LINE_PRESETS.filter(
    (p) => (p.config.additional_modules?.length ?? 0) === 0
  ).length;
  const multiModuleCount = ROOM_LINE_PRESETS.length - singleModuleCount;

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
      const result = await parseNaturalLanguagePrompt(promptText);
      setParseInfo(result);
      setConfig(result.config);
      await runGeneration(result.config);
    } catch (err) {
      const msg =
        err instanceof Error ? err.message : "Doğal dil ayrıştırma hatası.";
      setErrorMsg(msg);
    } finally {
      setIsParsing(false);
    }
  };

  const handleParseSketch = async () => {
    if (!sketchBase64) return;
    setIsParsingSketch(true);
    setErrorMsg(null);
    setActivePresetId(null);
    setActiveModuleIndex(0);
    try {
      const result = await parseSketchImage(
        sketchBase64,
        sketchMimeType,
        sketchUserPrompt
      );
      setParseInfo(result);
      setConfig(result.config);
      setShowSketchModal(false);
      setActiveTab("3d_and_bom");
      await runGeneration(result.config);
    } catch (err) {
      setErrorMsg(
        err instanceof Error
          ? err.message
          : "Eskiz görseli analiz edilirken bir hata oluştu."
      );
    } finally {
      setIsParsingSketch(false);
    }
  };

  const loadPresetSketch = (type: "refrigerator" | "wardrobe") => {
    if (type === "refrigerator") {
      setSketchBase64(SAMPLE_REFRIGERATOR_SKETCH_SVG);
      setSketchMimeType("image/svg+xml");
      setSketchUserPrompt(
        "Buzdolabı çevreleme modülü, alt 185 cm niş, üst kalkar kapak, 235x85x65 cm"
      );
    } else {
      setSketchBase64(SAMPLE_WARDROBE_SKETCH_SVG);
      setSketchMimeType("image/svg+xml");
      setSketchUserPrompt(
        "210 cm yüksekliğinde, 90 cm genişliğinde 2 kapaklı, 3 raflı, 2 çekmeceli gardırop"
      );
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const res = reader.result as string;
      setSketchBase64(res);
      setSketchMimeType(file.type || "image/jpeg");
    };
    reader.readAsDataURL(file);
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

          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={() => {
                setTempApiKey(apiKey);
                setShowKeyModal(true);
              }}
              className="inline-flex items-center gap-1.5 rounded-xl border border-sky-500/30 bg-sky-500/10 px-3 py-2 text-xs font-semibold text-sky-300 transition hover:bg-sky-500/20"
            >
              <Sparkles className="h-3.5 w-3.5 text-sky-400" />
              <span>
                {parseInfo && parseInfo.engine !== "rule_based"
                  ? "Gemini AI Aktif"
                  : apiKey
                  ? "Gemini: Kişisel Anahtar"
                  : "Gemini AI Ayarları"}
              </span>
            </button>

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
                <button
                  type="button"
                  onClick={() => setShowSketchModal(true)}
                  className="inline-flex items-center justify-center gap-2 rounded-xl border border-indigo-500/40 bg-indigo-600/80 px-4 py-2.5 text-xs font-bold text-white shadow-md shadow-indigo-600/20 transition hover:bg-indigo-500"
                >
                  <Camera className="h-4 w-4" />
                  Eskiz / Çizim Yükle
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

          {/* Ayrıştırma Motoru Durumu (hangi motor çalıştı, AI neden devre dışı) */}
          {parseInfo && (
            <div
              role="status"
              className={`mt-3 rounded-xl border px-3 py-2 text-[11px] ${
                parseInfo.engine === "rule_based"
                  ? "border-amber-500/40 bg-amber-950/40 text-amber-200"
                  : "border-emerald-500/40 bg-emerald-950/40 text-emerald-200"
              }`}
            >
              <div className="flex flex-wrap items-center gap-2">
                <Sparkles className="h-3.5 w-3.5" />
                <span className="font-semibold">
                  Ayrıştırma motoru: {parseInfo.engineLabel}
                </span>
                {parseInfo.engine === "rule_based" && (
                  <button
                    type="button"
                    onClick={() => {
                      setTempApiKey(apiKey);
                      setShowKeyModal(true);
                    }}
                    className="rounded-md border border-amber-400/50 px-2 py-0.5 font-semibold hover:bg-amber-500/20"
                  >
                    Yapay zekâyı etkinleştir
                  </button>
                )}
              </div>
              {parseInfo.engine === "rule_based" && parseInfo.aiErrors.length > 0 && (
                <ul className="mt-1 list-disc space-y-0.5 pl-5 text-amber-300/90">
                  {parseInfo.aiErrors.map((e, i) => (
                    <li key={i}>{e}</li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </section>

        {/* Kategorize Mobilya, Cihaz Nişi ve Çoklu Modül Oda Üretim Kataloğu (6 Kategori · 29 Şablon) */}
        <section className="rounded-2xl border border-slate-800 bg-slate-900/70 p-4 shadow-lg">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
            <div>
              <div className="flex items-center gap-2">
                <LayoutGrid className="h-4 w-4 text-indigo-400" />
                <h2 className="text-xs font-bold uppercase tracking-wider text-slate-100 sm:text-sm">
                  Kategorize Mobilya, Cihaz Nişi ve Çoklu Modül Oda Üretim Kataloğu
                  ({CATALOG_CATEGORIES.length} Kategori · {ROOM_LINE_PRESETS.length}{" "}
                  Üretim Şablonu)
                </h2>
              </div>
              <p className="mt-0.5 text-[11px] text-slate-400">
                Bu sitede üretilebilecek tüm tekil modüller, solo cihaz sarmalama
                (buzdolabı / çamaşır makinesi / robot süpürge) nişleri ve çoklu modül
                oda hatları. Tek tıkla 3D, BOM, CNC (DXF / G-Code .NC / WoodWOP .MPR)
                ve ortak plaka Nesting çıktısını yükleyin.
              </p>
            </div>

            {/* Kapsam Filtresi: Tümü / Tekil Modül / Çoklu Modül Oda Hattı */}
            <div className="flex flex-wrap items-center gap-1.5">
              <button
                type="button"
                onClick={() => setScopeFilter("all")}
                className={`rounded-lg border px-2.5 py-1 text-[11px] font-semibold transition ${
                  scopeFilter === "all"
                    ? "border-sky-500 bg-sky-500/20 text-sky-200"
                    : "border-slate-800 bg-slate-950/80 text-slate-400 hover:text-slate-200"
                }`}
              >
                Tümü ({ROOM_LINE_PRESETS.length})
              </button>
              <button
                type="button"
                onClick={() => setScopeFilter("single")}
                className={`rounded-lg border px-2.5 py-1 text-[11px] font-semibold transition ${
                  scopeFilter === "single"
                    ? "border-sky-500 bg-sky-500/20 text-sky-200"
                    : "border-slate-800 bg-slate-950/80 text-slate-400 hover:text-slate-200"
                }`}
              >
                Tekil Modül &amp; Cihaz Nişi ({singleModuleCount})
              </button>
              <button
                type="button"
                onClick={() => setScopeFilter("multi")}
                className={`rounded-lg border px-2.5 py-1 text-[11px] font-semibold transition ${
                  scopeFilter === "multi"
                    ? "border-indigo-500 bg-indigo-500/20 text-indigo-200"
                    : "border-slate-800 bg-slate-950/80 text-slate-400 hover:text-slate-200"
                }`}
              >
                Çoklu Modül Oda Hatları ({multiModuleCount})
              </button>
            </div>
          </div>

          {/* 6 Ana Kategori Sekmesi */}
          <div className="mb-4 flex flex-wrap items-center gap-1.5 border-b border-slate-800/90 pb-3">
            <button
              type="button"
              onClick={() => setActiveCategory("all")}
              className={`rounded-xl border px-3 py-1.5 text-xs font-bold transition ${
                activeCategory === "all"
                  ? "border-indigo-500 bg-indigo-600/25 text-white shadow-sm shadow-indigo-500/20"
                  : "border-slate-800 bg-slate-950/80 text-slate-300 hover:border-indigo-500/40 hover:text-white"
              }`}
            >
              Tüm Kategoriler ({CATALOG_CATEGORIES.length})
            </button>
            {CATALOG_CATEGORIES.map((cat) => {
              const countInCat = ROOM_LINE_PRESETS.filter(
                (p) => p.categoryId === cat.id
              ).length;
              const isCatActive = activeCategory === cat.id;
              const isExpanded = activeCategory === "all" || isCatActive;
              return (
                <button
                  key={cat.id}
                  type="button"
                  aria-expanded={isExpanded}
                  aria-controls={`category-panel-${cat.id}`}
                  onClick={() => setActiveCategory(cat.id)}
                  className={`rounded-xl border px-3 py-1.5 text-xs font-semibold transition ${
                    isCatActive
                      ? "border-indigo-500 bg-indigo-600/25 text-white shadow-sm shadow-indigo-500/20"
                      : "border-slate-800 bg-slate-950/80 text-slate-300 hover:border-indigo-500/40 hover:text-white"
                  }`}
                >
                  <span>{cat.label}</span>
                  <span className="ml-1.5 rounded-full bg-slate-800 px-1.5 py-0.5 font-mono text-[10px] text-sky-300">
                    {countInCat}
                  </span>
                </button>
              );
            })}
          </div>

          {/* Kategorilere Göre Gruplanmış Üretim Şablonları */}
          <div ref={catalogContainerRef} className="space-y-5">
            {CATALOG_CATEGORIES.map((cat) => {
              const presetsForCategory = ROOM_LINE_PRESETS.filter((preset) => {
                if (preset.categoryId !== cat.id) return false;
                const modCount =
                  1 + (preset.config.additional_modules?.length ?? 0);
                if (scopeFilter === "single") return modCount === 1;
                if (scopeFilter === "multi") return modCount > 1;
                return true;
              });

              if (presetsForCategory.length === 0) return null;

              const isVisible =
                activeCategory === "all" || activeCategory === cat.id;
              const hiddenProps: Record<string, string | boolean> = isVisible
                ? {}
                : supportsUntilFound
                ? { hidden: "until-found" }
                : { hidden: true };

              return (
                <div
                  key={cat.id}
                  id={`category-panel-${cat.id}`}
                  data-category-id={cat.id}
                  {...hiddenProps}
                >
                  <div className="rounded-xl border border-slate-800/90 bg-slate-950/40 p-3.5">
                    <div className="mb-3 flex flex-wrap items-center justify-between gap-2 border-b border-slate-800/80 pb-2.5">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="rounded-md bg-indigo-500/20 px-2 py-0.5 text-[11px] font-bold uppercase tracking-wider text-indigo-300">
                            {cat.id}
                          </span>
                          <h3 className="text-xs font-bold text-white sm:text-sm">
                            {cat.label}
                          </h3>
                          <span className="rounded-full border border-slate-700 bg-slate-900 px-2 py-0.5 font-mono text-[10px] font-semibold text-slate-300">
                            {presetsForCategory.length} Şablon
                          </span>
                        </div>
                        <p className="mt-1 text-[11px] text-slate-400">
                          {cat.description}
                        </p>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                      {presetsForCategory.map((preset) => {
                        const isSelected = activePresetId === preset.id;
                        const moduleCount =
                          1 + (preset.config.additional_modules?.length ?? 0);
                        const isMulti = moduleCount > 1;

                        return (
                          <div
                            key={preset.id}
                            className={`flex flex-col justify-between rounded-xl border p-3.5 transition ${
                              isSelected
                                ? "border-indigo-500 bg-indigo-950/45 text-white shadow-md shadow-indigo-500/10"
                                : "border-slate-800 bg-slate-950/85 text-slate-300 hover:border-indigo-500/50 hover:bg-slate-900"
                            }`}
                          >
                            <div>
                              <div className="flex flex-wrap items-center justify-between gap-1.5">
                                <span
                                  className={`rounded px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${
                                    isMulti
                                      ? "bg-indigo-500/20 text-indigo-300"
                                      : "bg-sky-500/20 text-sky-300"
                                  }`}
                                >
                                  {isMulti
                                    ? `${moduleCount} Modül Oda Hattı`
                                    : "Tekil Modül / Cihaz Nişi"}
                                </span>
                                <span className="font-mono text-[11px] font-semibold text-emerald-400">
                                  {isMulti
                                    ? `Toplam ${preset.totalWidthMm}×${preset.config.height_mm}×${preset.config.depth_mm} mm`
                                    : `${preset.config.width_mm}×${preset.config.height_mm}×${preset.config.depth_mm} mm`}
                                </span>
                              </div>

                              <h4 className="mt-2 text-xs font-bold text-slate-100 sm:text-[13px]">
                                {preset.title}
                              </h4>
                              <p className="mt-1 text-[11px] leading-relaxed text-slate-400">
                                {preset.subtitle}
                              </p>

                              {/* Mühendislik Özellik Etiketleri */}
                              <div className="mt-2.5 flex flex-wrap gap-1">
                                {preset.highlights.map((chip, chipIdx) => (
                                  <span
                                    key={chipIdx}
                                    className="rounded-md border border-slate-800 bg-slate-900/90 px-1.5 py-0.5 text-[10px] font-medium text-slate-300"
                                  >
                                    {chip}
                                  </span>
                                ))}
                              </div>
                            </div>

                            <div className="mt-3 flex items-center gap-2 border-t border-slate-800/80 pt-2.5">
                              <button
                                type="button"
                                onClick={() => handleSelectRoomPreset(preset)}
                                className={`flex-1 rounded-lg px-2.5 py-1.5 text-[11px] font-bold transition ${
                                  isSelected
                                    ? "bg-indigo-600 text-white"
                                    : "bg-indigo-600/20 text-indigo-300 hover:bg-indigo-600 hover:text-white"
                                }`}
                              >
                                {isSelected
                                  ? "✓ Aktif Üretim Şablonu"
                                  : "3D, BOM & CNC Yükle"}
                              </button>
                              <button
                                type="button"
                                disabled={isParsing || isGenerating}
                                onClick={() => {
                                  setPrompt(preset.prompt);
                                  void handleParseAndGenerate(preset.prompt);
                                }}
                                title="Bu şablonun doğal dil istemini AI ayrıştırıcıdan geçir"
                                className="inline-flex items-center gap-1 rounded-lg border border-sky-500/30 bg-sky-500/10 px-2.5 py-1.5 text-[11px] font-semibold text-sky-300 transition hover:bg-sky-500/25 disabled:opacity-50"
                              >
                                <Sparkles className="h-3 w-3" />
                                AI İstem
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
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
                    <option value="flap_up">Kalkar Kapak (Gazlı Pistonlu)</option>
                    <option value="none">Kapaksız (Açık)</option>
                  </select>
                </div>
              </div>

              {/* Alt Cihaz / Buzdolabı Niş Boşluğu */}
              <div>
                <label
                  htmlFor="appliance-niche-mm"
                  className="block text-xs font-medium text-slate-300"
                >
                  Alt Cihaz / Buzdolabı Açık Niş Yüksekliği
                </label>
                <span id="niche-hint" className="field-hint">
                  0–2200 mm (0 = Tam Boy Kapalı Gövde, örn. 1850 = Buzdolabı Nişi)
                </span>
                <input
                  id="appliance-niche-mm"
                  type="number"
                  min={0}
                  max={2200}
                  aria-describedby="niche-hint"
                  value={activeModule.appliance_niche_height_mm ?? 0}
                  onChange={(e) => {
                    const val = Number(e.target.value);
                    updateActiveModule({
                      appliance_niche_height_mm: val,
                      ...(val > 0 ? { has_plinth: false, plinth_height_mm: 0 } : {}),
                    });
                  }}
                  className="param-input w-full rounded-lg border border-slate-700 bg-slate-950 px-2.5 py-1.5 font-mono text-xs text-slate-100"
                />
                <div className="error-msg">0–2200 mm arası niş yüksekliği giriniz.</div>
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

              {/* Paket A & C: Bağlantı Sistemi (Minifiks vs Cabineo 3-Eksen) ve Kesim Teknolojisi */}
              <div className="space-y-2.5 rounded-xl border border-indigo-500/30 bg-indigo-950/20 p-3">
                <span className="block text-[11px] font-bold uppercase tracking-wider text-indigo-300">
                  CNC Bağlantı &amp; Kesim Teknolojisi
                </span>

                <div>
                  <label
                    htmlFor="fastener-type"
                    className="mb-1 block text-xs font-medium text-slate-300"
                  >
                    Gövde Bağlantı Sistemi
                  </label>
                  <select
                    id="fastener-type"
                    value={activeModule.fastener_type ?? "minifix_dowel"}
                    onChange={(e) =>
                      updateActiveModule({
                        fastener_type: e.target.value as FastenerType,
                      })
                    }
                    className="w-full rounded-lg border border-slate-700 bg-slate-950 px-2.5 py-1.5 text-xs text-slate-100"
                  >
                    <option value="minifix_dowel">
                      Minifiks Ø15 + Kavela Ø8 (Yatay Delikli)
                    </option>
                    <option value="cabineo_12">
                      Lamello Cabineo 12 (Saf Z-Ekseni 3-Eksen CNC)
                    </option>
                  </select>
                </div>

                <div>
                  <label
                    htmlFor="cutting-mode"
                    className="mb-1 block text-xs font-medium text-slate-300"
                  >
                    Plaka Kesim Modu (Kerf / Vakum Sekmesi)
                  </label>
                  <select
                    id="cutting-mode"
                    value={config.cutting_mode ?? "panel_saw"}
                    onChange={(e) =>
                      setConfig({
                        ...config,
                        cutting_mode: e.target.value as CuttingMode,
                      })
                    }
                    className="w-full rounded-lg border border-slate-700 bg-slate-950 px-2.5 py-1.5 text-xs text-slate-100"
                  >
                    <option value="panel_saw">
                      Ebatlama Testeresi (4.0 mm Testere Kerf)
                    </option>
                    <option value="cnc_router">
                      3-Eksen CNC Router Nesting (10 mm Çakı + 4×Sekme)
                    </option>
                  </select>
                </div>
              </div>

              {/* Paket B: Şantiye Rölöve Toleransları (Kör Çıta, Süpürgelik & Kolon Kertmesi) */}
              <div className="space-y-2.5 rounded-xl border border-amber-500/30 bg-amber-950/15 p-3">
                <span className="block text-[11px] font-bold uppercase tracking-wider text-amber-300">
                  Şantiye &amp; Rölöve Tolerans Paketi
                </span>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label
                      htmlFor="left-filler-mm"
                      className="block text-[11px] font-medium text-slate-300"
                    >
                      Sol Kör Çıta (mm)
                    </label>
                    <input
                      id="left-filler-mm"
                      type="number"
                      min={0}
                      max={250}
                      value={activeModule.left_filler_width_mm ?? 0}
                      onChange={(e) =>
                        updateActiveModule({
                          left_filler_width_mm: Number(e.target.value),
                        })
                      }
                      className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-2 py-1 font-mono text-xs text-slate-100"
                    />
                  </div>
                  <div>
                    <label
                      htmlFor="right-filler-mm"
                      className="block text-[11px] font-medium text-slate-300"
                    >
                      Sağ Kör Çıta (mm)
                    </label>
                    <input
                      id="right-filler-mm"
                      type="number"
                      min={0}
                      max={250}
                      value={activeModule.right_filler_width_mm ?? 0}
                      onChange={(e) =>
                        updateActiveModule({
                          right_filler_width_mm: Number(e.target.value),
                        })
                      }
                      className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-2 py-1 font-mono text-xs text-slate-100"
                    />
                  </div>
                </div>

                <div>
                  <label
                    htmlFor="plinth-type"
                    className="mb-1 block text-[11px] font-medium text-slate-300"
                  >
                    Alt Baza &amp; Terazi Sistemi
                  </label>
                  <select
                    id="plinth-type"
                    value={activeModule.plinth_type ?? "wood_plinth"}
                    onChange={(e) =>
                      updateActiveModule({
                        plinth_type: e.target.value as PlinthType,
                      })
                    }
                    className="w-full rounded-lg border border-slate-700 bg-slate-950 px-2.5 py-1.5 text-xs text-slate-100"
                  >
                    <option value="wood_plinth">
                      Ahşap Ön/Arka Baza Kaydı (Standart)
                    </option>
                    <option value="adjustable_legs">
                      4× Ayarlı Plastik Ayak + Klipsli Ön Baza
                    </option>
                  </select>
                </div>

                <div className="flex flex-col gap-1.5 pt-1">
                  <label className="flex items-center gap-2 text-xs text-slate-300">
                    <input
                      type="checkbox"
                      checked={activeModule.has_baseboard_notch ?? false}
                      onChange={(e) =>
                        updateActiveModule({
                          has_baseboard_notch: e.target.checked,
                        })
                      }
                      className="rounded border-slate-700 bg-slate-950 text-amber-500"
                    />
                    Süpürgelik Kertmesi (Arka Alt 80×15 mm)
                  </label>
                  <label className="flex items-center gap-2 text-xs text-slate-300">
                    <input
                      type="checkbox"
                      checked={activeModule.has_column_notch ?? false}
                      onChange={(e) =>
                        updateActiveModule({
                          has_column_notch: e.target.checked,
                        })
                      }
                      className="rounded border-slate-700 bg-slate-950 text-amber-500"
                    />
                    Arka Kolon Kertmesi (120×120 mm Çentik)
                  </label>
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

          {/* Sağ Sütun: 3D Görüntüleyici, BOM Tablosu, CNC DXF/CIX, Nesting, QR Etiket ve Maliyet */}
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
                  Plaka Nesting &amp; Artık Depo
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
                  Detaylı BOM &amp; CNC (.DXF/.NC/.MPR/.CIX)
                </button>

                <button
                  type="button"
                  onClick={() => setActiveTab("qr_labels")}
                  className={`flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-bold transition ${
                    activeTab === "qr_labels"
                      ? "bg-sky-600 text-white shadow-md shadow-sky-600/20"
                      : "bg-slate-900 text-slate-400 hover:bg-slate-800 hover:text-slate-200"
                  }`}
                >
                  <QrCode className="h-4 w-4" />
                  QR Parça Etiketleri &amp; PVC Şeması
                </button>

                <button
                  type="button"
                  onClick={() => setActiveTab("cost_quote")}
                  className={`flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-bold transition ${
                    activeTab === "cost_quote"
                      ? "bg-emerald-600 text-white shadow-md shadow-emerald-600/20"
                      : "bg-slate-900 text-slate-400 hover:bg-slate-800 hover:text-slate-200"
                  }`}
                >
                  <Calculator className="h-4 w-4" />
                  Maliyet, CNC Süresi &amp; Müşteri Teklifi
                </button>

                <button
                  type="button"
                  onClick={() => setActiveTab("workshop_terminal")}
                  className={`flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-bold transition ${
                    activeTab === "workshop_terminal"
                      ? "bg-amber-600 text-white shadow-md shadow-amber-600/20"
                      : "bg-slate-900 text-slate-400 hover:bg-slate-800 hover:text-slate-200"
                  }`}
                >
                  <Scan className="h-4 w-4" />
                  Atölye Terminali (QR Tarayıcı)
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

                {activeTab === "qr_labels" && (
                  <PartLabelsView
                    jobId={pkg.job_id}
                    bom={pkg.bom}
                    onSelectPart={(id) => setSelectedPartId(id)}
                  />
                )}

                {activeTab === "cost_quote" && (
                  <CostQuoteView
                    jobId={pkg.job_id}
                    bom={pkg.bom}
                    nesting={pkg.nesting}
                  />
                )}

                {activeTab === "workshop_terminal" && (
                  <WorkshopScannerView
                    jobId={pkg.job_id}
                    bom={pkg.bom}
                    selectedPartId={selectedPartId}
                    onSelectPart={(id) => setSelectedPartId(id)}
                    onNavigateTo3D={() => setActiveTab("3d_and_bom")}
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

      {/* Gemini AI API Anahtarı Modal */}
      {showKeyModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl border border-slate-800 bg-slate-900 p-5 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-sky-400" />
                <h3 className="text-sm font-bold text-slate-100">
                  Google Gemini AI Entegrasyonu
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setShowKeyModal(false)}
                className="rounded-lg p-1 text-slate-400 hover:bg-slate-800 hover:text-slate-200"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <p className="mt-3 text-xs leading-relaxed text-slate-300">
              Varsayılan olarak yapay zekâ, sunucudaki <code>GEMINI_API_KEY</code>{" "}
              ortam değişkeniyle (Vercel &gt; Settings &gt; Environment Variables)
              çalışır ve anahtar tarayıcıya hiç gönderilmez. Sunucu anahtarı yoksa
              buraya kendi Google AI Studio anahtarınızı girebilirsiniz; anahtar
              yalnızca bu tarayıcının yerel hafızasında (localStorage) saklanır.
            </p>

            <div className="mt-4">
              <label
                htmlFor="gemini-key-input"
                className="mb-1 block text-xs font-medium text-slate-300"
              >
                Gemini API Key
              </label>
              <input
                id="gemini-key-input"
                type="password"
                value={tempApiKey}
                onChange={(e) => setTempApiKey(e.target.value)}
                placeholder="AIza... (Google AI Studio anahtarı)"
                className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 font-mono text-xs text-slate-100 placeholder-slate-500 focus:border-sky-500 focus:outline-none"
              />
            </div>

            <div className="mt-5 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => {
                  setTempApiKey("");
                  setApiKey("");
                  setStoredGeminiApiKey("");
                  setShowKeyModal(false);
                }}
                className="rounded-lg border border-slate-800 bg-slate-800/80 px-3 py-1.5 text-xs font-medium text-slate-300 hover:bg-slate-800"
              >
                Temizle
              </button>
              <button
                type="button"
                onClick={() => {
                  const cleaned = tempApiKey.trim();
                  setApiKey(cleaned);
                  setStoredGeminiApiKey(cleaned);
                  setShowKeyModal(false);
                }}
                className="inline-flex items-center gap-1.5 rounded-lg bg-sky-600 px-4 py-1.5 text-xs font-bold text-white transition hover:bg-sky-500"
              >
                <Check className="h-3.5 w-3.5" />
                Kaydet
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Multimodal Vision: El Çizimi & Eskiz Fotoğrafı Yükleme Modalı */}
      {showSketchModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm">
          <div className="relative flex max-h-[92vh] w-full max-w-2xl flex-col rounded-2xl border border-slate-700 bg-slate-900 shadow-2xl overflow-hidden">
            <div className="flex items-center justify-between border-b border-slate-800 bg-slate-950 px-5 py-3.5">
              <div className="flex items-center gap-2">
                <Camera className="h-5 w-5 text-indigo-400" />
                <h3 className="text-sm font-bold text-slate-100">
                  Multimodal Görsel &amp; Eskizden Otomatik CAD Üretimi (Gemini Vision)
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setShowSketchModal(false)}
                className="rounded-lg p-1 text-slate-400 hover:bg-slate-800 hover:text-slate-100 transition"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="overflow-y-auto p-5 space-y-4">
              <p className="text-xs text-slate-300">
                Atölye ustalarının veya iç mimarların kağıda çizdiği ölçülü rölöve krokisinin fotoğrafını yükleyin veya hazır test eskizlerinden birini seçin. Gemini Vision görseldeki ölçüleri, nişleri ve bölmeleri okuyup anında 3D CAD ve üretim paketine dönüştürür.
              </p>

              {/* Hazır Test Eskizleri */}
              <div>
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                  Hemen Test Etmek İçin Örnek Eskiz Seçin:
                </span>
                <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2">
                  <button
                    type="button"
                    onClick={() => loadPresetSketch("refrigerator")}
                    className="flex items-center gap-2.5 rounded-xl border border-indigo-500/30 bg-indigo-950/30 p-2.5 text-left text-xs transition hover:border-indigo-400 hover:bg-indigo-900/40"
                  >
                    <ImageIcon className="h-4 w-4 text-indigo-400 shrink-0" />
                    <div>
                      <div className="font-bold text-indigo-200">Buzdolabı Çevreleme Krokisi</div>
                      <div className="text-[10px] text-slate-400">235×85×65 cm, 185 cm açık niş, kalkar kapak</div>
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => loadPresetSketch("wardrobe")}
                    className="flex items-center gap-2.5 rounded-xl border border-sky-500/30 bg-sky-950/30 p-2.5 text-left text-xs transition hover:border-sky-400 hover:bg-sky-900/40"
                  >
                    <ImageIcon className="h-4 w-4 text-sky-400 shrink-0" />
                    <div>
                      <div className="font-bold text-sky-200">2 Kapaklı Gardırop Çizimi</div>
                      <div className="text-[10px] text-slate-400">210×90×58 cm, 3 raf, 2 çekmece, 8 cm baza</div>
                    </div>
                  </button>
                </div>
              </div>

              {/* Dosya Yükleme / Kamera Dropzone */}
              <div>
                <label className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                  Veya Kendi Çiziminizi / Fotoğrafınızı Yükleyin:
                </label>
                <label className="mt-1.5 flex flex-col items-center justify-center rounded-xl border-2 border-dashed border-slate-700 bg-slate-950/80 p-5 text-center cursor-pointer hover:border-sky-500 transition">
                  <UploadCloud className="h-8 w-8 text-slate-400 mb-1" />
                  <span className="text-xs font-semibold text-sky-400">
                    Fotoğraf seçin veya buraya sürükleyin
                  </span>
                  <span className="text-[10px] text-slate-500 mt-0.5">
                    PNG, JPEG, WebP veya SVG (Telefondan kamera ile de çekebilirsiniz)
                  </span>
                  <input
                    type="file"
                    accept="image/*"
                    capture="environment"
                    onChange={handleFileUpload}
                    className="hidden"
                  />
                </label>
              </div>

              {/* Görsel Önizleme */}
              {sketchBase64 && (
                <div className="rounded-xl border border-slate-700 bg-slate-950 p-3">
                  <div className="mb-2 flex items-center justify-between text-xs">
                    <span className="font-semibold text-slate-300">Seçilen Eskiz Önizlemesi:</span>
                    <button
                      type="button"
                      onClick={() => setSketchBase64(null)}
                      className="text-[11px] text-rose-400 hover:underline"
                    >
                      Kaldır
                    </button>
                  </div>
                  <div className="flex justify-center max-h-56 overflow-hidden rounded-lg bg-white/5 p-2">
                    <img
                      src={sketchBase64}
                      alt="Eskiz önizlemesi"
                      className="max-h-52 object-contain rounded"
                    />
                  </div>
                </div>
              )}

              {/* Ek Kullanıcı Notu / İstem */}
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Ek Kullanıcı Notu (İsteğe Bağlı):
                </label>
                <input
                  type="text"
                  value={sketchUserPrompt}
                  onChange={(e) => setSketchUserPrompt(e.target.value)}
                  placeholder="Örn: Gövde beyaz suntalam, kapaklar meşe desen MDF-Lam olsun..."
                  className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3.5 py-2 text-xs text-slate-100 placeholder-slate-500 focus:border-sky-500 focus:outline-none"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2.5 border-t border-slate-800 bg-slate-950 px-5 py-3.5">
              <button
                type="button"
                onClick={() => setShowSketchModal(false)}
                className="rounded-xl border border-slate-700 bg-slate-800 px-4 py-2 text-xs font-semibold text-slate-300 hover:bg-slate-700 transition"
              >
                Vazgeç
              </button>
              <button
                type="button"
                disabled={!sketchBase64 || isParsingSketch}
                onClick={() => void handleParseSketch()}
                className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-5 py-2 text-xs font-bold text-white shadow-lg shadow-indigo-600/30 hover:bg-indigo-500 transition disabled:opacity-50"
              >
                {isParsingSketch ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Sparkles className="h-4 w-4" />
                )}
                {isParsingSketch ? "Vision Analiz Ediliyor..." : "Çizimi CAD'e Dönüştür"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
export default App;
