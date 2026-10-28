import { Download, FileCode2, Wrench } from "lucide-react";
import { getLocalDxfBlobUrl } from "../services/clientEngine";
import type { BOMReport, PanelPart } from "../types/cabinet";

interface BomTableViewProps {
  jobId: string;
  bom: BOMReport;
  selectedPartId: string | null;
  onSelectPart: (partId: string) => void;
}

function PartCncCadPreview({
  part,
  jobId,
}: {
  part: PanelPart;
  jobId: string;
}) {
  const pad = 40;
  const viewW = 720;
  const scale = (viewW - pad * 2) / Math.max(part.cut_length_mm, 1);
  const viewH = Math.max(220, Math.round(part.cut_width_mm * scale + pad * 2));

  const layerColorMap: Record<string, string> = {
    DRILL_MINIFIX_CAM_D15: "#EF4444",
    DRILL_MINIFIX_BOLT_D8: "#FACC15",
    DRILL_DOWEL_D8: "#22D3EE",
    DRILL_SHELF_PIN_D5: "#3B82F6",
    DRILL_HINGE_CUP_D35: "#E879F9",
  };

  const dxfFilename = `${part.part_id}_${part.code}.dxf`;
  const dxfHref =
    getLocalDxfBlobUrl(dxfFilename) ??
    `/api/v1/jobs/${jobId}/dxf/${dxfFilename}`;

  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900/90 p-4">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div>
          <h4 className="flex items-center gap-2 text-sm font-bold text-slate-100">
            <FileCode2 className="h-4 w-4 text-sky-400" />
            CNC DXF R2010 Katman Önizleme: {part.part_id} — {part.name} (
            {part.cut_length_mm} × {part.cut_width_mm} × {part.thickness_mm} mm)
          </h4>
          <p className="text-xs text-slate-400">
            Katmanlar: OUTLINE_CUT (Beyaz) | GROOVE_BACK_8MM (Yeşil) | Minifiks Ø15
            (Kırmızı) | Minifiks Mil Ø8 (Sarı) | Kavela Ø8 (Camgöbeği) | Raf Pimi Ø5
            (Mavi) | Menteşe Ø35 (Macenta)
          </p>
        </div>

        <a
          href={dxfHref}
          download={dxfFilename}
          className="inline-flex items-center gap-1.5 rounded-lg bg-sky-600 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-sky-500"
        >
          <Download className="h-3.5 w-3.5" />
          {dxfFilename} İndir
        </a>
      </div>

      <div className="overflow-hidden rounded-lg border border-slate-800 bg-slate-950 p-2">
        <svg
          viewBox={`0 0 ${viewW} ${viewH}`}
          className="max-h-[300px] w-full"
          role="img"
          aria-label={`${part.name} CNC delik ve kanal şeması`}
        >
          {/* Kesim Dış Konturu (OUTLINE_CUT) */}
          <rect
            x={pad}
            y={pad}
            width={part.cut_length_mm * scale}
            height={part.cut_width_mm * scale}
            fill="#0F172A"
            stroke="#F8FAFC"
            strokeWidth={1.8}
          />

          {/* 8 mm Arkalık Kanalları (GROOVE_BACK_8MM) */}
          {part.grooves.map((g, idx) => {
            const gx = pad + g.x_start_mm * scale;
            const gy =
              pad + (part.cut_width_mm - g.y_start_mm - g.length_mm) * scale;
            return (
              <rect
                key={`groove-${idx}`}
                x={gx}
                y={gy}
                width={g.width_mm * scale}
                height={Math.max(3, g.length_mm * scale)}
                fill="rgba(34, 197, 94, 0.25)"
                stroke="#22C55E"
                strokeWidth={1.2}
              />
            );
          })}

          {/* Sistem 32 CNC Delikleri */}
          {part.drills.map((d, idx) => {
            const cx = pad + d.x_mm * scale;
            const cy = pad + (part.cut_width_mm - d.y_mm) * scale;
            const r = Math.max(3.0, (d.diameter_mm / 2.0) * scale * 1.4);
            const color = layerColorMap[d.layer] ?? "#38BDF8";
            return (
              <g key={`drill-${idx}`}>
                <circle
                  cx={cx}
                  cy={cy}
                  r={r}
                  fill={color}
                  fillOpacity={0.35}
                  stroke={color}
                  strokeWidth={1.4}
                />
                <line
                  x1={cx - r - 2}
                  y1={cy}
                  x2={cx + r + 2}
                  y2={cy}
                  stroke={color}
                  strokeWidth={0.8}
                />
                <line
                  x1={cx}
                  y1={cy - r - 2}
                  x2={cx}
                  y2={cy + r + 2}
                  stroke={color}
                  strokeWidth={0.8}
                />
              </g>
            );
          })}

          {/* Ölçü Etiketleri */}
          <text
            x={pad + (part.cut_length_mm * scale) / 2}
            y={pad - 12}
            textAnchor="middle"
            fill="#94A3B8"
            fontSize="11"
          >
            Kesim Boyu: {part.cut_length_mm} mm (Net: {part.net_length_mm} mm)
          </text>
          <text
            x={pad + 10}
            y={pad + (part.cut_width_mm * scale) / 2}
            fill="#94A3B8"
            fontSize="11"
          >
            Kesim Eni: {part.cut_width_mm} mm
          </text>
        </svg>
      </div>
    </div>
  );
}

