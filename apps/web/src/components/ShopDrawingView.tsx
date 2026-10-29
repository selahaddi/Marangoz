import { useMemo, useState } from "react";
import {
  Download,
  Eye,
  FileText,
  Printer,
} from "lucide-react";
import type { BOMReport } from "../types/cabinet";

interface ShopDrawingViewProps {
  bom: BOMReport;
}

export function ShopDrawingView({ bom }: ShopDrawingViewProps) {
  const [printMode, setPrintMode] = useState<boolean>(false);

  const config = bom.config;
  const allModules = [config, ...(config.additional_modules ?? [])];
  const totalW = allModules.reduce((acc, m) => acc + m.width_mm, 0);
  const maxH = Math.max(...allModules.map((m) => m.height_mm));
  const maxD = Math.max(...allModules.map((m) => m.depth_mm));

  // 1600 x 1000 px Tuval Koordinat Matematiği
  const canvasW = 1600;
  const canvasH = 1000;

  const bgColor = printMode ? "#FFFFFF" : "#090D16";
  const gridColor = printMode ? "#E2E8F0" : "#162032";
  const borderColor = printMode ? "#0F172A" : "#0284C7";
  const lineColor = printMode ? "#1E293B" : "#38BDF8";
  const textColor = printMode ? "#0F172A" : "#F1F5F9";
  const dimColor = printMode ? "#2563EB" : "#06B6D4";
  const badgeBg = printMode ? "#F8FAFC" : "#1E293B";

  const frontOx = 120;
  const frontOy = 150;
  const frontBoxW = 880;
  const frontBoxH = 720;

  const scaleX = frontBoxW / totalW;
  const scaleY = frontBoxH / maxH;
  const scale = Math.min(scaleX, scaleY) * 0.88;

  const drawW = totalW * scale;
  const drawH = maxH * scale;

  const elevX = frontOx + (frontBoxW - drawW) / 2.0;
  const elevY = frontOy + (frontBoxH - drawH) / 2.0;

  // Yan Kesit Koordinatları
  const secOx = 1040;
  const secOy = 150;
  const secDrawW = maxD * scale;
  const secDrawH = maxH * scale;

  // SVG String İndirilebilir Dosya
  const svgContent = useMemo(() => {
    // Tarayıcı içinde doğrudan SVG öğesini serialize edebiliriz veya temiz markup oluşturabiliriz
    const partsSvg: string[] = [];
    partsSvg.push(
      `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${canvasW} ${canvasH}" width="${canvasW}" height="${canvasH}" style="background-color: ${bgColor}; font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;">`
    );
    partsSvg.push(
      `<defs><pattern id="grid-export" width="40" height="40" patternUnits="userSpaceOnUse"><path d="M 40 0 L 0 0 0 40" fill="none" stroke="${gridColor}" stroke-width="0.75"/></pattern></defs>`
    );
    partsSvg.push(`<rect width="${canvasW}" height="${canvasH}" fill="url(#grid-export)" />`);
    partsSvg.push(
      `<rect x="20" y="20" width="${canvasW - 40}" height="${canvasH - 40}" fill="none" stroke="${borderColor}" stroke-width="2.5"/>`
    );
    partsSvg.push(
      `<rect x="20" y="20" width="${canvasW - 40}" height="65" fill="${badgeBg}" stroke="${borderColor}" stroke-width="1.5"/>`
    );
    partsSvg.push(
      `<text x="45" y="58" font-size="22" font-weight="bold" fill="${textColor}">MARANGOZ ATÖLYE İMALAT &amp; MONTAJ ŞEMASI (SHOP FLOOR BLUEPRINT)</text>`
    );
    partsSvg.push(
      `<text x="${canvasW - 45}" y="58" text-anchor="end" font-size="14" fill="${dimColor}">ÖLÇEK: 1:${Math.round(1.0 / scale)} | HAT: ${Math.round(totalW)}×${Math.round(maxH)}×${Math.round(maxD)} mm</text>`
    );
    partsSvg.push("</svg>");
    return partsSvg.join("\n");
  }, [canvasW, canvasH, bgColor, gridColor, borderColor, badgeBg, textColor, dimColor, scale, totalW, maxH, maxD]);

  const handleDownloadSvg = () => {
    const blob = new Blob([svgContent], { type: "image/svg+xml;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `montaj_semasi_${config.name.replace(/\s+/g, "_")}.svg`;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-4">
      {/* Üst İşlem Çubuğu */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-800 bg-slate-900/90 p-4 shadow-xl backdrop-blur">
        <div className="flex items-center gap-2.5">
          <FileText className="h-5 w-5 text-sky-400" />
          <div>
            <h2 className="text-sm font-bold text-slate-100 uppercase tracking-wider">
              2D Atölye İmalat &amp; Montaj Şeması (Shop Floor Sheet)
            </h2>
            <p className="text-xs text-slate-400">
              Usta ve montaj ekibi için milimetrik ön görünüş, yan kesit, parça ID'leri ve montaj yönleri
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setPrintMode((prev) => !prev)}
            className={`inline-flex items-center gap-1.5 rounded-xl border px-3 py-1.5 text-xs font-semibold transition ${
              printMode
                ? "border-amber-500 bg-amber-500/20 text-amber-300"
                : "border-slate-700 bg-slate-800 text-slate-300 hover:bg-slate-700"
            }`}
          >
            <Eye className="h-3.5 w-3.5" />
            <span>{printMode ? "Blueprint Görünümü" : "Yazıcı Baskı Modu (Beyaz)"}</span>
          </button>

          <button
            type="button"
            onClick={handleDownloadSvg}
            className="inline-flex items-center gap-1.5 rounded-xl border border-slate-700 bg-slate-800 px-3 py-1.5 text-xs font-semibold text-slate-200 transition hover:bg-slate-700"
          >
            <Download className="h-3.5 w-3.5 text-sky-400" />
            <span>SVG İndir</span>
          </button>

          <button
            type="button"
            onClick={() => window.print()}
            className="inline-flex items-center gap-1.5 rounded-xl bg-sky-600 px-3.5 py-1.5 text-xs font-bold text-white transition hover:bg-sky-500 shadow-md"
          >
            <Printer className="h-3.5 w-3.5" />
            <span>A3 / A4 Yazdır (PDF)</span>
          </button>
        </div>
      </div>

      {/* SVG Vektörel Teknik Resim Tuvali */}
      <div className="overflow-x-auto rounded-2xl border border-slate-800 bg-slate-950 p-2 shadow-2xl">
        <svg
          viewBox={`0 0 ${canvasW} ${canvasH}`}
          className="w-full h-auto max-h-[850px] select-none"
          style={{ backgroundColor: bgColor }}
        >
          {/* Grid Arka Plan */}
          <defs>
            <pattern id="viewer-grid" width="40" height="40" patternUnits="userSpaceOnUse">
              <path d="M 40 0 L 0 0 0 40" fill="none" stroke={gridColor} strokeWidth="0.75" />
            </pattern>
          </defs>
          <rect width={canvasW} height={canvasH} fill="url(#viewer-grid)" />

          {/* Dış Çerçeve ve Başlık Bandı */}
          <rect
            x="20"
            y="20"
            width={canvasW - 40}
            height={canvasH - 40}
            fill="none"
            stroke={borderColor}
            strokeWidth="2.5"
          />
          <rect
            x="20"
            y="20"
            width={canvasW - 40}
            height="65"
            fill={badgeBg}
            stroke={borderColor}
            strokeWidth="1.5"
          />
          <text
            x="45"
            y="58"
            fontSize="22"
            fontWeight="bold"
            fill={textColor}
            className="font-mono"
          >
            MARANGOZ ATÖLYE İMALAT &amp; MONTAJ ŞEMASI (SHOP FLOOR BLUEPRINT)
          </text>
          <text
            x={canvasW - 45}
            y="58"
            textAnchor="end"
            fontSize="14"
            fill={dimColor}
            className="font-mono font-bold"
          >
            ÖLÇEK: 1:{Math.round(1.0 / scale)} | HAT: {Math.round(totalW)} × {Math.round(maxH)} × {Math.round(maxD)} mm
          </text>

          {/* 1. ÖN GÖRÜNÜŞ (FRONT ELEVATION) */}
          <text
            x={frontOx}
            y={frontOy - 35}
            fontSize="15"
            fontWeight="bold"
            fill={dimColor}
            className="font-mono uppercase"
          >
            A. ÖN GÖRÜNÜŞ (FRONT ELEVATION &amp; PANEL ID'LERİ)
          </text>

          {/* Dış Kutu */}
          <rect
            x={elevX}
            y={elevY}
            width={drawW}
            height={drawH}
            fill="none"
            stroke={lineColor}
            strokeWidth="3"
          />

          {/* Modüller */}
          {(() => {
            let currX = elevX;
            return allModules.map((m, mIdx) => {
              const modW = m.width_mm * scale;
              const modH = m.height_mm * scale;
              const modY = elevY + (maxH - m.height_mm) * scale;
              const tMm = 18.0 * scale;
              const plinthH = (m.has_plinth ? m.plinth_height_mm : 0.0) * scale;
              const startX = currX;
              currX += modW;

              return (
                <g key={`mod-${mIdx}`}>
                  {/* Modül Çizgisi */}
                  {allModules.length > 1 && (
                    <>
                      <line
                        x1={startX}
                        y1={elevY}
                        x2={startX}
                        y2={elevY + drawH}
                        stroke={lineColor}
                        strokeDasharray="4,4"
                        strokeWidth="1.5"
                      />
                      <text
                        x={startX + modW / 2}
                        y={elevY - 12}
                        textAnchor="middle"
                        fontSize="11"
                        fontWeight="bold"
                        fill={dimColor}
                        className="font-mono"
                      >
                        MODÜL {mIdx + 1} ({Math.round(m.width_mm)} mm)
                      </text>
                    </>
                  )}

                  {/* Sol Yan Dikme */}
                  <rect
                    x={startX}
                    y={modY}
                    width={tMm}
                    height={modH}
                    fill={badgeBg}
                    stroke={lineColor}
                    strokeWidth="1.2"
                  />
                  {/* Sağ Yan Dikme */}
                  <rect
                    x={startX + modW - tMm}
                    y={modY}
                    width={tMm}
                    height={modH}
                    fill={badgeBg}
                    stroke={lineColor}
                    strokeWidth="1.2"
                  />

                  {/* Alt ve Üst Tablalar */}
                  <rect
                    x={startX + tMm}
                    y={modY}
                    width={modW - 2 * tMm}
                    height={tMm}
                    fill={badgeBg}
                    stroke={lineColor}
                    strokeWidth="1.2"
                  />
                  <rect
                    x={startX + tMm}
                    y={modY + modH - plinthH - tMm}
                    width={modW - 2 * tMm}
                    height={tMm}
                    fill={badgeBg}
                    stroke={lineColor}
                    strokeWidth="1.2"
                  />

                  {/* Baza */}
                  {plinthH > 0 && (
                    <>
                      <rect
                        x={startX}
                        y={modY + modH - plinthH}
                        width={modW}
                        height={plinthH}
                        fill={badgeBg}
                        stroke={lineColor}
                        strokeWidth="1.5"
                      />
                      <text
                        x={startX + modW / 2}
                        y={modY + modH - plinthH / 2 + 4}
                        textAnchor="middle"
                        fontSize="10"
                        fill={textColor}
                        className="font-mono"
                      >
                        BAZA ({Math.round(m.plinth_height_mm)} mm)
                      </text>
                    </>
                  )}

                  {/* Raflar */}
                  {m.shelf_count > 0 &&
                    Array.from({ length: m.shelf_count }).map((_, sIdx) => {
                      const innerH = modH - plinthH - 2 * tMm;
                      const shelfGap = innerH / (m.shelf_count + 1);
                      const sy = modY + tMm + (sIdx + 1) * shelfGap - tMm / 2.0;
                      return (
                        <g key={`shelf-${sIdx}`}>
                          <rect
                            x={startX + tMm}
                            y={sy}
                            width={modW - 2 * tMm}
                            height={tMm}
                            fill={badgeBg}
                            stroke={lineColor}
                            strokeWidth="1"
                          />
                          <text
                            x={startX + modW / 2}
                            y={sy - 6}
                            textAnchor="middle"
                            fontSize="10"
                            fill={dimColor}
                            className="font-mono"
                          >
                            ↕ {Math.round(shelfGap / scale)} mm
                          </text>
                        </g>
                      );
                    })}

                  {/* Çekmeceler */}
                  {m.drawer_count > 0 &&
                    Array.from({ length: m.drawer_count }).map((_, dIdx) => {
                      const dfH = m.drawer_front_height_mm * scale;
                      const dy = modY + modH - plinthH - (dIdx + 1) * dfH;
                      return (
                        <g key={`drawer-${dIdx}`}>
                          <rect
                            x={startX + 2}
                            y={dy + 2}
                            width={modW - 4}
                            height={dfH - 4}
                            fill="none"
                            stroke={dimColor}
                            strokeWidth="1.5"
                            strokeDasharray="3,3"
                          />
                          <line
                            x1={startX + modW / 2 - 20}
                            y1={dy + dfH / 2}
                            x2={startX + modW / 2 + 20}
                            y2={dy + dfH / 2}
                            stroke={dimColor}
                            strokeWidth="3"
                          />
                          <text
                            x={startX + 15}
                            y={dy + 16}
                            fontSize="9"
                            fontWeight="bold"
                            fill={textColor}
                            className="font-mono"
                          >
                            ÇEKMECE #{dIdx + 1} ({Math.round(m.drawer_front_height_mm)} mm)
                          </text>
                        </g>
                      );
                    })}
                </g>
              );
            });
          })()}

          {/* Dış Ölçü Çizgileri - Genişlik (W) */}
          <line
            x1={elevX}
            y1={elevY - 25}
            x2={elevX + drawW}
            y2={elevY - 25}
            stroke={dimColor}
            strokeWidth="1.5"
          />
          <line
            x1={elevX}
            y1={elevY - 31}
            x2={elevX}
            y2={elevY - 19}
            stroke={dimColor}
            strokeWidth="1.5"
          />
          <line
            x1={elevX + drawW}
            y1={elevY - 31}
            x2={elevX + drawW}
            y2={elevY - 19}
            stroke={dimColor}
            strokeWidth="1.5"
          />
          <text
            x={elevX + drawW / 2}
            y={elevY - 33}
            textAnchor="middle"
            fontSize="13"
            fontWeight="bold"
            fill={dimColor}
            className="font-mono"
          >
            G: {Math.round(totalW)} mm
          </text>

          {/* Dış Ölçü Çizgileri - Yükseklik (H) */}
          <line
            x1={elevX - 30}
            y1={elevY}
            x2={elevX - 30}
            y2={elevY + drawH}
            stroke={dimColor}
            strokeWidth="1.5"
          />
          <line
            x1={elevX - 36}
            y1={elevY}
            x2={elevX - 24}
            y2={elevY}
            stroke={dimColor}
            strokeWidth="1.5"
          />
          <line
            x1={elevX - 36}
            y1={elevY + drawH}
            x2={elevX - 24}
            y2={elevY + drawH}
            stroke={dimColor}
            strokeWidth="1.5"
          />
          <text
            x={elevX - 42}
            y={elevY + drawH / 2}
            textAnchor="middle"
            transform={`rotate(-90 ${elevX - 42} ${elevY + drawH / 2})`}
            fontSize="13"
            fontWeight="bold"
            fill={dimColor}
            className="font-mono"
          >
            Y: {Math.round(maxH)} mm
          </text>

          {/* 2. YAN KESİT GÖRÜNÜŞÜ (SIDE CROSS-SECTION) */}
          <text
            x={secOx}
            y={secOy - 35}
            fontSize="15"
            fontWeight="bold"
            fill={dimColor}
            className="font-mono uppercase"
          >
            B. YAN KESİT GÖRÜNÜŞÜ (SECTION PROFILE)
          </text>

          <rect
            x={secOx}
            y={secOy}
            width={secDrawW}
            height={secDrawH}
            fill={badgeBg}
            stroke={lineColor}
            strokeWidth="2.5"
          />

          {/* Arkalık Kanalı */}
          <rect
            x={secOx + 20.0 * scale}
            y={secOy + 18.0 * scale}
            width={8.0 * scale}
            height={secDrawH - 36.0 * scale}
            fill="none"
            stroke="#F97316"
            strokeWidth="1.5"
            strokeDasharray="3,3"
          />
          <text
            x={secOx + 6}
            y={secOy + secDrawH / 2}
            fontSize="9"
            fill="#F97316"
            transform={`rotate(-90 ${secOx + 6} ${secOy + secDrawH / 2})`}
            className="font-mono"
          >
            ARKALIK KANALI (8×8.5 mm)
          </text>

          {/* Süpürgelik Kertmesi (Varsa) */}
          {config.has_baseboard_notch && (
            <>
              <rect
                x={secOx}
                y={secOy + secDrawH - (config.baseboard_notch_height_mm ?? 80) * scale}
                width={(config.baseboard_notch_depth_mm ?? 15) * scale}
                height={(config.baseboard_notch_height_mm ?? 80) * scale}
                fill={bgColor}
                stroke={dimColor}
                strokeWidth="2"
              />
              <text
                x={secOx + (config.baseboard_notch_depth_mm ?? 15) * scale + 6}
                y={secOy + secDrawH - ((config.baseboard_notch_height_mm ?? 80) * scale) / 2 + 4}
                fontSize="9"
                fontWeight="bold"
                fill={dimColor}
                className="font-mono"
              >
                SÜPÜRGELİK KERTME ({config.baseboard_notch_height_mm ?? 80}×{config.baseboard_notch_depth_mm ?? 15} mm)
              </text>
            </>
          )}

          {/* Yan Kesit Derinlik Ölçüsü */}
          <line
            x1={secOx}
            y1={secOy - 15}
            x2={secOx + secDrawW}
            y2={secOy - 15}
            stroke={dimColor}
            strokeWidth="1.5"
          />
          <line
            x1={secOx}
            y1={secOy - 20}
            x2={secOx}
            y2={secOy - 10}
            stroke={dimColor}
            strokeWidth="1.5"
          />
          <line
            x1={secOx + secDrawW}
            y1={secOy - 20}
            x2={secOx + secDrawW}
            y2={secOy - 10}
            stroke={dimColor}
            strokeWidth="1.5"
          />
          <text
            x={secOx + secDrawW / 2}
            y={secOy - 20}
            textAnchor="middle"
            fontSize="12"
            fontWeight="bold"
            fill={dimColor}
            className="font-mono"
          >
            D: {Math.round(maxD)} mm
          </text>

          {/* 3. İMALAT ANTETİ VE TEKNİK BİLGİ TABLOSU */}
          <rect
            x="1040"
            y="620"
            width="520"
            height="340"
            fill={badgeBg}
            stroke={borderColor}
            strokeWidth="2"
          />
          <rect x="1040" y="620" width="520" height="32" fill={borderColor} />
          <text
            x="1055"
            y="641"
            fontSize="12"
            fontWeight="bold"
            fill="#FFFFFF"
            className="font-mono"
          >
            KRİTİK İMALAT &amp; MONTAJ KONTROL PARAMETRELERİ
          </text>

          {[
            ["Gövde Plaka Malzemesi", config.body_material],
            ["Kapak Malzemesi", config.door_material || config.body_material],
            [
              "Bağlantı Mimarisi",
              config.fastener_type === "cabineo_12"
                ? "Lamello Cabineo 12 (3-Eksen)"
                : "Minifiks Ø15 + Kavela Ø8",
            ],
            ["Hırdavat Marka Tercihi", (config.hardware_brand || "Standart").toUpperCase()],
            ["Toplam Parça Sayısı", `${bom.parts.length} Adet Ahşap Panel`],
            ["Toplam CNC Delik / Yuva", `${bom.total_drill_count} Adet Sistem 32 / Menteşe`],
            ["2.0mm Ön PVC Metrajı", `${bom.total_pvc_20_meters.toFixed(1)} Metre`],
            [
              "Arkalık Montaj Tipi",
              config.back_panel_type === "grooved_8mm"
                ? "8 mm Kanal İçi Geçme (Grooved)"
                : "3 mm Arkadan Çakma",
            ],
          ].map(([label, val], idx) => {
            const rowY = 620 + 55 + idx * 32;
            return (
              <g key={`param-${idx}`}>
                <text x="1055" y={rowY} fontSize="11" fill={textColor} className="font-mono">
                  {label}:
                </text>
                <text
                  x="1545"
                  y={rowY}
                  textAnchor="end"
                  fontSize="11"
                  fontWeight="bold"
                  fill={dimColor}
                  className="font-mono"
                >
                  {val}
                </text>
                <line x1="1055" y1={rowY + 6} x2="1545" y2={rowY + 6} stroke={gridColor} strokeWidth="0.8" />
              </g>
            );
          })}

          <text x="1055" y="945" fontSize="10" fill={textColor} className="font-mono">
            ATÖLYE SORUMLUSU ONAYI: _______________________ TARİH: ____/____/2026
          </text>
        </svg>
      </div>

      {/* Montaj Parça Listesi Özeti */}
      <div className="rounded-2xl border border-slate-800 bg-slate-900/90 p-4 shadow-xl">
        <h3 className="text-xs font-bold uppercase tracking-wider text-slate-200">
          Atölye Montaj Sıralaması &amp; Panel Kimlik Listesi ({bom.parts.length} Parça)
        </h3>
        <div className="mt-3 overflow-x-auto">
          <table className="w-full text-left text-xs font-mono">
            <thead>
              <tr className="border-b border-slate-800 text-slate-400">
                <th className="py-2 px-3">ID</th>
                <th className="py-2 px-3">Kod</th>
                <th className="py-2 px-3">Parça Adı</th>
                <th className="py-2 px-3">Net Ölçü</th>
                <th className="py-2 px-3">Testere Kesim (PVC Düşülmüş)</th>
                <th className="py-2 px-3">Adet</th>
                <th className="py-2 px-3">CNC İşlem</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 text-slate-300">
              {bom.parts.map((p) => (
                <tr key={p.part_id} className="hover:bg-slate-800/40">
                  <td className="py-2 px-3 font-bold text-sky-400">{p.part_id}</td>
                  <td className="py-2 px-3 text-slate-400">{p.code}</td>
                  <td className="py-2 px-3 font-medium text-white">{p.name}</td>
                  <td className="py-2 px-3">
                    {p.net_length_mm} × {p.net_width_mm} mm
                  </td>
                  <td className="py-2 px-3 text-emerald-400">
                    {p.cut_length_mm} × {p.cut_width_mm} mm
                  </td>
                  <td className="py-2 px-3">{p.quantity}</td>
                  <td className="py-2 px-3 text-slate-400">
                    {p.drills.length} Delik · {p.grooves.length} Kanal
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
