import { useEffect, useState } from "react";
import {
  Archive,
  Bookmark,
  Box,
  Calculator,
  Camera,
  Check,
  Cpu,
  FileSpreadsheet,
  Image as ImageIcon,
  LayoutGrid,
  Loader2,
  QrCode,
  Scan,
  Scissors,
  Sparkles,
  UploadCloud,
  X,
} from "lucide-react";
import { AIChatDrawer } from "./components/AIChatDrawer";
import { BomTableView } from "./components/BomTableView";
import { CabinetViewer3D } from "./components/CabinetViewer3D";
import { CostQuoteView } from "./components/CostQuoteView";
import { NestingView } from "./components/NestingView";
import { ParametricSidebar } from "./components/ParametricSidebar";
import { PartLabelsView } from "./components/PartLabelsView";
import { ProductionStatsRibbon } from "./components/ProductionStatsRibbon";
import { TemplateCatalogDrawer } from "./components/TemplateCatalogDrawer";
import { WorkshopScannerView } from "./components/WorkshopScannerView";
import {
  generateProductionPackage,
  parseNaturalLanguagePrompt,
  parseSketchImage,
  type ParseResult,
} from "./services/api";
import { ROOM_LINE_PRESETS } from "./services/clientEngine";
import {
  getStoredGeminiApiKey,
  setStoredGeminiApiKey,
} from "./services/geminiClient";
import type {
  CabinetConfig,
  ProductionPackageResponse,
  RoomLinePreset,
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

const POPULAR_PRESET_IDS = [
  "bedroom_wardrobe_2drawer_90",
  "kitchen_fridge_enclosure",
  "kitchen_full_line",
  "bedroom_dresser_4drawer_90",
  "bathroom_vanity_2drawer_80",
  "living_tv_console_180",
];

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

  // Modern UI & Çekmece State'leri
  const [showTemplateDrawer, setShowTemplateDrawer] = useState<boolean>(false);
  const [showAIChatDrawer, setShowAIChatDrawer] = useState<boolean>(false);
  const [configHistory, setConfigHistory] = useState<CabinetConfig[]>([]);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState<boolean>(false);

  const [parseInfo, setParseInfo] = useState<ParseResult | null>(null);

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

  const handleAddSideModule = (presetModule?: Partial<CabinetConfig>) => {
    const nextIdx = (config.additional_modules?.length ?? 0) + 2;
    const newModule: CabinetConfig = presetModule
      ? {
          ...activeModule,
          ...presetModule,
          // Tutarlı mimari hat için gövde rengi ve bağlantı standardını aktif modülden devral:
          body_material: activeModule.body_material,
          body_color_hex: activeModule.body_color_hex,
          door_color_hex: activeModule.door_color_hex,
          front_pvc_thickness_mm: activeModule.front_pvc_thickness_mm,
          hidden_pvc_thickness_mm: activeModule.hidden_pvc_thickness_mm,
          back_panel_type: activeModule.back_panel_type,
          fastener_type: activeModule.fastener_type,
          sheet_size: activeModule.sheet_size,
          cutting_mode: activeModule.cutting_mode,
          name: presetModule.name ?? `Ek Modül #${nextIdx}`,
          additional_modules: [],
        }
      : {
          ...activeModule,
          name: `Ek Modül #${nextIdx}`,
          additional_modules: [],
        };
    const nextConfig: CabinetConfig = {
      ...config,
      additional_modules: [...(config.additional_modules ?? []), newModule],
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

  const handleApplyRevision = (newConfig: CabinetConfig, _diffs: string[]) => {
    setConfigHistory((prev) => [...prev, config]);
    setConfig(newConfig);
    void runGeneration(newConfig);
  };

  const handleUndoRevision = () => {
    if (configHistory.length === 0) return;
    const previous = configHistory[configHistory.length - 1];
    setConfigHistory((prev) => prev.slice(0, prev.length - 1));
    setConfig(previous);
    void runGeneration(previous);
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
                <button
                  type="button"
                  onClick={() => setShowAIChatDrawer(true)}
                  className="inline-flex items-center justify-center gap-2 rounded-xl border border-amber-500/50 bg-gradient-to-r from-amber-600 to-indigo-600 px-4 py-2.5 text-xs font-bold text-white shadow-lg shadow-indigo-900/30 transition hover:opacity-95"
                >
                  <Sparkles className="h-4 w-4 text-amber-200" />
                  AI Canlı Revizyon &amp; Chat
                </button>
              </div>
            </div>
          </div>

          {/* Hızlı Başlat Popüler Şablon Hapları */}
          <div className="mt-3 flex flex-wrap items-center gap-1.5 border-t border-slate-800/80 pt-2.5">
            <span className="text-[11px] font-semibold text-slate-400">
              Hızlı Şablonlar:
            </span>
            {POPULAR_PRESET_IDS.map((pId) => {
              const found = ROOM_LINE_PRESETS.find((p) => p.id === pId);
              if (!found) return null;
              const isCurrent = activePresetId === found.id;
              return (
                <button
                  key={pId}
                  type="button"
                  onClick={() => handleSelectRoomPreset(found)}
                  className={`flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-[11px] font-semibold transition ${
                    isCurrent
                      ? "border-indigo-500 bg-indigo-600/30 text-white shadow-sm"
                      : "border-slate-800 bg-slate-950/80 text-slate-300 hover:border-indigo-500/50 hover:text-white hover:bg-slate-900"
                  }`}
                >
                  <span>{found.title.split("(")[0].trim()}</span>
                </button>
              );
            })}
            <button
              type="button"
              onClick={() => setShowTemplateDrawer(true)}
              className="inline-flex items-center gap-1 rounded-lg border border-indigo-500/40 bg-indigo-600/20 px-2.5 py-1 text-[11px] font-bold text-indigo-300 hover:bg-indigo-600 hover:text-white transition shadow-sm"
            >
              <LayoutGrid className="h-3 w-3" />
              Tüm Şablonlar (29) →
            </button>
            <button
              type="button"
              onClick={() => setShowTemplateDrawer(true)}
              className="inline-flex items-center gap-1 rounded-lg border border-amber-500/40 bg-amber-500/20 px-2.5 py-1 text-[11px] font-bold text-amber-300 hover:bg-amber-500 hover:text-slate-950 transition shadow-sm"
              title="Kendi tasarımlarınızı kaydedin veya JSON olarak içe/dışa aktarın"
            >
              <Bookmark className="h-3 w-3" />
              Özel Tasarımlar &amp; JSON
            </button>
          </div>

          {/* Hazır Fabrika Senaryoları */}
          <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
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
                className="rounded-lg border border-slate-800 bg-slate-950/80 px-2 py-0.5 text-[10px] text-slate-300 transition hover:border-sky-500/50 hover:text-sky-300"
              >
                {sample.slice(0, 60)}...
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

        {/* Canlı Üretim & Metrik Şeridi (KPI Ribbon) */}
        <ProductionStatsRibbon
          pkg={pkg}
          config={config}
          onOpenTemplates={() => setShowTemplateDrawer(true)}
          onOpenSketch={() => setShowSketchModal(true)}
        />

        {errorMsg && (
          <div
            role="alert"
            className="rounded-xl border border-red-500/40 bg-red-950/50 px-4 py-3 text-xs font-medium text-red-200"
          >
            {errorMsg}
          </div>
        )}

        {/* Ana Çalışma Alanı: Sol Parametrik Kontrol Paneli + Sağ Mühendislik Çıktıları */}
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-12 items-start">
          {/* Sol Sütun: Parametrik Akordeon Kontrol Paneli (Katlanabilir) */}
          <div
            className={`transition-all duration-200 ${
              isSidebarCollapsed
                ? "lg:col-span-1"
                : "lg:col-span-4 xl:col-span-3"
            }`}
          >
            <ParametricSidebar
              config={config}
              activeModuleIndex={activeModuleIndex}
              onSelectModule={(idx) => setActiveModuleIndex(idx)}
              onAddModule={handleAddSideModule}
              onRemoveModule={handleRemoveModule}
              onUpdateActiveModule={updateActiveModule}
              onUpdateGlobalConfig={(patch) => {
                const next = { ...config, ...patch };
                setConfig(next);
                void runGeneration(next);
              }}
              onSubmit={() => void runGeneration(config)}
              isGenerating={isGenerating}
              isCollapsed={isSidebarCollapsed}
              onToggleCollapse={() => setIsSidebarCollapsed((prev) => !prev)}
            />
          </div>

          {/* Sağ Sütun: 3D Görüntüleyici, BOM Tablosu, CNC DXF/CIX, Nesting, QR Etiket ve Maliyet */}
          <section
            className={`space-y-4 transition-all duration-200 ${
              isSidebarCollapsed
                ? "lg:col-span-11 xl:col-span-11"
                : "lg:col-span-8 xl:col-span-9"
            }`}
          >
            {/* 6 Aşamalı Numaralı Üretim Sekmeleri */}
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800 pb-3">
              <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
                <button
                  type="button"
                  onClick={() => setActiveTab("3d_and_bom")}
                  className={`flex items-center gap-2 rounded-xl px-3.5 py-2 text-xs font-bold transition ${
                    activeTab === "3d_and_bom"
                      ? "bg-sky-600 text-white shadow-md shadow-sky-600/20"
                      : "bg-slate-900 text-slate-400 hover:bg-slate-800 hover:text-slate-200"
                  }`}
                >
                  <Box className="h-4 w-4" />
                  <span>1. 3D CAD &amp; Tasarım</span>
                </button>

                <button
                  type="button"
                  onClick={() => setActiveTab("nesting")}
                  className={`flex items-center gap-2 rounded-xl px-3.5 py-2 text-xs font-bold transition ${
                    activeTab === "nesting"
                      ? "bg-sky-600 text-white shadow-md shadow-sky-600/20"
                      : "bg-slate-900 text-slate-400 hover:bg-slate-800 hover:text-slate-200"
                  }`}
                >
                  <Scissors className="h-4 w-4" />
                  <span>2. Kesim Planı (Nesting)</span>
                  {pkg?.nesting?.sheets && (
                    <span className="rounded-full bg-slate-950/60 px-1.5 py-0.5 text-[10px] font-mono text-sky-300 border border-sky-400/30">
                      {pkg.nesting.sheets.length} Plaka
                    </span>
                  )}
                </button>

                <button
                  type="button"
                  onClick={() => setActiveTab("bom_only")}
                  className={`flex items-center gap-2 rounded-xl px-3.5 py-2 text-xs font-bold transition ${
                    activeTab === "bom_only"
                      ? "bg-sky-600 text-white shadow-md shadow-sky-600/20"
                      : "bg-slate-900 text-slate-400 hover:bg-slate-800 hover:text-slate-200"
                  }`}
                >
                  <FileSpreadsheet className="h-4 w-4" />
                  <span>3. Parça Listesi &amp; CNC</span>
                  {pkg?.bom?.parts && (
                    <span className="rounded-full bg-slate-950/60 px-1.5 py-0.5 text-[10px] font-mono text-slate-300 border border-slate-700">
                      {pkg.bom.parts.length} Parça
                    </span>
                  )}
                </button>

                <button
                  type="button"
                  onClick={() => setActiveTab("qr_labels")}
                  className={`flex items-center gap-2 rounded-xl px-3.5 py-2 text-xs font-bold transition ${
                    activeTab === "qr_labels"
                      ? "bg-sky-600 text-white shadow-md shadow-sky-600/20"
                      : "bg-slate-900 text-slate-400 hover:bg-slate-800 hover:text-slate-200"
                  }`}
                >
                  <QrCode className="h-4 w-4" />
                  <span>4. QR Parça Etiketleri</span>
                </button>

                <button
                  type="button"
                  onClick={() => setActiveTab("cost_quote")}
                  className={`flex items-center gap-2 rounded-xl px-3.5 py-2 text-xs font-bold transition ${
                    activeTab === "cost_quote"
                      ? "bg-emerald-600 text-white shadow-md shadow-emerald-600/20"
                      : "bg-slate-900 text-slate-400 hover:bg-slate-800 hover:text-slate-200"
                  }`}
                >
                  <Calculator className="h-4 w-4" />
                  <span>5. Maliyet &amp; Teklif</span>
                </button>

                <button
                  type="button"
                  onClick={() => setActiveTab("workshop_terminal")}
                  className={`flex items-center gap-2 rounded-xl px-3.5 py-2 text-xs font-bold transition ${
                    activeTab === "workshop_terminal"
                      ? "bg-amber-600 text-white shadow-md shadow-amber-600/20"
                      : "bg-slate-900 text-slate-400 hover:bg-slate-800 hover:text-slate-200"
                  }`}
                >
                  <Scan className="h-4 w-4" />
                  <span>6. Atölye Terminali</span>
                </button>

                <button
                  type="button"
                  onClick={() => setShowAIChatDrawer(true)}
                  className="flex items-center gap-2 rounded-xl border border-indigo-500/40 bg-gradient-to-r from-amber-500/15 via-indigo-500/15 to-indigo-600/25 px-3.5 py-2 text-xs font-bold text-indigo-300 hover:bg-indigo-500/30 transition shadow-sm ml-auto"
                  title="Dolabınızı konuşarak canlı revize edin"
                >
                  <Sparkles className="h-4 w-4 text-amber-400 animate-pulse" />
                  <span>AI Canlı Revizyon (Chat)</span>
                  {configHistory.length > 0 && (
                    <span className="rounded-full bg-amber-500/30 px-1.5 py-0.5 text-[10px] text-amber-300">
                      {configHistory.length}
                    </span>
                  )}
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

      {/* Şablon Kütüphanesi Slide-over Çekmecesi */}
      <TemplateCatalogDrawer
        isOpen={showTemplateDrawer}
        onClose={() => setShowTemplateDrawer(false)}
        activePresetId={activePresetId}
        currentConfig={config}
        onSelectPreset={(preset) => {
          handleSelectRoomPreset(preset);
          setShowTemplateDrawer(false);
        }}
        onSelectCustomConfig={(customCfg) => {
          setConfig(customCfg);
          setActivePresetId(null);
          setActiveModuleIndex(0);
          setShowTemplateDrawer(false);
          void runGeneration(customCfg);
        }}
        onSelectPrompt={(p) => {
          setPrompt(p);
          setShowTemplateDrawer(false);
          void handleParseAndGenerate(p);
        }}
      />

      {/* AI Canlı Revizyon & Konuşma Tabanlı Chat Çekmecesi */}
      <AIChatDrawer
        isOpen={showAIChatDrawer}
        onClose={() => setShowAIChatDrawer(false)}
        currentConfig={config}
        onApplyConfig={handleApplyRevision}
        canUndo={configHistory.length > 0}
        onUndo={handleUndoRevision}
        undoCount={configHistory.length}
      />

      {/* Sabit Yüzen AI Canlı Revizyon Butonu */}
      <button
        type="button"
        onClick={() => setShowAIChatDrawer(true)}
        className="fixed bottom-6 right-6 z-40 flex items-center gap-2.5 rounded-2xl bg-gradient-to-r from-amber-500 via-indigo-600 to-indigo-700 px-4 py-3 text-sm font-bold text-white shadow-2xl shadow-indigo-950/70 hover:scale-105 active:scale-95 transition-all border border-indigo-400/40"
        title="AI Tasarım Asistanı ile Konuşarak Revize Et"
      >
        <Sparkles className="h-5 w-5 text-amber-300 animate-pulse" />
        <span>AI Canlı Revizyon</span>
        {configHistory.length > 0 && (
          <span className="rounded-full bg-amber-400/30 px-1.5 py-0.5 text-xs text-amber-200">
            {configHistory.length}
          </span>
        )}
      </button>
    </div>
  );
}
export default App;
