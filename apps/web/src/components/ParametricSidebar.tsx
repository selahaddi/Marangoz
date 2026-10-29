import { useState } from "react";
import {
  ChevronDown,
  ChevronRight,
  ChevronLeft,
  Cpu,
  Layers,
  Loader2,
  Paintbrush,
  Plus,
  Sliders,
  Trash2,
  Wrench,
  Boxes,
  DoorOpen,
  Columns,
  Shirt,
} from "lucide-react";
import { AddModuleModal } from "./AddModuleModal";
import type {
  BackPanelType,
  CabinetConfig,
  CabinetType,
  CabinetZone,
  CuttingMode,
  DoorType,
  FastenerType,
  PlinthType,
  SheetSizeOption,
} from "../types/cabinet";

interface ParametricSidebarProps {
  config: CabinetConfig;
  activeModuleIndex: number;
  onSelectModule: (idx: number) => void;
  onAddModule: (moduleConfig?: Partial<CabinetConfig>) => void;
  onRemoveModule: (idx: number) => void;
  onUpdateActiveModule: (partial: Partial<CabinetConfig>) => void;
  onUpdateGlobalConfig: (partial: Partial<CabinetConfig>) => void;
  onSubmit: () => void;
  isGenerating: boolean;
  isCollapsed: boolean;
  onToggleCollapse: () => void;
}

