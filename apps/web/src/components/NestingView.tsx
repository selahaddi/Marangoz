import { useState } from "react";
import { Layers, Scissors } from "lucide-react";
import type { NestingResult } from "../types/cabinet";

interface NestingViewProps {
  nesting: NestingResult;
}

export function NestingView({ nesting }: NestingViewProps) {
  const [activeSheetIdx, setActiveSheetIdx] = useState<number>(0);
  const currentSheet = nesting.sheets[activeSheetIdx] ?? nesting.sheets[0];

  return (
    <div className="space-y-4">
      {/* Üst Özet Bilgi Çubuğu */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="rounded-xl border border-slate-800 bg-slate-900/80 p-3">
          <span className="text-xs text-slate-400">Standart Plaka Ebadı</span>
          <p className="mt-1 text-base font-bold text-slate-100">
            {nesting.sheet_width_mm} × {nesting.sheet_height_mm} mm
          </p>
        </div>
        <div className="rounded-xl border border-slate-800 bg-slate-900/80 p-3">
          <span className="text-xs text-slate-400">Testere Talaş Payı (Kerf)</span>
          <p className="mt-1 text-base font-bold text-amber-400">
            {nesting.kerf_mm.toFixed(1)} mm (Giyotin Kesim)
          </p>
        </div>
        <div className="rounded-xl border border-slate-800 bg-slate-900/80 p-3">
          <span className="text-xs text-slate-400">Toplam Plaka İhtiyacı</span>
          <p className="mt-1 text-base font-bold text-sky-400">
            {nesting.total_sheets} Plaka
          </p>
        </div>
        <div className="rounded-xl border border-slate-800 bg-slate-900/80 p-3">
          <span className="text-xs text-slate-400">Genel Verimlilik / Fire</span>
          <p className="mt-1 text-base font-bold text-emerald-400">
            %{nesting.overall_efficiency_percentage.toFixed(1)} Verim (Fire: %
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
          <div className="mb-2 flex items-center justify-between text-xs text-slate-400">
            <span className="flex items-center gap-1.5 font-medium text-slate-300">
              <Scissors className="h-3.5 w-3.5 text-sky-400" />
              Plaka #{currentSheet.sheet_index} Giyotin Kesim Planı — Kullanılan:{" "}
              {currentSheet.used_area_m2.toFixed(2)} m² | Fire:{" "}
              {currentSheet.waste_area_m2.toFixed(2)} m²
            </span>
            <span>Kenar Temizlik Payı: {currentSheet.trim_margin_mm} mm</span>
          </div>
          <div
            className="w-full overflow-x-auto"
            dangerouslySetInnerHTML={{ __html: currentSheet.svg_content }}
          />
        </div>
      )}
    </div>
  );
}

