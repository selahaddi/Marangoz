import { useMemo, useState } from "react";
import {
  Camera,
  CheckCircle2,
  Download,
  Eye,
  FileCode,
  QrCode,
  Scan,
  Search,
} from "lucide-react";
import type { BOMReport, PanelPart } from "../types/cabinet";
import {
  generatePartCixString,
  generatePartDxfString,
  generatePartGcodeString,
  generatePartMprString,
} from "../services/clientEngine";

interface WorkshopScannerViewProps {
  jobId: string;
  bom: BOMReport;
  selectedPartId: string | null;
  onSelectPart: (partId: string) => void;
  onNavigateTo3D: () => void;
}

/**
 * 11x11 Endüstriyel QR / DataMatrix matrisi
 */
function renderQrMatrix(payload: string): boolean[][] {
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

function triggerDownload(content: string, filename: string, mime: string) {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export function WorkshopScannerView({
  jobId,
  bom,
  selectedPartId,
  onSelectPart,
  onNavigateTo3D,
}: WorkshopScannerViewProps) {
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [isCameraActive, setIsCameraActive] = useState<boolean>(false);
  const [scanMessage, setScanMessage] = useState<string | null>(null);

  const currentPart = useMemo(() => {
    if (selectedPartId) {
      const found = bom.parts.find((p) => p.part_id === selectedPartId);
      if (found) return found;
    }
    return bom.parts[0] ?? null;
  }, [bom.parts, selectedPartId]);

  const filteredParts = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return bom.parts;
    return bom.parts.filter(
      (p) =>
        p.part_id.toLowerCase().includes(q) ||
        p.code.toLowerCase().includes(q) ||
        p.name.toLowerCase().includes(q) ||
        p.material.toLowerCase().includes(q)
    );
  }, [bom.parts, searchQuery]);

  const handleSimulateScan = (part: PanelPart) => {
    onSelectPart(part.part_id);
    setScanMessage(`QR Okundu: ${part.part_id} ${part.name}`);
    setTimeout(() => setScanMessage(null), 3000);
  };

  const qrMatrix = useMemo(() => {
    if (!currentPart) return [];
    return renderQrMatrix(`${jobId}::${currentPart.part_id}::${currentPart.code}`);
  }, [jobId, currentPart]);

  const handleDownloadDxf = () => {
    if (!currentPart) return;
    const content = generatePartDxfString(currentPart);
    triggerDownload(content, `${currentPart.part_id}_${currentPart.code}.dxf`, "application/dxf");
  };

  const handleDownloadGcode = () => {
    if (!currentPart) return;
    const content = generatePartGcodeString(currentPart);
    triggerDownload(content, `${currentPart.part_id}_${currentPart.code}.nc`, "text/plain");
  };

  const handleDownloadMpr = () => {
    if (!currentPart) return;
    const content = generatePartMprString(currentPart);
    triggerDownload(content, `${currentPart.part_id}_${currentPart.code}.mpr`, "text/plain");
  };

  const handleDownloadCix = () => {
    if (!currentPart) return;
    const content = generatePartCixString(currentPart);
    triggerDownload(content, `${currentPart.part_id}_${currentPart.code}.cix`, "text/plain");
  };

  return (
    <div className="flex flex-col gap-6">
      {/* Üst Bilgi Başlığı */}
      <div className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-slate-800 bg-slate-900/90 p-4">
        <div>
          <div className="flex items-center gap-2">
            <Scan className="h-5 w-5 text-sky-400" />
            <h2 className="text-base font-bold text-slate-100">
              Atölye İçi Mobil & Tablet Parça Terminali
            </h2>
            <span className="rounded-full bg-emerald-500/20 px-2.5 py-0.5 text-xs font-semibold text-emerald-400">
              Canlı Takip
            </span>
          </div>
          <p className="mt-1 text-xs text-slate-400">
            QR kod okutarak veya listeden seçerek parçanın 3D montajdaki yerini, 4-kenar PVC bant yönünü ve CNC işleme kodlarını anında görüntüleyin.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setIsCameraActive((prev) => !prev)}
            className={`flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-semibold transition ${
              isCameraActive
                ? "border-emerald-500 bg-emerald-500/20 text-emerald-300"
                : "border-slate-700 bg-slate-800 text-slate-300 hover:bg-slate-700"
            }`}
          >
            <Camera className="h-4 w-4" />
            {isCameraActive ? "Kamerayı Kapat" : "Kamera ile QR Tara"}
          </button>
        </div>
      </div>

      {scanMessage && (
        <div className="flex items-center gap-2 rounded-lg border border-emerald-500/50 bg-emerald-950/60 p-3 text-xs font-semibold text-emerald-300 shadow-lg animate-in fade-in">
          <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0" />
          <span>{scanMessage}</span>
        </div>
      )}

      {/* Kamera Arayüzü / Canlı Tarama Simülatörü */}
      {isCameraActive && (
        <div className="relative flex flex-col items-center justify-center rounded-xl border-2 border-dashed border-sky-500/60 bg-slate-950 p-6 text-center">
          <div className="relative mb-3 flex h-48 w-48 items-center justify-center rounded-xl border border-sky-400/30 bg-slate-900/80 overflow-hidden">
            <div className="absolute inset-x-0 h-1 bg-gradient-to-r from-transparent via-sky-400 to-transparent animate-pulse" />
            <QrCode className="h-24 w-24 text-sky-500/50" />
            <div className="absolute inset-4 border border-sky-400/40 rounded-lg pointer-events-none" />
          </div>
          <p className="text-xs font-medium text-slate-300">
            Parça etiketindeki QR kodu kamera vizörüne yaklaştırın
          </p>
          <p className="mt-1 text-[11px] text-slate-500">
            Hızlı test için aşağıdaki parça listesinden herhangi birine tıklayarak QR taramasını simüle edebilirsiniz.
          </p>
        </div>
      )}

      {/* Ana Çift Kolon: Sol Liste, Sağ Seçili Parça Rehberi */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        {/* Sol Parça Listesi */}
        <div className="flex flex-col rounded-xl border border-slate-800 bg-slate-900/60 p-4 lg:col-span-4">
          <div className="mb-3 flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
              İş Emri Parçaları ({bom.parts.length} Parça)
            </span>
          </div>

          <div className="relative mb-3">
            <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-slate-500" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Parça ara (P01, YAN_SOL, raf...)"
              className="w-full rounded-lg border border-slate-800 bg-slate-950 py-1.5 pl-8 pr-3 text-xs text-slate-200 placeholder-slate-500 focus:border-sky-500 focus:outline-none"
            />
          </div>

          <div className="flex max-h-[580px] flex-col gap-1.5 overflow-y-auto pr-1">
            {filteredParts.map((p) => {
              const isSelected = p.part_id === currentPart?.part_id;
              return (
                <button
                  key={p.part_id}
                  type="button"
                  onClick={() => handleSimulateScan(p)}
                  className={`flex items-center justify-between rounded-lg border p-2.5 text-left text-xs transition ${
                    isSelected
                      ? "border-sky-500 bg-sky-500/20 text-sky-200"
                      : "border-slate-800/80 bg-slate-950/60 text-slate-300 hover:border-slate-700 hover:bg-slate-800/50"
                  }`}
                >
                  <div>
                    <div className="flex items-center gap-1.5">
                      <span className="font-bold text-sky-400">{p.part_id}</span>
                      <span className="font-medium text-slate-200">{p.name}</span>
                    </div>
                    <div className="mt-0.5 text-[11px] text-slate-400">
                      Kesim: {p.cut_length_mm} × {p.cut_width_mm} × {p.thickness_mm} mm
                    </div>
                  </div>
                  <div className="text-right">
                    <span className="rounded bg-slate-800 px-1.5 py-0.5 text-[10px] text-slate-300">
                      {p.drills.length} Delik
                    </span>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Sağ Seçili Parça Kartı ve Operatör Rehberi */}
        {currentPart && (
          <div className="flex flex-col gap-4 rounded-xl border border-slate-800 bg-slate-900/80 p-5 lg:col-span-8">
            {/* Parça Başlığı & Ebat Bilgisi */}
            <div className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-800 pb-4">
              <div>
                <div className="flex items-center gap-2">
                  <span className="rounded-md bg-sky-500/20 px-2 py-0.5 text-sm font-bold text-sky-300">
                    {currentPart.part_id}
                  </span>
                  <h3 className="text-lg font-bold text-slate-100">
                    {currentPart.name} ({currentPart.code})
                  </h3>
                </div>
                <p className="mt-1 text-xs text-slate-400">
                  Malzeme: <span className="font-semibold text-slate-200">{currentPart.material}</span> ({currentPart.thickness_mm} mm) | Adet:{" "}
                  <span className="font-semibold text-slate-200">{currentPart.quantity}</span>
                </p>
              </div>

              <div className="flex items-center gap-3">
                {qrMatrix.length > 0 && (
                  <svg
                    viewBox="0 0 11 11"
                    className="h-12 w-12 rounded border border-slate-700 bg-white p-0.5 shadow shrink-0"
                    shapeRendering="crispEdges"
                  >
                    {qrMatrix.map((row, r) =>
                      row.map((cell, c) =>
                        cell ? <rect key={`${r}-${c}`} x={c} y={r} width="1" height="1" fill="#000" /> : null
                      )
                    )}
                  </svg>
                )}
                <button
                  type="button"
                  onClick={() => {
                    onSelectPart(currentPart.part_id);
                    onNavigateTo3D();
                  }}
                  className="flex items-center gap-1.5 rounded-lg border border-sky-500/40 bg-sky-500/15 px-3 py-1.5 text-xs font-semibold text-sky-300 transition hover:bg-sky-500/25"
                >
                  <Eye className="h-3.5 w-3.5" />
                  3D Modelde Konumu Gör
                </button>
              </div>
            </div>

            {/* Kesim & Net Ölçü Karşılaştırması */}
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="rounded-lg border border-slate-800 bg-slate-950 p-3.5">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                  Ebatlama Kesim Ölçüsü (PVC Düşülmüş)
                </span>
                <div className="mt-1 text-2xl font-black text-emerald-400">
                  {currentPart.cut_length_mm} × {currentPart.cut_width_mm} mm
                </div>
                <p className="mt-1 text-[11px] text-slate-400">
                  Testere veya CNC Router tezgahında bu ölçüde ebatlanır.
                </p>
              </div>

              <div className="rounded-lg border border-slate-800 bg-slate-950 p-3.5">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                  Bitmiş Net Ölçü (PVC Dahil)
                </span>
                <div className="mt-1 text-2xl font-black text-slate-200">
                  {currentPart.net_length_mm} × {currentPart.net_width_mm} mm
                </div>
                <p className="mt-1 text-[11px] text-slate-400">
                  Mobilya montajındaki nominal nihai ölçüdür.
                </p>
              </div>
            </div>

            {/* 4-Kenar PVC Kenar Bantlama Rehberi */}
            <div className="rounded-lg border border-slate-800 bg-slate-950 p-4">
              <div className="mb-3 flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-300">
                  4-Kenar PVC Bantlama Kılavuzu & Damar Yönü
                </span>
                <span className="text-xs text-slate-400">
                  Damar Yönü: <strong className="text-sky-300">{currentPart.grain_direction === "length" ? "Boyuna (Uzun Kenar)" : "Enine"}</strong>
                </span>
              </div>

              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                <div className="rounded border border-amber-500/30 bg-amber-500/10 p-2.5 text-center">
                  <span className="text-[10px] font-semibold uppercase text-amber-300">Ön Kenar (Görünen)</span>
                  <div className="mt-0.5 text-sm font-bold text-amber-200">
                    {currentPart.edge_band.length_1_mm > 0 ? `${currentPart.edge_band.length_1_mm} mm PVC` : "Ham (Bantsız)"}
                  </div>
                </div>
                <div className="rounded border border-slate-700 bg-slate-900 p-2.5 text-center">
                  <span className="text-[10px] font-semibold uppercase text-slate-400">Arka Kenar</span>
                  <div className="mt-0.5 text-sm font-bold text-slate-200">
                    {currentPart.edge_band.length_2_mm > 0 ? `${currentPart.edge_band.length_2_mm} mm PVC` : "Ham"}
                  </div>
                </div>
                <div className="rounded border border-slate-700 bg-slate-900 p-2.5 text-center">
                  <span className="text-[10px] font-semibold uppercase text-slate-400">Üst Kenar</span>
                  <div className="mt-0.5 text-sm font-bold text-slate-200">
                    {currentPart.edge_band.width_1_mm > 0 ? `${currentPart.edge_band.width_1_mm} mm PVC` : "Ham"}
                  </div>
                </div>
                <div className="rounded border border-slate-700 bg-slate-900 p-2.5 text-center">
                  <span className="text-[10px] font-semibold uppercase text-slate-400">Alt Kenar</span>
                  <div className="mt-0.5 text-sm font-bold text-slate-200">
                    {currentPart.edge_band.width_2_mm > 0 ? `${currentPart.edge_band.width_2_mm} mm PVC` : "Ham"}
                  </div>
                </div>
              </div>
            </div>

            {/* CNC Operasyonları & Kertmeler */}
            <div className="rounded-lg border border-slate-800 bg-slate-950 p-4">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-300">
                CNC Operasyonları (Delik, Kanal & Kertme)
              </span>
              <div className="mt-3 flex flex-wrap gap-2 text-xs">
                <span className="rounded bg-slate-800 px-2.5 py-1 text-slate-200">
                  Toplam Delik: <strong>{currentPart.drills.length} adet</strong>
                </span>
                <span className="rounded bg-slate-800 px-2.5 py-1 text-slate-200">
                  Kanal Sayısı: <strong>{currentPart.grooves.length} adet</strong>
                </span>
                {currentPart.notch_info && (
                  <span className="rounded bg-amber-500/20 px-2.5 py-1 font-semibold text-amber-300">
                    Kertme: {currentPart.notch_info}
                  </span>
                )}
                {currentPart.holding_tabs_count && currentPart.holding_tabs_count > 0 && (
                  <span className="rounded bg-emerald-500/20 px-2.5 py-1 font-semibold text-emerald-300">
                    Vakum Güvenlik Sekmesi: {currentPart.holding_tabs_count}×TAB
                  </span>
                )}
              </div>
            </div>

            {/* Tezgâh Operatörü İçin Doğrudan CNC Programı İndirme Çubuğu */}
            <div className="mt-1 rounded-lg border border-sky-500/30 bg-sky-950/20 p-4">
              <div className="mb-2 flex items-center gap-2">
                <FileCode className="h-4 w-4 text-sky-400" />
                <span className="text-xs font-bold text-sky-200">
                  Tezgâh Operatörü İçin Tek Tıkla CNC Programı İndir:
                </span>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={handleDownloadCix}
                  className="flex items-center gap-1.5 rounded-lg border border-indigo-500/40 bg-indigo-600/80 hover:bg-indigo-500 px-3 py-1.5 text-xs font-semibold text-white transition shadow"
                >
                  <Download className="h-3.5 w-3.5" />
                  Biesse Rover (.CIX)
                </button>
                <button
                  type="button"
                  onClick={handleDownloadMpr}
                  className="flex items-center gap-1.5 rounded-lg border border-emerald-500/40 bg-emerald-600/80 hover:bg-emerald-500 px-3 py-1.5 text-xs font-semibold text-white transition shadow"
                >
                  <Download className="h-3.5 w-3.5" />
                  Homag Weeke (.MPR)
                </button>
                <button
                  type="button"
                  onClick={handleDownloadGcode}
                  className="flex items-center gap-1.5 rounded-lg border border-slate-700 bg-slate-800 hover:bg-slate-700 px-3 py-1.5 text-xs font-semibold text-slate-200 transition"
                >
                  <Download className="h-3.5 w-3.5" />
                  ISO G-Code (.NC)
                </button>
                <button
                  type="button"
                  onClick={handleDownloadDxf}
                  className="flex items-center gap-1.5 rounded-lg border border-slate-700 bg-slate-800 hover:bg-slate-700 px-3 py-1.5 text-xs font-semibold text-slate-200 transition"
                >
                  <Download className="h-3.5 w-3.5" />
                  AutoCAD (.DXF)
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