export function ParametricSidebar({
  config,
  activeModuleIndex,
  onSelectModule,
  onAddModule,
  onRemoveModule,
  onUpdateActiveModule,
  onUpdateGlobalConfig,
  onSubmit,
  isGenerating,
  isCollapsed,
  onToggleCollapse,
}: ParametricSidebarProps) {
  const allModules = [config, ...(config.additional_modules ?? [])];
  const safeIdx = Math.min(activeModuleIndex, allModules.length - 1);
  const activeModule = allModules[safeIdx] ?? config;

  // Akordeon Açık/Kapalı Durumları
  const [openSections, setOpenSections] = useState<Record<string, boolean>>({
    dimensions: true,
    zones: true,
    doors_drawers: true,
    fasteners: false,
    base_notches: false,
    materials: false,
  });

  const [activeZoneIndex, setActiveZoneIndex] = useState<number>(0);

  // Hatta Modül Ekleme Listesi Modal State'i
  const [isAddModalOpen, setIsAddModalOpen] = useState<boolean>(false);

  const toggleSection = (sec: string) => {
    setOpenSections((prev) => ({ ...prev, [sec]: !prev[sec] }));
  };

  if (isCollapsed) {
    return (
      <div className="flex flex-col items-center gap-3 rounded-2xl border border-slate-800 bg-slate-900/90 py-4 px-2 shadow-xl backdrop-blur">
        <button
          type="button"
          onClick={onToggleCollapse}
          title="Parametrik Kontrol Panelini Genişlet"
          className="flex h-9 w-9 items-center justify-center rounded-xl bg-sky-600/20 text-sky-300 hover:bg-sky-600 hover:text-white transition"
        >
          <ChevronRight className="h-5 w-5" />
        </button>
        <div className="rotate-90 whitespace-nowrap text-xs font-bold uppercase tracking-wider text-slate-400 mt-6">
          Parametreler ({allModules.length} Modül)
        </div>
      </div>
    );
  }

  return (
    <aside className="relative flex flex-col rounded-2xl border border-slate-800 bg-slate-900/90 shadow-xl backdrop-blur">
      {/* Sidebar Header & Collapse Button */}
      <div className="flex items-center justify-between border-b border-slate-800 px-4 py-3 bg-slate-950/60 rounded-t-2xl">
        <div className="flex items-center gap-2">
          <Sliders className="h-4 w-4 text-sky-400" />
          <h2 className="text-xs font-bold uppercase tracking-wider text-slate-200">
            Parametrik CAD/CAM Kontrolleri
          </h2>
        </div>
        <button
          type="button"
          onClick={onToggleCollapse}
          title="Paneli Daralt (Çalışma Alanını Genişlet)"
          className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-800 hover:text-slate-200 transition"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>
      </div>

      {/* Çoklu Modül Yönetimi (M1, M2, + Modül Ekle) */}
      <div className="border-b border-slate-800/80 bg-slate-950/40 px-4 py-2.5">
        <div className="mb-2 flex items-center justify-between text-xs">
          <span className="font-semibold text-slate-300">
            Hattaki Modüller ({allModules.length} Adet)
          </span>
          <button
            type="button"
            onClick={() => setIsAddModalOpen(true)}
            className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-600/90 px-2.5 py-1 text-[11px] font-bold text-white transition hover:bg-indigo-500 shadow-sm"
            title="Hatta eklenecek hazır modül veya mimari ürünü listeden seçin"
          >
            <Plus className="h-3.5 w-3.5" />
            <span>Yanına Ekle</span>
            <ChevronDown className="h-3 w-3 opacity-80" />
          </button>
        </div>

        <div className="flex flex-wrap gap-1.5">
          {allModules.map((mod, idx) => {
            const isCurrent = idx === safeIdx;
            return (
              <div
                key={idx}
                className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-xs font-semibold transition ${
                  isCurrent
                    ? "border-sky-500 bg-sky-500/20 text-sky-200 shadow-sm"
                    : "border-slate-800 bg-slate-900 text-slate-400 hover:text-slate-200"
                }`}
              >
                <button
                  type="button"
                  onClick={() => onSelectModule(idx)}
                  className="text-left"
                >
                  M{idx + 1}: {mod.width_mm}mm
                </button>
                {idx > 0 && (
                  <button
                    type="button"
                    onClick={() => onRemoveModule(idx)}
                    title="Bu Modülü Hattan Sil"
                    className="ml-1 text-slate-500 hover:text-red-400"
                  >
                    <Trash2 className="h-3 w-3" />
                  </button>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Akordeon Gruplar (Form Gövdesi) */}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          onSubmit();
        }}
        className="flex-1 space-y-2 p-3 overflow-y-auto max-h-[calc(100vh-320px)]"
      >
        {/* GRUP 1: Temel Boyutlar & Tip */}
        <div className="rounded-xl border border-slate-800/90 bg-slate-950/60 overflow-hidden">
          <button
            type="button"
            onClick={() => toggleSection("dimensions")}
            className="flex w-full items-center justify-between px-3 py-2.5 text-xs font-bold text-slate-200 hover:bg-slate-900/60 transition"
          >
            <div className="flex items-center gap-2">
              <Boxes className="h-4 w-4 text-sky-400" />
              <span>1. Dış Ölçüler &amp; Tip (M{safeIdx + 1})</span>
            </div>
            {openSections.dimensions ? (
              <ChevronDown className="h-4 w-4 text-slate-400" />
            ) : (
              <ChevronRight className="h-4 w-4 text-slate-400" />
            )}
          </button>

          {openSections.dimensions && (
            <div className="p-3 pt-1 space-y-3 border-t border-slate-800/60 text-xs">
              <div>
                <label className="block text-slate-300 font-medium mb-1">
                  Modül Tipi
                </label>
                <select
                  value={activeModule.cabinet_type}
                  onChange={(e) =>
                    onUpdateActiveModule({
                      cabinet_type: e.target.value as CabinetType,
                    })
                  }
                  className="w-full rounded-lg border border-slate-700 bg-slate-950 px-2.5 py-1.5 text-slate-100"
                >
                  <option value="wardrobe">Gardırop / Yüklük</option>
                  <option value="kitchen_base">Mutfak Alt Modül</option>
                  <option value="kitchen_wall">Mutfak Üst Modül</option>
                  <option value="kitchen_tall">Mutfak Boy / Kule</option>
                  <option value="bathroom_vanity">Banyo Lavabo Alt Modül</option>
                  <option value="bathroom_tall">Banyo Boy Dolabı</option>
                  <option value="dresser">Şifonyer / Komodin</option>
                  <option value="shoe_cabinet">Ayakkabılık / Portmanto</option>
                  <option value="tv_unit">TV Ünitesi / Konsol</option>
                  <option value="bookshelf">Kitaplık / Açık Raf</option>
                </select>
              </div>

              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="block text-slate-300 font-medium mb-1">
                    Genişlik
                  </label>
                  <input
                    type="number"
                    min={300}
                    max={2700}
                    value={activeModule.width_mm}
                    onChange={(e) =>
                      onUpdateActiveModule({ width_mm: Number(e.target.value) })
                    }
                    className="w-full rounded-lg border border-slate-700 bg-slate-950 px-2 py-1.5 font-mono text-xs text-slate-100"
                  />
                  <span className="text-[10px] text-slate-500">mm</span>
                </div>
                <div>
                  <label className="block text-slate-300 font-medium mb-1">
                    Yükseklik
                  </label>
                  <input
                    type="number"
                    min={300}
                    max={2750}
                    value={activeModule.height_mm}
                    onChange={(e) =>
                      onUpdateActiveModule({ height_mm: Number(e.target.value) })
                    }
                    className="w-full rounded-lg border border-slate-700 bg-slate-950 px-2 py-1.5 font-mono text-xs text-slate-100"
                  />
                  <span className="text-[10px] text-slate-500">mm</span>
                </div>
                <div>
                  <label className="block text-slate-300 font-medium mb-1">
                    Derinlik
                  </label>
                  <input
                    type="number"
                    min={200}
                    max={900}
                    value={activeModule.depth_mm}
                    onChange={(e) =>
                      onUpdateActiveModule({ depth_mm: Number(e.target.value) })
                    }
                    className="w-full rounded-lg border border-slate-700 bg-slate-950 px-2 py-1.5 font-mono text-xs text-slate-100"
                  />
                  <span className="text-[10px] text-slate-500">mm</span>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* GRUP 2: İç Bölmeler & Dikmeler (Zones) */}
        <div className="rounded-xl border border-slate-800/90 bg-slate-950/60 overflow-hidden">
          <button
            type="button"
            onClick={() => toggleSection("zones")}
            className="flex w-full items-center justify-between px-3 py-2.5 text-xs font-bold text-slate-200 hover:bg-slate-900/60 transition"
          >
            <div className="flex items-center gap-2">
              <Columns className="h-4 w-4 text-amber-400" />
              <span>
                2. İç Bölmeler &amp; Dikmeler{" "}
                {activeModule.zones && activeModule.zones.length > 1
                  ? `(${activeModule.zones.length} Bölmeli)`
                  : "(Tek Gövde)"}
              </span>
            </div>
            {openSections.zones ? (
              <ChevronDown className="h-4 w-4 text-slate-400" />
            ) : (
              <ChevronRight className="h-4 w-4 text-slate-400" />
            )}
          </button>

          {openSections.zones && (
            <div className="p-3 pt-1 space-y-3 border-t border-slate-800/60 text-xs">
              {/* Düzen Seçimi (Preset Butonları) */}
              <div>
                <label className="block text-slate-300 font-medium mb-1.5">
                  Gövde Bölme Düzeni
                </label>
                <div className="grid grid-cols-3 gap-1.5">
                  <button
                    type="button"
                    onClick={() => {
                      onUpdateActiveModule({ zones: undefined });
                      setActiveZoneIndex(0);
                    }}
                    className={`rounded-lg py-1.5 px-2 text-center text-[11px] font-semibold transition border ${
                      !activeModule.zones || activeModule.zones.length <= 1
                        ? "border-amber-500 bg-amber-500/20 text-amber-200 shadow-sm"
                        : "border-slate-800 bg-slate-900/80 text-slate-400 hover:text-slate-200"
                    }`}
                  >
                    Tek Gövde (1)
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      onUpdateActiveModule({
                        zones: [
                          {
                            id: "z_1",
                            name: "Sol Bölme",
                            width_ratio: 1.0,
                            shelf_count: 3,
                            door_type: "single_left",
                            drawer_count: 0,
                            has_hanging_rod: false,
                          },
                          {
                            id: "z_2",
                            name: "Sağ Bölme",
                            width_ratio: 1.0,
                            shelf_count: 0,
                            door_type: "single_right",
                            drawer_count: 2,
                            has_hanging_rod: true,
                          },
                        ],
                      });
                      setActiveZoneIndex(0);
                    }}
                    className={`rounded-lg py-1.5 px-2 text-center text-[11px] font-semibold transition border ${
                      activeModule.zones && activeModule.zones.length === 2
                        ? "border-amber-500 bg-amber-500/20 text-amber-200 shadow-sm"
                        : "border-slate-800 bg-slate-900/80 text-slate-400 hover:text-slate-200"
                    }`}
                  >
                    2 Bölmeli (1 Dikme)
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      onUpdateActiveModule({
                        zones: [
                          {
                            id: "z_1",
                            name: "Sol Bölme",
                            width_ratio: 1.0,
                            shelf_count: 4,
                            door_type: "single_left",
                            drawer_count: 0,
                            has_hanging_rod: false,
                          },
                          {
                            id: "z_2",
                            name: "Orta Bölme",
                            width_ratio: 1.0,
                            shelf_count: 0,
                            door_type: "single_right",
                            drawer_count: 0,
                            has_hanging_rod: true,
                          },
                          {
                            id: "z_3",
                            name: "Sağ Bölme",
                            width_ratio: 1.0,
                            shelf_count: 2,
                            door_type: "single_right",
                            drawer_count: 3,
                            has_hanging_rod: false,
                          },
                        ],
                      });
                      setActiveZoneIndex(0);
                    }}
                    className={`rounded-lg py-1.5 px-2 text-center text-[11px] font-semibold transition border ${
                      activeModule.zones && activeModule.zones.length === 3
                        ? "border-amber-500 bg-amber-500/20 text-amber-200 shadow-sm"
                        : "border-slate-800 bg-slate-900/80 text-slate-400 hover:text-slate-200"
                    }`}
                  >
                    3 Bölmeli (2 Dikme)
                  </button>
                </div>
              </div>

              {/* Çoklu Bölme Aktifse: Bölme Sekmeleri ve Detay Ayarları */}
              {activeModule.zones && activeModule.zones.length > 1 && (
                <div className="space-y-3 pt-1 border-t border-slate-800/60">
                  {/* Bölme Sekmeleri */}
                  <div className="flex gap-1 overflow-x-auto pb-1">
                    {activeModule.zones.map((zone, zIdx) => {
                      const isSelected = zIdx === activeZoneIndex;
                      return (
                        <button
                          key={zone.id || zIdx}
                          type="button"
                          onClick={() => setActiveZoneIndex(zIdx)}
                          className={`flex-1 min-w-[70px] rounded-lg py-1 px-2 text-[11px] font-bold transition border ${
                            isSelected
                              ? "border-sky-500 bg-sky-500/20 text-sky-200 shadow-sm"
                              : "border-slate-800 bg-slate-900 text-slate-400 hover:text-slate-200"
                          }`}
                        >
                          {zone.name || `Bölme ${zIdx + 1}`}
                        </button>
                      );
                    })}
                  </div>

                  {/* Seçili Bölmenin Parametreleri */}
                  {(() => {
                    const currentZones = activeModule.zones ?? [];
                    const curZoneIdx = Math.min(activeZoneIndex, currentZones.length - 1);
                    const currentZone = currentZones[curZoneIdx];
                    if (!currentZone) return null;

                    const updateZone = (partial: Partial<CabinetZone>) => {
                      const next = currentZones.map((z, i) =>
                        i === curZoneIdx ? { ...z, ...partial } : z
                      );
                      onUpdateActiveModule({ zones: next });
                    };

                    return (
                      <div className="space-y-2.5 rounded-lg border border-slate-800/80 bg-slate-900/50 p-2.5">
                        <div className="flex items-center justify-between text-[11px] font-semibold text-slate-300">
                          <span>Bölme #{curZoneIdx + 1} Detayları</span>
                          <span className="text-amber-400 font-mono">
                            {currentZone.width_ratio ? `${currentZone.width_ratio}x Oran` : ""}
                            {currentZone.width_mm ? ` (${currentZone.width_mm}mm)` : ""}
                          </span>
                        </div>

                        {/* Bölme Adı ve Genişlik Oranı */}
                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <label className="block text-[11px] text-slate-400 mb-0.5">
                              Bölme Adı
                            </label>
                            <input
                              type="text"
                              value={currentZone.name || ""}
                              onChange={(e) => updateZone({ name: e.target.value })}
                              placeholder={`Bölme #${curZoneIdx + 1}`}
                              className="w-full rounded-lg border border-slate-700 bg-slate-950 px-2 py-1 text-xs text-slate-100"
                            />
                          </div>
                          <div>
                            <label className="block text-[11px] text-slate-400 mb-0.5">
                              Genişlik Oranı
                            </label>
                            <input
                              type="number"
                              step="0.1"
                              min="0.2"
                              max="5.0"
                              value={currentZone.width_ratio ?? 1.0}
                              onChange={(e) =>
                                updateZone({ width_ratio: Number(e.target.value) || 1.0 })
                              }
                              className="w-full rounded-lg border border-slate-700 bg-slate-950 px-2 py-1 font-mono text-xs text-slate-100"
                            />
                          </div>
                        </div>

                        {/* Kapak Tipi & Raf Sayısı */}
                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <label className="block text-[11px] text-slate-400 mb-0.5">
                              Kapak Tipi
                            </label>
                            <select
                              value={currentZone.door_type ?? "none"}
                              onChange={(e) =>
                                updateZone({ door_type: e.target.value as DoorType })
                              }
                              className="w-full rounded-lg border border-slate-700 bg-slate-950 px-2 py-1 text-xs text-slate-100"
                            >
                              <option value="none">Kapaksız (Açık)</option>
                              <option value="single_left">Tek (Sol Menteşeli)</option>
                              <option value="single_right">Tek (Sağ Menteşeli)</option>
                              <option value="double">Çift Kapak</option>
                              <option value="flap_up">Kalkar Kapak (Gazlı)</option>
                            </select>
                          </div>
                          <div>
                            <label className="block text-[11px] text-slate-400 mb-0.5">
                              Hareketli Raf
                            </label>
                            <input
                              type="number"
                              min={0}
                              max={12}
                              value={currentZone.shelf_count ?? 0}
                              onChange={(e) =>
                                updateZone({ shelf_count: Number(e.target.value) })
                              }
                              className="w-full rounded-lg border border-slate-700 bg-slate-950 px-2 py-1 font-mono text-xs text-slate-100"
                            />
                          </div>
                        </div>

                        {/* Çekmece Sayısı & Elbise Askılığı Switch */}
                        <div className="grid grid-cols-2 gap-2 pt-1 border-t border-slate-800/50">
                          <div>
                            <label className="block text-[11px] text-slate-400 mb-0.5">
                              Alt Çekmece Adedi
                            </label>
                            <input
                              type="number"
                              min={0}
                              max={6}
                              value={currentZone.drawer_count ?? 0}
                              onChange={(e) =>
                                updateZone({ drawer_count: Number(e.target.value) })
                              }
                              className="w-full rounded-lg border border-slate-700 bg-slate-950 px-2 py-1 font-mono text-xs text-slate-100"
                            />
                          </div>
                          <div className="flex flex-col justify-end">
                            <label className="flex items-center gap-2 cursor-pointer rounded-lg border border-slate-800 bg-slate-950 px-2.5 py-1.5 text-slate-300 hover:border-slate-700 transition">
                              <input
                                type="checkbox"
                                checked={Boolean(currentZone.has_hanging_rod)}
                                onChange={(e) =>
                                  updateZone({ has_hanging_rod: e.target.checked })
                                }
                                className="rounded border-slate-700 bg-slate-900 text-amber-500 focus:ring-0"
                              />
                              <div className="flex items-center gap-1.5 text-[11px] font-medium">
                                <Shirt className="h-3.5 w-3.5 text-amber-400" />
                                <span>Elbise Askılığı</span>
                              </div>
                            </label>
                          </div>
                        </div>

                        {/* Bölme Açık Niş / Cihaz Boşluğu */}
                        <div className="pt-2 border-t border-slate-800/60">
                          <div className="flex items-center justify-between mb-1.5">
                            <span className="text-[11px] font-semibold text-slate-300">Bölme İçi Açık Niş / Cihaz</span>
                            {((currentZone.niche_height_mm ?? currentZone.appliance_niche_height_mm ?? 0) > 0) && (
                              <button
                                type="button"
                                onClick={() => updateZone({ niche_height_mm: 0, appliance_niche_height_mm: 0, niche_bottom_offset_mm: 0 })}
                                className="text-[10px] text-red-400 hover:text-red-300"
                              >
                                Nişi Kaldır
                              </button>
                            )}
                          </div>
                          <div className="grid grid-cols-2 gap-2">
                            <div>
                              <label className="block text-[10px] text-slate-400 mb-0.5">Niş Yüksekliği (mm)</label>
                              <input
                                type="number"
                                min={0}
                                max={2000}
                                value={currentZone.niche_height_mm ?? currentZone.appliance_niche_height_mm ?? 0}
                                onChange={(e) => {
                                  const val = Number(e.target.value);
                                  updateZone({ niche_height_mm: val, appliance_niche_height_mm: val });
                                }}
                                placeholder="0 = Nişsiz"
                                className="w-full rounded-lg border border-slate-700 bg-slate-950 px-2 py-1 font-mono text-xs text-slate-100"
                              />
                            </div>
                            <div>
                              <label className="block text-[10px] text-slate-400 mb-0.5">Tabandan Kot (mm)</label>
                              <input
                                type="number"
                                min={0}
                                max={2000}
                                value={currentZone.niche_bottom_offset_mm ?? 0}
                                onChange={(e) => updateZone({ niche_bottom_offset_mm: Number(e.target.value) })}
                                placeholder="0 = Alt Niş"
                                className="w-full rounded-lg border border-slate-700 bg-slate-950 px-2 py-1 font-mono text-xs text-slate-100"
                              />
                            </div>
                          </div>
                          {((currentZone.niche_height_mm ?? currentZone.appliance_niche_height_mm ?? 0) > 0) && (
                            <div className="mt-2 flex items-center justify-between">
                              <label className="flex items-center gap-1.5 text-[11px] text-slate-300 cursor-pointer">
                                <input
                                  type="checkbox"
                                  checked={Boolean(currentZone.niche_back_open)}
                                  onChange={(e) => updateZone({ niche_back_open: e.target.checked })}
                                  className="rounded border-slate-700 bg-slate-900 text-amber-500"
                                />
                                Arkalık Açık (Priz/Hava)
                              </label>
                              <div className="flex items-center gap-1">
                                <span className="text-[10px] text-slate-400">Aksan:</span>
                                <input
                                  type="color"
                                  value={currentZone.niche_color_hex || "#9C6644"}
                                  onChange={(e) => updateZone({ niche_color_hex: e.target.value })}
                                  className="h-5 w-5 rounded cursor-pointer border-0 bg-transparent p-0"
                                  title="Açık Niş Aksan Rengi"
                                />
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })()}
                </div>
              )}
            </div>
          )}
        </div>

        {/* GRUP 3: Tek Gövde Kapak, Çekmece & Raf (Bölmesiz Mod) */}
        <div className="rounded-xl border border-slate-800/90 bg-slate-950/60 overflow-hidden">
          <button
            type="button"
            onClick={() => toggleSection("doors_drawers")}
            className="flex w-full items-center justify-between px-3 py-2.5 text-xs font-bold text-slate-200 hover:bg-slate-900/60 transition"
          >
            <div className="flex items-center gap-2">
              <DoorOpen className="h-4 w-4 text-emerald-400" />
              <span>
                3. Genel Kapak, Çekmece &amp; Raflar
                {activeModule.zones && activeModule.zones.length > 1
                  ? " (İç Bölmeler Devrede)"
                  : ""}
              </span>
            </div>
            {openSections.doors_drawers ? (
              <ChevronDown className="h-4 w-4 text-slate-400" />
            ) : (
              <ChevronRight className="h-4 w-4 text-slate-400" />
            )}
          </button>

          {openSections.doors_drawers && (
            <div className="p-3 pt-1 space-y-3 border-t border-slate-800/60 text-xs">
              {activeModule.zones && activeModule.zones.length > 1 && (
                <div className="rounded-lg bg-amber-500/10 border border-amber-500/30 p-2 text-[11px] text-amber-300">
                  Bu modülde <strong>{activeModule.zones.length} dikey bölme</strong> tanımlı.
                  Raflar, kapaklar ve çekmeceler yukarıdaki <em>2. İç Bölmeler &amp; Dikmeler</em> sekmesinden bölme bazlı yönetilmektedir.
                </div>
              )}
              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label className="block text-slate-300 font-medium mb-1">
                    Kapak Modu
                  </label>
                  <select
                    value={activeModule.door_type}
                    onChange={(e) =>
                      onUpdateActiveModule({
                        door_type: e.target.value as DoorType,
                      })
                    }
                    className="w-full rounded-lg border border-slate-700 bg-slate-950 px-2 py-1.5 text-xs text-slate-100"
                  >
                    <option value="double">Çift Kapak</option>
                    <option value="single_left">Tek (Sol Menteşe)</option>
                    <option value="single_right">Tek (Sağ Menteşe)</option>
                    <option value="flap_up">Kalkar Kapak (Gazlı)</option>
                    <option value="none">Kapaksız (Açık)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-slate-300 font-medium mb-1">
                    Hareketli Raf
                  </label>
                  <input
                    type="number"
                    min={0}
                    max={12}
                    value={activeModule.shelf_count}
                    onChange={(e) =>
                      onUpdateActiveModule({
                        shelf_count: Number(e.target.value),
                      })
                    }
                    className="w-full rounded-lg border border-slate-700 bg-slate-950 px-2.5 py-1.5 font-mono text-xs text-slate-100"
                  />
                </div>
              </div>

              {/* Çekmeceler */}
              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label className="block text-slate-300 font-medium mb-1">
                    Çekmece Adedi
                  </label>
                  <input
                    type="number"
                    min={0}
                    max={6}
                    value={activeModule.drawer_count ?? 0}
                    onChange={(e) =>
                      onUpdateActiveModule({
                        drawer_count: Number(e.target.value),
                      })
                    }
                    className="w-full rounded-lg border border-slate-700 bg-slate-950 px-2.5 py-1.5 font-mono text-xs text-slate-100"
                  />
                </div>

                <div>
                  <label className="block text-slate-300 font-medium mb-1">
                    Klapa Boyu
                  </label>
                  <input
                    type="number"
                    min={120}
                    max={350}
                    value={activeModule.drawer_front_height_mm ?? 180}
                    onChange={(e) =>
                      onUpdateActiveModule({
                        drawer_front_height_mm: Number(e.target.value),
                      })
                    }
                    className="w-full rounded-lg border border-slate-700 bg-slate-950 px-2.5 py-1.5 font-mono text-xs text-slate-100"
                  />
                </div>
              </div>
            </div>
          )}
        </div>

        {/* GRUP 4: Bağlantı Elemanı & CNC */}
        <div className="rounded-xl border border-slate-800/90 bg-slate-950/60 overflow-hidden">
          <button
            type="button"
            onClick={() => toggleSection("fasteners")}
            className="flex w-full items-center justify-between px-3 py-2.5 text-xs font-bold text-slate-200 hover:bg-slate-900/60 transition"
          >
            <div className="flex items-center gap-2">
              <Wrench className="h-4 w-4 text-amber-400" />
              <span>4. Bağlantı Sistemi &amp; CNC</span>
            </div>
            {openSections.fasteners ? (
              <ChevronDown className="h-4 w-4 text-slate-400" />
            ) : (
              <ChevronRight className="h-4 w-4 text-slate-400" />
            )}
          </button>

          {openSections.fasteners && (
            <div className="p-3 pt-1 space-y-3 border-t border-slate-800/60 text-xs">
              <div>
                <label className="block text-slate-300 font-medium mb-1">
                  Gövde Birleştirme Sistemi
                </label>
                <select
                  value={activeModule.fastener_type ?? "minifix_dowel"}
                  onChange={(e) =>
                    onUpdateActiveModule({
                      fastener_type: e.target.value as FastenerType,
                    })
                  }
                  className="w-full rounded-lg border border-slate-700 bg-slate-950 px-2.5 py-1.5 text-slate-100"
                >
                  <option value="cabineo_12">
                    Lamello Cabineo 12 (Saf Z-Ekseni 3-Eksen CNC)
                  </option>
                  <option value="minifix_dowel">
                    Minifiks + Kavela (Sistem 32 Yatay Delik)
                  </option>
                </select>
              </div>

              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label className="block text-slate-300 font-medium mb-1">
                    Kesim Tezgâhı
                  </label>
                  <select
                    value={activeModule.cutting_mode ?? "panel_saw"}
                    onChange={(e) =>
                      onUpdateActiveModule({
                        cutting_mode: e.target.value as CuttingMode,
                      })
                    }
                    className="w-full rounded-lg border border-slate-700 bg-slate-950 px-2 py-1.5 text-xs text-slate-100"
                  >
                    <option value="panel_saw">Yatar Daire (Giyotin)</option>
                    <option value="cnc_router">CNC Router Nesting</option>
                  </select>
                </div>

                <div>
                  <label className="block text-slate-300 font-medium mb-1">
                    Bıçak Çapı (Kerf)
                  </label>
                  <input
                    type="number"
                    min={4}
                    max={20}
                    value={activeModule.router_bit_diameter_mm ?? 10}
                    onChange={(e) =>
                      onUpdateActiveModule({
                        router_bit_diameter_mm: Number(e.target.value),
                      })
                    }
                    className="w-full rounded-lg border border-slate-700 bg-slate-950 px-2.5 py-1.5 font-mono text-xs text-slate-100"
                  />
                </div>
              </div>

              <div>
                <label className="block text-slate-300 font-medium mb-1">
                  Arkalık Tipi
                </label>
                <select
                  value={activeModule.back_panel_type ?? "grooved_8mm"}
                  onChange={(e) =>
                    onUpdateActiveModule({
                      back_panel_type: e.target.value as BackPanelType,
                    })
                  }
                  className="w-full rounded-lg border border-slate-700 bg-slate-950 px-2.5 py-1.5 text-slate-100"
                >
                  <option value="grooved_8mm">8 mm Kanala Geçme (Gömme)</option>
                  <option value="screw_on_18mm">18 mm Arkalık (Vidalı Gövde)</option>
                  <option value="none">Arkalıksız (Açık Duvar)</option>
                </select>
              </div>
            </div>
          )}
        </div>

        {/* GRUP 5: Açık Niş, Cihaz, Baza & Kertmeler */}
        <div className="rounded-xl border border-slate-800/90 bg-slate-950/60 overflow-hidden">
          <button
            type="button"
            onClick={() => toggleSection("base_notches")}
            className="flex w-full items-center justify-between px-3 py-2.5 text-xs font-bold text-slate-200 hover:bg-slate-900/60 transition"
          >
            <div className="flex items-center gap-2">
              <Layers className="h-4 w-4 text-indigo-400" />
              <span>5. Açık Niş, Cihaz &amp; Baza</span>
            </div>
            {openSections.base_notches ? (
              <ChevronDown className="h-4 w-4 text-slate-400" />
            ) : (
              <ChevronRight className="h-4 w-4 text-slate-400" />
            )}
          </button>

          {openSections.base_notches && (
            <div className="p-3 pt-1 space-y-3 border-t border-slate-800/60 text-xs">
              {/* Niş Hızlı Şablonları */}
              <div>
                <label className="block text-slate-300 font-medium mb-1.5">
                  Niş Tipi &amp; Hızlı Hazır Ayarlar
                </label>
                <div className="grid grid-cols-2 gap-1.5">
                  <button
                    type="button"
                    onClick={() =>
                      onUpdateActiveModule({
                        niche_height_mm: 0,
                        appliance_niche_height_mm: 0,
                        niche_bottom_offset_mm: 0,
                        has_plinth: true,
                      })
                    }
                    className={`px-2 py-1.5 rounded-lg border text-[11px] font-medium text-left transition ${
                      ((activeModule.niche_height_mm ?? activeModule.appliance_niche_height_mm ?? 0) === 0)
                        ? "border-amber-500 bg-amber-500/15 text-amber-300"
                        : "border-slate-800 bg-slate-900/80 text-slate-400 hover:text-slate-200"
                    }`}
                  >
                    Nişsiz Dolap
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      onUpdateActiveModule({
                        niche_height_mm: 1850,
                        appliance_niche_height_mm: 1850,
                        niche_bottom_offset_mm: 0,
                        has_plinth: false,
                        door_type: "flap_up",
                      })
                    }
                    className={`px-2 py-1.5 rounded-lg border text-[11px] font-medium text-left transition ${
                      ((activeModule.niche_height_mm ?? activeModule.appliance_niche_height_mm ?? 0) > 0 &&
                        (activeModule.niche_bottom_offset_mm ?? 0) <= 0)
                        ? "border-amber-500 bg-amber-500/15 text-amber-300"
                        : "border-slate-800 bg-slate-900/80 text-slate-400 hover:text-slate-200"
                    }`}
                  >
                    Alt Buzdolabı (185 cm)
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      onUpdateActiveModule({
                        niche_height_mm: 450,
                        appliance_niche_height_mm: 450,
                        niche_bottom_offset_mm: 850,
                        niche_color_hex: "#9C6644",
                        niche_back_open: false,
                      })
                    }
                    className={`px-2 py-1.5 rounded-lg border text-[11px] font-medium text-left transition ${
                      ((activeModule.niche_height_mm ?? activeModule.appliance_niche_height_mm ?? 0) === 450 &&
                        (activeModule.niche_bottom_offset_mm ?? 0) === 850)
                        ? "border-amber-500 bg-amber-500/15 text-amber-300"
                        : "border-slate-800 bg-slate-900/80 text-slate-400 hover:text-slate-200"
                    }`}
                  >
                    Kahve Barı / Köşesi
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      onUpdateActiveModule({
                        niche_height_mm: 600,
                        appliance_niche_height_mm: 600,
                        niche_bottom_offset_mm: 800,
                        niche_back_open: true,
                        niche_color_hex: "#2D3134",
                      })
                    }
                    className={`px-2 py-1.5 rounded-lg border text-[11px] font-medium text-left transition ${
                      ((activeModule.niche_height_mm ?? activeModule.appliance_niche_height_mm ?? 0) === 600)
                        ? "border-amber-500 bg-amber-500/15 text-amber-300"
                        : "border-slate-800 bg-slate-900/80 text-slate-400 hover:text-slate-200"
                    }`}
                  >
                    Ankastre Fırın (60 cm)
                  </button>
                </div>
              </div>

              {/* Parametrik Niş Ayarları */}
              {((activeModule.niche_height_mm ?? activeModule.appliance_niche_height_mm ?? 0) > 0) && (
                <div className="space-y-2.5 p-2.5 rounded-lg border border-slate-800 bg-slate-900/50">
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-slate-300 font-medium mb-1">
                        Niş Yüksekliği (mm)
                      </label>
                      <input
                        type="number"
                        min={100}
                        max={2200}
                        value={activeModule.niche_height_mm ?? activeModule.appliance_niche_height_mm ?? 0}
                        onChange={(e) => {
                          const val = Number(e.target.value);
                          onUpdateActiveModule({
                            niche_height_mm: val,
                            appliance_niche_height_mm: val,
                          });
                        }}
                        className="w-full rounded-lg border border-slate-700 bg-slate-950 px-2.5 py-1.5 font-mono text-slate-100"
                      />
                    </div>
                    <div>
                      <label className="block text-slate-300 font-medium mb-1">
                        Tabandan Kot (mm)
                      </label>
                      <input
                        type="number"
                        min={0}
                        max={2200}
                        value={activeModule.niche_bottom_offset_mm ?? 0}
                        onChange={(e) =>
                          onUpdateActiveModule({
                            niche_bottom_offset_mm: Number(e.target.value),
                          })
                        }
                        placeholder="0 = Alt Niş"
                        className="w-full rounded-lg border border-slate-700 bg-slate-950 px-2.5 py-1.5 font-mono text-slate-100"
                      />
                    </div>
                  </div>

                  <div className="flex items-center justify-between pt-1">
                    <label className="flex items-center gap-2 text-slate-300 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={activeModule.niche_back_open ?? false}
                        onChange={(e) =>
                          onUpdateActiveModule({
                            niche_back_open: e.target.checked,
                          })
                        }
                        className="rounded border-slate-700 bg-slate-950 text-amber-500"
                      />
                      <span>Arkalık Açık (Priz/Havalandırma)</span>
                    </label>
                  </div>

                  <div className="pt-1 flex items-center justify-between">
                    <span className="text-slate-300 font-medium">Niş Aksan Rengi:</span>
                    <div className="flex items-center gap-2">
                      <input
                        type="color"
                        value={activeModule.niche_color_hex || "#9C6644"}
                        onChange={(e) =>
                          onUpdateActiveModule({
                            niche_color_hex: e.target.value,
                          })
                        }
                        className="h-6 w-7 rounded cursor-pointer border-0 bg-transparent p-0"
                        title="Niş Aksan Rengi"
                      />
                      <input
                        type="text"
                        value={activeModule.niche_color_hex || ""}
                        onChange={(e) =>
                          onUpdateActiveModule({
                            niche_color_hex: e.target.value,
                          })
                        }
                        placeholder="#9C6644"
                        className="w-20 rounded-lg border border-slate-700 bg-slate-950 px-2 py-1 font-mono text-xs text-slate-100 uppercase"
                      />
                    </div>
                  </div>
                </div>
              )}

              <div>
                <label className="block text-slate-300 font-medium mb-1">
                  Baza / Ayak Sistemi
                </label>
                <select
                  value={activeModule.plinth_type ?? "wood_plinth"}
                  onChange={(e) =>
                    onUpdateActiveModule({
                      plinth_type: e.target.value as PlinthType,
                    })
                  }
                  className="w-full rounded-lg border border-slate-700 bg-slate-950 px-2.5 py-1.5 text-slate-100"
                >
                  <option value="wood_plinth">Ahşap Baza Kaydı (Standart)</option>
                  <option value="adjustable_legs">4× Ayarlı Plastik Ayak</option>
                </select>
              </div>

              <div className="space-y-1.5 pt-1">
                <label className="flex items-center gap-2 text-slate-300">
                  <input
                    type="checkbox"
                    checked={activeModule.has_baseboard_notch ?? false}
                    onChange={(e) =>
                      onUpdateActiveModule({
                        has_baseboard_notch: e.target.checked,
                      })
                    }
                    className="rounded border-slate-700 bg-slate-950 text-amber-500"
                  />
                  Süpürgelik Kertmesi (80×15 mm)
                </label>
                <label className="flex items-center gap-2 text-slate-300">
                  <input
                    type="checkbox"
                    checked={activeModule.has_column_notch ?? false}
                    onChange={(e) =>
                      onUpdateActiveModule({
                        has_column_notch: e.target.checked,
                      })
                    }
                    className="rounded border-slate-700 bg-slate-950 text-amber-500"
                  />
                  Arka Kolon Kertmesi (120×120 mm)
                </label>

                {/* Faz 4: Çatı Eğimi & Merdiven Altı */}
                <div className="pt-2 border-t border-slate-800/60 space-y-2">
                  <label className="flex items-center gap-2 text-slate-300 font-semibold cursor-pointer">
                    <input
                      type="checkbox"
                      checked={activeModule.has_slope ?? false}
                      onChange={(e) => {
                        const checked = e.target.checked;
                        const startH =
                          activeModule.slope_start_height_mm ||
                          Math.max(400, activeModule.height_mm - 600);
                        const delta = Math.abs(activeModule.height_mm - startH);
                        const angle =
                          Math.round(
                            Math.atan2(delta, activeModule.width_mm) *
                              (180 / Math.PI) *
                              10
                          ) / 10;
                        onUpdateActiveModule({
                          has_slope: checked,
                          slope_side: activeModule.slope_side || "left",
                          slope_start_height_mm: startH,
                          slope_angle_deg: angle,
                        });
                      }}
                      className="rounded border-slate-700 bg-slate-950 text-indigo-500"
                    />
                    <span>Çatı Eğimi &amp; Merdiven Altı (Mansard)</span>
                  </label>

                  {activeModule.has_slope && (
                    <div className="space-y-2 text-[11px] bg-slate-900/60 p-2.5 rounded-lg border border-slate-800">
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className="block text-slate-400 mb-0.5">Eğimli Taraf</label>
                          <select
                            value={activeModule.slope_side || "left"}
                            onChange={(e) =>
                              onUpdateActiveModule({
                                slope_side: e.target.value as "left" | "right",
                              })
                            }
                            className="w-full rounded border border-slate-700 bg-slate-950 px-2 py-1 text-slate-200"
                          >
                            <option value="left">Sol Alçak</option>
                            <option value="right">Sağ Alçak</option>
                          </select>
                        </div>
                        <div>
                          <label className="block text-slate-400 mb-0.5">Alçak Boy (mm)</label>
                          <input
                            type="number"
                            min={300}
                            max={activeModule.height_mm - 100}
                            step={10}
                            value={activeModule.slope_start_height_mm || 1200}
                            onChange={(e) => {
                              const val = parseFloat(e.target.value) || 1200;
                              const delta = Math.abs(activeModule.height_mm - val);
                              const angle =
                                Math.round(
                                  Math.atan2(delta, activeModule.width_mm) *
                                    (180 / Math.PI) *
                                    10
                                ) / 10;
                              onUpdateActiveModule({
                                slope_start_height_mm: val,
                                slope_angle_deg: angle,
                              });
                            }}
                            className="w-full rounded border border-slate-700 bg-slate-950 px-2 py-1 text-slate-200"
                          />
                        </div>
                      </div>
                      <div className="flex items-center justify-between text-indigo-300 font-mono text-[10px]">
                        <span>Açı: ~{activeModule.slope_angle_deg || 35}°</span>
                        <span>Fark: {Math.abs(activeModule.height_mm - (activeModule.slope_start_height_mm || 1200))} mm</span>
                      </div>
                    </div>
                  )}
                </div>

                {/* Faz 4: L-Köşe Modülü */}
                <div className="pt-2 border-t border-slate-800/60 space-y-2">
                  <label className="flex items-center gap-2 text-slate-300 font-semibold cursor-pointer">
                    <input
                      type="checkbox"
                      checked={activeModule.is_corner_module ?? false}
                      onChange={(e) =>
                        onUpdateActiveModule({
                          is_corner_module: e.target.checked,
                          corner_angle_deg: 90.0,
                          corner_blind_width_mm:
                            activeModule.corner_blind_width_mm || 100.0,
                        })
                      }
                      className="rounded border-slate-700 bg-slate-950 text-indigo-500"
                    />
                    <span>L-Köşe Modülü (90° Kör Panelli)</span>
                  </label>

                  {activeModule.is_corner_module && (
                    <div className="space-y-1.5 text-[11px] bg-slate-900/60 p-2.5 rounded-lg border border-slate-800">
                      <div>
                        <label className="block text-slate-400 mb-0.5">Kör Kapama Paneli (mm)</label>
                        <input
                          type="number"
                          min={40}
                          max={300}
                          step={10}
                          value={activeModule.corner_blind_width_mm || 100}
                          onChange={(e) =>
                            onUpdateActiveModule({
                              corner_blind_width_mm: parseFloat(e.target.value) || 100,
                            })
                          }
                          className="w-full rounded border border-slate-700 bg-slate-950 px-2 py-1 text-slate-200"
                        />
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* GRUP 6: Malzeme & Renkler */}
        <div className="rounded-xl border border-slate-800/90 bg-slate-950/60 overflow-hidden">
          <button
            type="button"
            onClick={() => toggleSection("materials")}
            className="flex w-full items-center justify-between px-3 py-2.5 text-xs font-bold text-slate-200 hover:bg-slate-900/60 transition"
          >
            <div className="flex items-center gap-2">
              <Paintbrush className="h-4 w-4 text-purple-400" />
              <span>6. Malzeme, Renk &amp; Plaka</span>
            </div>
            {openSections.materials ? (
              <ChevronDown className="h-4 w-4 text-slate-400" />
            ) : (
              <ChevronRight className="h-4 w-4 text-slate-400" />
            )}
          </button>

          {openSections.materials && (
            <div className="p-3 pt-1 space-y-3 border-t border-slate-800/60 text-xs">
              <div>
                <label className="block text-slate-300 font-medium mb-1">
                  Standart Plaka Ebadı
                </label>
                <select
                  value={config.sheet_size}
                  onChange={(e) =>
                    onUpdateGlobalConfig({
                      sheet_size: e.target.value as SheetSizeOption,
                    })
                  }
                  className="w-full rounded-lg border border-slate-700 bg-slate-950 px-2.5 py-1.5 text-slate-100"
                >
                  <option value="2800x2100">2800 × 2100 mm (Standart)</option>
                  <option value="3660x1830">3660 × 1830 mm (Jumbo)</option>
                </select>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-slate-300 font-medium mb-1">
                    Gövde Rengi
                  </label>
                  <div className="flex items-center gap-2">
                    <input
                      type="color"
                      value={activeModule.body_color_hex}
                      onChange={(e) =>
                        onUpdateActiveModule({ body_color_hex: e.target.value })
                      }
                      className="h-7 w-9 cursor-pointer rounded border border-slate-700 bg-slate-950"
                    />
                    <span className="font-mono text-[11px] text-slate-400">
                      {activeModule.body_color_hex}
                    </span>
                  </div>
                </div>

                <div>
                  <label className="block text-slate-300 font-medium mb-1">
                    Kapak Rengi
                  </label>
                  <div className="flex items-center gap-2">
                    <input
                      type="color"
                      value={activeModule.door_color_hex}
                      onChange={(e) =>
                        onUpdateActiveModule({ door_color_hex: e.target.value })
                      }
                      className="h-7 w-9 cursor-pointer rounded border border-slate-700 bg-slate-950"
                    />
                    <span className="font-mono text-[11px] text-slate-400">
                      {activeModule.door_color_hex}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </form>

      {/* Sticky Bottom Action Button */}
      <div className="border-t border-slate-800 bg-slate-950/90 p-3 rounded-b-2xl">
        <button
          type="button"
          disabled={isGenerating}
          onClick={onSubmit}
          className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-sky-600 to-indigo-600 px-4 py-2.5 text-xs font-bold text-white shadow-lg shadow-sky-600/25 transition hover:from-sky-500 hover:to-indigo-500 disabled:opacity-50"
        >
          {isGenerating ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Cpu className="h-4 w-4" />
          )}
          <span>⚡ Anında Güncelle &amp; Hesapla</span>
        </button>
      </div>

      {/* Hatta Yeni Modül / Ürün Ekleme Seçim Listesi Modalı */}
      <AddModuleModal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        activeModule={activeModule}
        activeModuleIndex={safeIdx}
        onSelectOption={(optionConfig) => {
          onAddModule(optionConfig);
          setIsAddModalOpen(false);
        }}
      />
    </aside>
  );
}
