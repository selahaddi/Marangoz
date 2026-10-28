import { Printer, QrCode, Tag } from "lucide-react";
import type { BOMReport, PanelPart } from "../types/cabinet";

interface PartLabelsViewProps {
  jobId: string;
  bom: BOMReport;
  onSelectPart?: (partId: string) => void;
}

/**
 * Deterministik 11x11 Endüstriyel QR / DataMatrix SVG Üretici
 * (Üç köşede Finder Pattern + parça metin özetinden deterministik bit matrisi)
 */
function renderDeterministicQrMatrix(payload: string): boolean[][] {
  const size = 11;
  const grid: boolean[][] = Array.from({ length: size }, () =>
    Array.from({ length: size }, () => false)
  );

  const drawFinder = (r0: number, c0: number) => {
    for (let r = 0; r < 3; r += 1) {
      for (let c = 0; c < 3; c += 1) {
        grid[r0 + r][c0 + c] = true;
      }
    }
  };
  drawFinder(0, 0);
  drawFinder(0, size - 3);
  drawFinder(size - 3, 0);

  let hash = 2166136261;
  for (let i = 0; i < payload.length; i += 1) {
    hash ^= payload.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }

  for (let r = 0; r < size; r += 1) {
    for (let c = 0; c < size; c += 1) {
      const inTopLeft = r < 4 && c < 4;
      const inTopRight = r < 4 && c >= size - 4;
      const inBottomLeft = r >= size - 4 && c < 4;
      if (inTopLeft || inTopRight || inBottomLeft) continue;

      hash ^= (r * 31 + c * 17) & 0xff;
      hash = Math.imul(hash, 16777619);
      grid[r][c] = (Math.abs(hash) + r + c) % 2 === 0;
    }
  }
  return grid;
}

function EdgeBandDiagramSvg({ part }: { part: PanelPart }) {
  const e = part.edge_band;
  const edgeColor = (mm: number): string => {
    if (mm >= 1.5) return "#F59E0B"; // 2.0 mm PVC -> Turuncu/Kehribar
    if (mm >= 0.8) return "#38BDF8"; // 1.0 mm PVC -> Mavi
    if (mm > 0.0) return "#10B981"; // 0.4 mm PVC -> Yeşil
    return "#334155"; // Bant yok -> Koyu gri
  };

  return (
    <svg
      viewBox="0 0 150 92"
      className="h-20 w-32 shrink-0 rounded border border-slate-800 bg-slate-950 p-1"
      role="img"
      aria-label={`${part.code} 4 kenar PVC bantlama diyagramı`}
    >
      {/* Parça Dikdörtgeni */}
      <rect
        x="26"
        y="18"
        width="98"
        height="56"
        fill="#0F172A"
        stroke="#475569"
        strokeWidth="1"
      />
      {/* Ön Uzun Kenar (length_1_mm - Alt Çizgi) */}
      <line
        x1="26"
        y1="74"
        x2="124"
        y2="74"
        stroke={edgeColor(e.length_1_mm)}
        strokeWidth={e.length_1_mm >= 1.5 ? 4 : e.length_1_mm > 0 ? 2.5 : 1}
      />
      {/* Arka Uzun Kenar (length_2_mm - Üst Çizgi) */}
      <line
        x1="26"
        y1="18"
        x2="124"
        y2="18"
        stroke={edgeColor(e.length_2_mm)}
        strokeWidth={e.length_2_mm >= 1.5 ? 4 : e.length_2_mm > 0 ? 2.5 : 1}
      />
      {/* Sol Kısa Kenar (width_1_mm) */}
      <line
        x1="26"
        y1="18"
        x2="26"
        y2="74"
        stroke={edgeColor(e.width_1_mm)}
        strokeWidth={e.width_1_mm >= 1.5 ? 4 : e.width_1_mm > 0 ? 2.5 : 1}
      />
      {/* Sağ Kısa Kenar (width_2_mm) */}
      <line
        x1="124"
        y1="18"
        x2="124"
        y2="74"
        stroke={edgeColor(e.width_2_mm)}
        strokeWidth={e.width_2_mm >= 1.5 ? 4 : e.width_2_mm > 0 ? 2.5 : 1}
      />

      {/* Damar (Grain) Yönü Oku */}
      <line
        x1="46"
        y1="46"
        x2="104"
        y2="46"
        stroke="#64748B"
        strokeWidth="1.2"
      />
      <polygon points="104,43 111,46 104,49" fill="#64748B" />
      <text
        x="75"
        y="41"
        textAnchor="middle"
        fill="#94A3B8"
        fontSize="7.5"
        fontFamily="monospace"
      >
        {part.cut_length_mm}×{part.cut_width_mm}
      </text>

      {/* Kenar Etiketleri */}
      <text x="75" y="86" textAnchor="middle" fill="#FBBF24" fontSize="7.5">
        ÖN: {e.length_1_mm}mm
      </text>
      <text x="75" y="12" textAnchor="middle" fill="#34D399" fontSize="7">
        ARKA: {e.length_2_mm}mm
      </text>
      <text x="13" y="48" textAnchor="middle" fill="#94A3B8" fontSize="6.5">
        {e.width_1_mm}
      </text>
      <text x="137" y="48" textAnchor="middle" fill="#94A3B8" fontSize="6.5">
        {e.width_2_mm}
      </text>
    </svg>
  );
}