export function BomTableView({
  jobId,
  bom,
  selectedPartId,
  onSelectPart,
}: BomTableViewProps) {
  const activePart =
    bom.parts.find((p) => p.part_id === selectedPartId) ?? bom.parts[0];

  return (
    <div className="space-y-5">
      {/* Özet Metrik Kartları */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
        <div className="rounded-xl border border-slate-800 bg-slate-900/70 p-3">
          <span className="text-xs text-slate-400">Toplam Parça</span>
          <p className="mt-1 text-lg font-bold text-slate-100">
            {bom.total_parts_count} Adet
          </p>
        </div>
        <div className="rounded-xl border border-slate-800 bg-slate-900/70 p-3">
          <span className="text-xs text-slate-400">Toplam Net Alan</span>
          <p className="mt-1 text-lg font-bold text-sky-400">
            {bom.total_net_area_m2.toFixed(2)} m²
          </p>
        </div>
        <div className="rounded-xl border border-slate-800 bg-slate-900/70 p-3">
          <span className="text-xs text-slate-400">2.0 mm PVC Metrajı</span>
          <p className="mt-1 text-lg font-bold text-amber-400">
            {bom.total_pvc_20_meters.toFixed(2)} m
          </p>
        </div>
        <div className="rounded-xl border border-slate-800 bg-slate-900/70 p-3">
          <span className="text-xs text-slate-400">0.4 mm PVC Metrajı</span>
          <p className="mt-1 text-lg font-bold text-emerald-400">
            {bom.total_pvc_04_meters.toFixed(2)} m
          </p>
        </div>
        <div className="rounded-xl border border-slate-800 bg-slate-900/70 p-3">
          <span className="text-xs text-slate-400">CNC Delik Operasyonu</span>
          <p className="mt-1 text-lg font-bold text-purple-400">
            {bom.total_drill_count} Delik
          </p>
        </div>
      </div>

      {/* Seçili Parça CNC DXF Önizleme */}
      {activePart && <PartCncCadPreview part={activePart} jobId={jobId} />}

      {/* Modern Web Guidance: responsive-table */}
      <div
        tabIndex={0}
        role="region"
        aria-labelledby="bom-table-caption"
        className="table-wrapper rounded-xl border border-slate-800 bg-slate-900/80 shadow-inner"
      >
        <table className="bom-table text-left text-xs">
          <caption
            id="bom-table-caption"
            className="border-b border-slate-800 bg-slate-900 px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wider text-slate-300"
          >
            Fabrika Kesim, PVC Kenar Bandı Düşümü ve CNC Operasyon Tablosu (Parçaya
            tıklayarak DXF önizleyin)
          </caption>
          <thead className="bg-slate-800/95 text-slate-300">
            <tr>
              <th className="px-3 py-2.5 font-semibold">Kod</th>
              <th className="px-3 py-2.5 font-semibold">Parça Adı</th>
              <th className="px-3 py-2.5 font-semibold">Malzeme</th>
              <th className="px-3 py-2.5 font-semibold">Kalınlık</th>
              <th className="px-3 py-2.5 font-semibold">Net Ölçü (mm)</th>
              <th className="px-3 py-2.5 font-semibold text-emerald-300">
                Kesim Ölçüsü (mm)
              </th>
              <th className="px-3 py-2.5 font-semibold text-amber-300">
                PVC Düşüm
              </th>
              <th className="px-3 py-2.5 font-semibold">
                PVC (Ön/Arka/Üst/Alt)
              </th>
              <th className="px-3 py-2.5 font-semibold">CNC Delik</th>
              <th className="px-3 py-2.5 font-semibold">DXF</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/80">
            {bom.parts.map((part) => {
              const isSelected = activePart?.part_id === part.part_id;
              const dxfFile = `${part.part_id}_${part.code}.dxf`;
              const rowDxfHref =
                getLocalDxfBlobUrl(dxfFile) ??
                `/api/v1/jobs/${jobId}/dxf/${dxfFile}`;
              return (
                <tr
                  key={part.part_id}
                  onClick={() => onSelectPart(part.part_id)}
                  className={`cursor-pointer transition ${
                    isSelected
                      ? "bg-sky-950/60 text-sky-100"
                      : "hover:bg-slate-800/50"
                  }`}
                >
                  <th className="px-3 py-2.5 font-mono font-bold text-sky-400">
                    {part.part_id} · {part.code}
                  </th>
                  <td className="px-3 py-2.5 font-medium text-slate-100">
                    {part.name}
                  </td>
                  <td className="px-3 py-2.5 text-slate-300">{part.material}</td>
                  <td className="px-3 py-2.5">{part.thickness_mm} mm</td>
                  <td className="px-3 py-2.5 font-mono">
                    {part.net_length_mm} × {part.net_width_mm}
                  </td>
                  <td className="px-3 py-2.5 font-mono font-bold text-emerald-300">
                    {part.cut_length_mm} × {part.cut_width_mm}
                  </td>
                  <td className="px-3 py-2.5 font-mono text-amber-300">
                    -{part.pvc_deduction_length_mm} / -{part.pvc_deduction_width_mm} mm
                  </td>
                  <td className="px-3 py-2.5 font-mono text-slate-300">
                    {part.edge_band.length_1_mm} / {part.edge_band.length_2_mm} /{" "}
                    {part.edge_band.width_1_mm} / {part.edge_band.width_2_mm}
                  </td>
                  <td className="px-3 py-2.5">
                    <span className="rounded bg-slate-800 px-2 py-0.5 font-mono text-slate-200">
                      {part.drills.length} delik
                    </span>
                  </td>
                  <td className="px-3 py-2.5">
                    <a
                      href={rowDxfHref}
                      download={dxfFile}
                      onClick={(e) => e.stopPropagation()}
                      className="inline-flex items-center gap-1 rounded border border-slate-700 bg-slate-800 px-2 py-1 text-xs font-medium text-sky-300 hover:border-sky-500"
                    >
                      <Download className="h-3 w-3" />
                      DXF
                    </a>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Hırdavat ve Bağlantı Elemanları Özeti */}
      <div className="rounded-xl border border-slate-800 bg-slate-900/80 p-4">
        <h4 className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-slate-300">
          <Wrench className="h-4 w-4 text-amber-400" />
          Hırdavat, Bağlantı Elemanları ve Kenar Bandı İcmali
        </h4>
        <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
          {bom.hardware.map((item) => (
            <div
              key={item.code}
              className="flex items-center justify-between rounded-lg border border-slate-800 bg-slate-950/70 px-3.5 py-2.5 text-xs"
            >
              <div>
                <span className="font-mono text-[11px] text-slate-400">
                  {item.code}
                </span>
                <p className="font-medium text-slate-200">{item.name}</p>
                <p className="text-[11px] text-slate-400">{item.note}</p>
              </div>
              <span className="ml-3 whitespace-nowrap rounded-md bg-amber-500/15 px-2.5 py-1 font-mono text-sm font-bold text-amber-300">
                {item.quantity} {item.unit}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

