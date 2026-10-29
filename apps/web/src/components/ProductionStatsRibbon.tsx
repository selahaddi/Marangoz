import { useMemo } from "react";
import {
  Box,
  Calculator,
  Clock,
  Layers,
  LayoutGrid,
  Scissors,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import type { CabinetConfig, ProductionPackageResponse } from "../types/cabinet";

interface ProductionStatsRibbonProps {
  pkg: ProductionPackageResponse | null;
  config: CabinetConfig;
  onOpenTemplates: () => void;
  onOpenSketch: () => void;
}

export function ProductionStatsRibbon({
  pkg,
  config,
  onOpenTemplates,
  onOpenSketch,
}: ProductionStatsRibbonProps) {
  const allModules = [config, ...(config.additional_modules ?? [])];
  const totalWidthMm = allModules.reduce((acc, m) => acc + m.width_mm, 0);
  const maxHeightMm = Math.max(...allModules.map((m) => m.height_mm));
  const maxDepthMm = Math.max(...allModules.map((m) => m.depth_mm));

  const metrics = useMemo(() => {
    if (!pkg) return null;

    const bom = pkg.bom;
    const nesting = pkg.nesting;

    const partsCount = bom.total_parts_count || bom.parts.length;
    const sheetsCount = nesting.sheets.length;
    const wastePct = (
      nesting.effective_waste_percentage ??
      nesting.overall_waste_percentage ??
      0
    ).toFixed(1);

    const pvc2m = (bom.total_pvc_20_meters || 0).toFixed(1);
    const pvc04m = (bom.total_pvc_04_meters || 0).toFixed(1);

    // CNC dakika hesabı
    const isRouter = bom.config.cutting_mode === "cnc_router";
    const totalGrooves = bom.parts.reduce(
      (acc, p) => acc + p.grooves.length * p.quantity,
      0
    );
    const estMinutes = Math.max(
      8,
      Math.round(
        (bom.total_cut_area_m2 * 2.8) / (isRouter ? 3.5 : 6.0) +
          (bom.total_drill_count * 2.2) / 60.0 +
          (totalGrooves * 18.0) / 60.0 +
          sheetsCount * 3.5
      )
    );

    // Yaklaşık maliyet tahmini
    const approxSheetCost = sheetsCount * 1750;
    const approxPvcCost = (bom.total_pvc_20_meters * 18) + (bom.total_pvc_04_meters * 8);
    const approxHdwCost = bom.hardware.reduce((a, b) => a + b.quantity * 15, 0);
    const approxTotal = Math.round((approxSheetCost + approxPvcCost + approxHdwCost + estMinutes * 25) * 1.35 * 1.2);

    return {
      partsCount,
      sheetsCount,
      wastePct,
      pvc2m,
      pvc04m,
      estMinutes,
      approxTotal: approxTotal.toLocaleString("tr-TR"),
    };
  }, [pkg]);

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-800/90 bg-slate-900/95 px-4 py-2.5 shadow-xl backdrop-blur-md">
      {/* Sol Grup: Canlı Metrik Rozetleri */}
      <div className="flex flex-wrap items-center gap-2.5 sm:gap-4 text-xs">
        {/* Boyut Rozeti */}
        <div className="flex items-center gap-1.5 text-slate-300">
          <Box className="h-4 w-4 text-sky-400" />
          <span className="text-slate-400 hidden sm:inline">Hat:</span>
          <span className="font-mono font-bold text-white">
            {totalWidthMm} × {maxHeightMm} × {maxDepthMm} mm
          </span>
          {allModules.length > 1 && (
            <span className="rounded bg-indigo-500/20 px-1.5 py-0.5 font-semibold text-[10px] text-indigo-300 border border-indigo-500/30">
              {allModules.length} Modül
            </span>
          )}
        </div>

        <div className="hidden h-4 w-px bg-slate-800 md:block" />

        {/* Parça Sayısı */}
        <div className="flex items-center gap-1.5 text-slate-300">
          <Layers className="h-4 w-4 text-indigo-400" />
          <span className="text-slate-400 hidden sm:inline">Parça:</span>
          <span className="font-mono font-bold text-white">
            {metrics ? `${metrics.partsCount} Adet` : "-"}
          </span>
        </div>

        <div className="hidden h-4 w-px bg-slate-800 md:block" />

        {/* Plaka & Fire */}
        <div className="flex items-center gap-1.5 text-slate-300">
          <Scissors className="h-4 w-4 text-emerald-400" />
          <span className="text-slate-400 hidden sm:inline">Plaka / Fire:</span>
          <span className="font-mono font-bold text-emerald-300">
            {metrics ? `${metrics.sheetsCount} Plaka (%${metrics.wastePct})` : "-"}
          </span>
        </div>

        <div className="hidden h-4 w-px bg-slate-800 lg:block" />

        {/* PVC Bandı */}
        <div className="hidden lg:flex items-center gap-1.5 text-slate-300">
          <span className="text-slate-400">PVC:</span>
          <span className="font-mono font-semibold text-slate-200">
            {metrics ? `2mm: ${metrics.pvc2m}m · 0.4mm: ${metrics.pvc04m}m` : "-"}
          </span>
        </div>

        <div className="hidden h-4 w-px bg-slate-800 xl:block" />

        {/* CNC Süresi */}
        <div className="hidden xl:flex items-center gap-1.5 text-slate-300">
          <Clock className="h-4 w-4 text-amber-400" />
          <span className="text-slate-400">CNC:</span>
          <span className="font-mono font-bold text-amber-300">
            {metrics ? `~${metrics.estMinutes} dk` : "-"}
          </span>
        </div>

        <div className="hidden h-4 w-px bg-slate-800 sm:block" />

        {/* Tahmini Fiyat */}
        <div className="flex items-center gap-1.5 text-slate-300">
          <Calculator className="h-4 w-4 text-sky-400" />
          <span className="text-slate-400 hidden sm:inline">Teklif:</span>
          <span className="font-mono font-bold text-sky-300">
            {metrics ? `₺${metrics.approxTotal}` : "-"}
          </span>
        </div>

        {/* Mühendislik Sağlık Rozeti */}
        {pkg?.bom?.engineering_audit && (
          <>
            <div className="hidden h-4 w-px bg-slate-800 md:block" />
            <div
              className="flex items-center gap-1.5 text-slate-300"
              title={pkg.bom.engineering_audit.summary_messages.join(" ")}
            >
              <ShieldCheck
                className={`h-4 w-4 ${
                  pkg.bom.engineering_audit.has_critical_issues
                    ? "text-amber-400"
                    : "text-emerald-400"
                }`}
              />
              <span className="text-slate-400 hidden sm:inline">Statik:</span>
              <span
                className={`font-mono font-bold ${
                  pkg.bom.engineering_audit.has_critical_issues
                    ? "text-amber-300"
                    : "text-emerald-300"
                }`}
              >
                %{pkg.bom.engineering_audit.overall_health_score}{" "}
                {pkg.bom.engineering_audit.has_critical_issues ? "Uyarılı" : "Güvenli"}
              </span>
            </div>
          </>
        )}
      </div>

      {/* Sağ Grup: Hızlı Kütüphane ve Eskiz Butonları */}
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={onOpenTemplates}
          className="inline-flex items-center gap-1.5 rounded-xl border border-indigo-500/40 bg-indigo-600/20 px-3 py-1.5 text-xs font-bold text-indigo-300 transition hover:bg-indigo-600 hover:text-white shadow-sm"
        >
          <LayoutGrid className="h-3.5 w-3.5" />
          <span>Şablon Kütüphanesi (29)</span>
        </button>

        <button
          type="button"
          onClick={onOpenSketch}
          className="inline-flex items-center gap-1.5 rounded-xl border border-slate-700 bg-slate-800/80 px-3 py-1.5 text-xs font-semibold text-slate-200 transition hover:bg-slate-700"
        >
          <Sparkles className="h-3.5 w-3.5 text-sky-400" />
          <span>Eskiz Çizim</span>
        </button>
      </div>
    </div>
  );
}