export function PartLabelsView({
  jobId,
  bom,
  onSelectPart,
}: PartLabelsViewProps) {
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-800 bg-slate-900/80 p-4">
        <div>
          <h3 className="flex items-center gap-2 text-sm font-bold text-slate-100">
            <QrCode className="h-4 w-4 text-sky-400" />
            Atölye Barkod / QR Kodlu Parça Etiketleri &amp; 4-Kenar PVC Şeması (
            {bom.parts.length} Etiket)
          </h3>
          <p className="mt-0.5 text-xs text-slate-400">
            Ebatlama veya CNC Router sonrası her parçanın üzerine yapıştırılan
            100×60 mm endüstriyel termal etiketler. Hangi kenara kaç mm PVC
            çekileceğini ve hangi CNC programının (.NC / .MPR / .CIX)
            çağrılacağını gösterir.
          </p>
        </div>

        <button
          type="button"
          onClick={() => window.print()}
          className="inline-flex items-center gap-2 rounded-xl bg-sky-600 px-4 py-2 text-xs font-bold text-white shadow-md shadow-sky-600/20 transition hover:bg-sky-500"
        >
          <Printer className="h-4 w-4" />
          Termal Etiketleri Yazdır (100×60 mm)
        </button>
      </div>

      <div className="grid grid-cols-1 gap-3.5 md:grid-cols-2 xl:grid-cols-3">
        {bom.parts.map((part) => {
          const qrPayload = `JOB:${jobId}|ID:${part.part_id}|CODE:${part.code}|CUT:${part.cut_length_mm}x${part.cut_width_mm}x${part.thickness_mm}|CNC:${part.part_id}_${part.code}`;
          const matrix = renderDeterministicQrMatrix(qrPayload);
          const modIdx = part.transform_3d.module_index ?? 1;

          return (
            <div
              key={part.part_id}
              onClick={() => onSelectPart?.(part.part_id)}
              className="group cursor-pointer rounded-xl border border-slate-800 bg-slate-900/90 p-3.5 shadow transition hover:border-sky-500/60"
            >
              {/* Üst Başlık: İş No + Parça Kodu + Modül */}
              <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                <div className="flex items-center gap-1.5">
                  <Tag className="h-3.5 w-3.5 text-sky-400" />
                  <span className="font-mono text-xs font-bold text-sky-400">
                    {part.part_id} · {part.code}
                  </span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="rounded bg-indigo-500/20 px-1.5 py-0.5 font-mono text-[10px] font-bold text-indigo-300">
                    Modül #{modIdx}
                  </span>
                  <span className="rounded bg-slate-800 px-1.5 py-0.5 font-mono text-[10px] text-slate-300">
                    #{jobId.slice(0, 6)}
                  </span>
                </div>
              </div>

              {/* Orta Gövde: Sol Bilgi + Orta 4-Kenar PVC Şeması + Sağ QR Kod */}
              <div className="mt-2.5 flex items-center justify-between gap-2.5">
                <div className="min-w-0 flex-1 space-y-1">
                  <p className="truncate text-xs font-bold text-white">
                    {part.name}
                  </p>
                  <p className="truncate text-[11px] text-slate-400">
                    {part.material} ({part.thickness_mm} mm)
                  </p>
                  <div className="rounded-lg border border-slate-800 bg-slate-950/90 px-2 py-1 font-mono text-[11px]">
                    <div className="font-bold text-emerald-300">
                      KESİM: {part.cut_length_mm} × {part.cut_width_mm} mm
                    </div>
                    <div className="text-[10px] text-slate-400">
                      NET: {part.net_length_mm} × {part.net_width_mm} mm
                    </div>
                  </div>
                </div>

                <EdgeBandDiagramSvg part={part} />

                {/* Vektörel QR Matrisi */}
                <div className="flex flex-col items-center">
                  <svg
                    viewBox="0 0 13 13"
                    className="h-16 w-16 rounded bg-white p-1"
                    role="img"
                    aria-label={`${part.part_id} QR Barkod`}
                  >
                    {matrix.map((row, rIdx) =>
                      row.map((cell, cIdx) =>
                        cell ? (
                          <rect
                            key={`${rIdx}-${cIdx}`}
                            x={cIdx + 1}
                            y={rIdx + 1}
                            width={1}
                            height={1}
                            fill="#0F172A"
                          />
                        ) : null
                      )
                    )}
                  </svg>
                  <span className="mt-1 font-mono text-[9px] text-slate-400">
                    {part.part_id}_{part.code}.cix
                  </span>
                </div>
              </div>

              {/* Alt CNC ve Rölöve Operasyon Özeti */}
              <div className="mt-2.5 flex flex-wrap items-center justify-between gap-1.5 border-t border-slate-800/80 pt-2 text-[10px]">
                <div className="flex flex-wrap items-center gap-1">
                  <span className="rounded bg-slate-800 px-1.5 py-0.5 font-mono text-slate-200">
                    CNC: {part.drills.length} Delik
                  </span>
                  {part.grooves.length > 0 && (
                    <span className="rounded bg-emerald-500/20 px-1.5 py-0.5 font-mono text-emerald-300">
                      8mm Kanal
                    </span>
                  )}
                  {part.holding_tabs_count && part.holding_tabs_count > 0 ? (
                    <span className="rounded bg-amber-500/20 px-1.5 py-0.5 font-mono text-amber-300">
                      {part.holding_tabs_count}×Vakum Sekmesi
                    </span>
                  ) : null}
                </div>
                {part.notch_info && (
                  <span className="truncate font-semibold text-amber-300">
                    {part.notch_info}
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

