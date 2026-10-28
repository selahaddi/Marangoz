import { useState } from "react";
import { Archive, Check, Layers, Plus, Scissors, Trash2 } from "lucide-react";
import type { NestingResult, RemnantStockItem } from "../types/cabinet";

interface NestingViewProps {
  nesting: NestingResult;
}

const REMNANT_STORAGE_KEY = "marangoz_remnant_warehouse_v1";

function loadStoredRemnants(): RemnantStockItem[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(REMNANT_STORAGE_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as RemnantStockItem[];
  } catch {
    return [];
  }
}

export function NestingView({ nesting }: NestingViewProps) {
  const [activeSheetIdx, setActiveSheetIdx] = useState<number>(0);
  const [storedRemnants, setStoredRemnants] = useState<RemnantStockItem[]>(() =>
    loadStoredRemnants()
  );
  const [savedBanner, setSavedBanner] = useState<boolean>(false);

  const currentSheet = nesting.sheets[activeSheetIdx] ?? nesting.sheets[0];
  const allDetectedRemnants: RemnantStockItem[] = nesting.sheets.flatMap(
    (s) => s.remnants ?? []
  );
  const reusableRemnantM2 =
    nesting.reusable_remnant_area_m2 ??
    allDetectedRemnants.reduce((acc, r) => acc + r.area_m2, 0);
  const effectiveWastePct =
    nesting.effective_waste_percentage ?? nesting.overall_waste_percentage;

  const handleSaveRemnantsToWarehouse = () => {
    if (allDetectedRemnants.length === 0) return;
    const next = [...allDetectedRemnants, ...storedRemnants].slice(0, 30);
    setStoredRemnants(next);
    try {
      window.localStorage.setItem(REMNANT_STORAGE_KEY, JSON.stringify(next));
      setSavedBanner(true);
      window.setTimeout(() => setSavedBanner(false), 3000);
    } catch {
      // ignore storage quota errors
    }
  };

  const handleClearWarehouse = () => {
    setStoredRemnants([]);
    try {
      window.localStorage.removeItem(REMNANT_STORAGE_KEY);
    } catch {
      // ignore
    }
  };

  return (
    <div className="space-y-4">
      {/* Üst Özet Bilgi Çubuğu (Paket C: Kerf / Router Çakı + Artık Plaka Ekonomisi) */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
        <div className="rounded-xl border border-slate-800 bg-slate-900/80 p-3">
          <span className="text-xs text-slate-400">Standart Plaka Ebadı</span>
          <p className="mt-1 text-base font-bold text-slate-100">
            {nesting.sheet_width_mm} × {nesting.sheet_height_mm} mm
          </p>
        </div>
        <div className="rounded-xl border border-slate-800 bg-slate-900/80 p-3">
          <span className="text-xs text-slate-400">
            Kesim Talaş / Router Çakı Payı
          </span>
          <p className="mt-1 text-base font-bold text-amber-400">
            {nesting.kerf_mm.toFixed(1)} mm{" "}
            {nesting.kerf_mm > 5 ? "(CNC Router)" : "(Ebatlama Testere)"}
          </p>
        </div>
        <div className="rounded-xl border border-slate-800 bg-slate-900/80 p-3">
          <span className="text-xs text-slate-400">Toplam Plaka İhtiyacı</span>
          <p className="mt-1 text-base font-bold text-sky-400">
            {nesting.total_sheets} Plaka
          </p>
        </div>
        <div className="rounded-xl border border-slate-800 bg-slate-900/80 p-3">
          <span className="text-xs text-slate-400">
            Kullanılabilir Artık (≥400×600)
          </span>
          <p className="mt-1 text-base font-bold text-emerald-400">
            {reusableRemnantM2.toFixed(2)} m² ({allDetectedRemnants.length} Parça)
          </p>
        </div>
        <div className="rounded-xl border border-slate-800 bg-slate-900/80 p-3">
          <span className="text-xs text-slate-400">
            Gerçek Çöp Fire (Artık Düşülmüş)
          </span>
          <p className="mt-1 text-base font-bold text-teal-300">
            %{effectiveWastePct.toFixed(1)} Net Fire (Brüt: %
            {nesting.overall_waste_percentage.toFixed(1)})
          </p>
        </div>
      </div>

      {/* Plaka Seçim Sekmeleri */}
      <div className="flex flex-wrap items-center gap-2">
        {nesting.sheets.map((sheet, index) => (
          <button
            key={sheet.sheet_index}
            type="button"
            onClick={() => setActiveSheetIdx(index)}
            className={`flex items-center gap-2 rounded-lg border px-3.5 py-2 text-xs font-semibold transition ${
              index === activeSheetIdx
                ? "border-sky-500 bg-sky-500/20 text-sky-200"
                : "border-slate-800 bg-slate-900 text-slate-400 hover:bg-slate-800 hover:text-slate-200"
            }`}
          >
            <Layers className="h-3.5 w-3.5" />
            Plaka #{sheet.sheet_index}: {sheet.material} ({sheet.placements.length}{" "}
            Parça — Fire %{sheet.waste_percentage.toFixed(1)})
          </button>
        ))}
      </div>

      {/* Ölçekli SVG Kesim Şeması */}
      {currentSheet && (
        <div className="overflow-hidden rounded-xl border border-slate-800 bg-slate-950 p-3 shadow-lg">
          <div className="mb-2 flex flex-wrap items-center justify-between gap-2 text-xs text-slate-400">
            <span className="flex items-center gap-1.5 font-medium text-slate-300">
              <Scissors className="h-3.5 w-3.5 text-sky-400" />
              Plaka #{currentSheet.sheet_index} Kesim Planı — Kullanılan:{" "}
              {currentSheet.used_area_m2.toFixed(2)} m² | Brüt Fire:{" "}
              {currentSheet.waste_area_m2.toFixed(2)} m² | Artık Depo Parçası:{" "}
              {(currentSheet.remnants ?? []).length} Adet
            </span>
            <span>
              Kenar Temizlik Payı: {currentSheet.trim_margin_mm} mm | Kerf/Çakı:{" "}
              {currentSheet.kerf_mm.toFixed(1)} mm
            </span>
          </div>
          <div
            className="w-full overflow-x-auto"
            dangerouslySetInnerHTML={{ __html: currentSheet.svg_content }}
          />
        </div>
      )}

      {/* Sanal Artık Plaka (Remnant) Deposu Yönetimi (Paket C) */}
      <div className="rounded-xl border border-emerald-500/30 bg-slate-900/80 p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h4 className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-emerald-300">
              <Archive className="h-4 w-4 text-emerald-400" />
              Sanal Artık Plaka (Remnant) Deposu — ≥ 400 × 600 mm Yeniden
              Kullanılabilir Parçalar
            </h4>
            <p className="mt-0.5 text-[11px] text-slate-400">
              Bu kesim planından çıkan ve gelecekteki siparişlerde (çekmece
              kasası, raf, kör çıta vb.) doğrudan kullanılabilecek artık plakalar
              yeşil kesikli çizgiyle (ARTIK DEPO) işaretlenmiştir.
            </p>
          </div>
          <div className="flex items-center gap-2">
            {allDetectedRemnants.length > 0 && (
              <button
                type="button"
                onClick={handleSaveRemnantsToWarehouse}
                className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-bold text-white transition hover:bg-emerald-500"
              >
                {savedBanner ? (
                  <>
                    <Check className="h-3.5 w-3.5" />
                    Depoya Kaydedildi
                  </>
                ) : (
                  <>
                    <Plus className="h-3.5 w-3.5" />
                    Bu İşin Artıklarını Depoya Kaydet ({allDetectedRemnants.length})
                  </>
                )}
              </button>
            )}
            {storedRemnants.length > 0 && (
              <button
                type="button"
                onClick={handleClearWarehouse}
                className="inline-flex items-center gap-1 rounded-lg border border-slate-700 bg-slate-800 px-2.5 py-1.5 text-xs font-medium text-slate-300 hover:border-red-500/50 hover:text-red-300"
              >
                <Trash2 className="h-3.5 w-3.5" />
                Depoyu Temizle ({storedRemnants.length})
              </button>
            )}
          </div>
        </div>

        <div className="mt-3 grid grid-cols-1 gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
          {allDetectedRemnants.map((rem) => (
            <div
              key={rem.remnant_id}
              className="flex items-center justify-between rounded-lg border border-emerald-500/30 bg-emerald-950/25 px-3 py-2 text-xs"
            >
              <div>
                <span className="font-mono font-bold text-emerald-300">
                  {rem.remnant_id} (Plaka #{rem.sheet_index})
                </span>
                <p className="text-slate-200">{rem.material}</p>
                <p className="font-mono text-[11px] text-slate-400">
                  Konum: X={rem.x_mm}mm, Y={rem.y_mm}mm
                </p>
              </div>
              <div className="text-right font-mono">
                <span className="rounded bg-emerald-500/20 px-2 py-0.5 font-bold text-emerald-200">
                  {rem.width_mm.toFixed(0)} × {rem.height_mm.toFixed(0)} mm
                </span>
                <p className="mt-1 text-[11px] text-emerald-300">
                  {rem.area_m2.toFixed(2)} m²
                </p>
              </div>
            </div>
          ))}
        </div>

        {storedRemnants.length > 0 && (
          <div className="mt-3 border-t border-slate-800 pt-3">
            <span className="text-[11px] font-semibold text-slate-300">
              Atölye Hafızasında Kayıtlı Artık Plaka Stoku ({storedRemnants.length}{" "}
              Adet — Toplam{" "}
              {storedRemnants.reduce((a, r) => a + r.area_m2, 0).toFixed(2)} m²):
            </span>
            <div className="mt-1.5 flex flex-wrap gap-1.5">
              {storedRemnants.map((sr, i) => (
                <span
                  key={`${sr.remnant_id}-${i}`}
                  className="rounded-md border border-slate-700 bg-slate-950 px-2 py-0.5 font-mono text-[11px] text-slate-300"
                >
                  {sr.remnant_id}: {sr.width_mm.toFixed(0)}×
                  {sr.height_mm.toFixed(0)}mm ({sr.material})
                </span>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

