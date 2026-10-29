import { useState } from "react";
import {
  AlertTriangle,
  Calculator,
  CheckCircle,
  Clock,
  Coins,
  FileCheck,
  FileText,
  Printer,
  ShieldCheck,
  TrendingUp,
  X,
} from "lucide-react";
import type { BOMReport, NestingResult } from "../types/cabinet";

interface CostQuoteViewProps {
  jobId: string;
  bom: BOMReport;
  nesting: NestingResult;
}

interface QuoteLineItem {
  code: string;
  category: string;
  description: string;
  quantityText: string;
  unitPriceTl: number;
  totalTl: number;
}

const formatTl = (val: number): string =>
  new Intl.NumberFormat("tr-TR", {
    style: "currency",
    currency: "TRY",
    maximumFractionDigits: 0,
  }).format(Math.round(val));

export function CostQuoteView({ jobId, bom, nesting }: CostQuoteViewProps) {
  // Atölye Birim Fiyat Parametreleri (Kullanıcı tarafından anlık düzenlenebilir)
  const [sheet18PriceTl, setSheet18PriceTl] = useState<number>(1850);
  const [sheet8PriceTl, setSheet8PriceTl] = useState<number>(980);
  const [pvc20PricePerM, setPvc20PricePerM] = useState<number>(18);
  const pvc04PricePerM = 7;
  const [cncMinuteRateTl, setCncMinuteRateTl] = useState<number>(28);
  const [laborHourRateTl, setLaborHourRateTl] = useState<number>(450);
  const [profitMarginPct, setProfitMarginPct] = useState<number>(35);
  const [applyRemnantCredit, setApplyRemnantCredit] = useState<boolean>(true);

  // Kurumsal PDF Sözleşme Parametreleri
  const [showContractModal, setShowContractModal] = useState<boolean>(false);
  const [customerName, setCustomerName] = useState<string>("Değerli Müşterimiz");
  const [projectTitle, setProjectTitle] = useState<string>(bom.config.name);
  const [deliveryAddress, setDeliveryAddress] = useState<string>("Kadıköy / İstanbul");
  const [deliveryDays, setDeliveryDays] = useState<number>(14);

  // 1. Plaka Sayıları (18mm Gövde/Kapak vs 8mm/3mm Arkalık)
  const sheets18Count = nesting.sheets.filter(
    (s) => s.thickness_mm >= 15
  ).length;
  const sheetsThinCount = nesting.sheets.filter(
    (s) => s.thickness_mm < 15
  ).length;

  const grossSheet18Cost = sheets18Count * sheet18PriceTl;
  const grossSheetThinCost = sheetsThinCount * sheet8PriceTl;

  // Kullanılabilir Artık Plaka (Remnant >= 400x600mm) İade Değeri
  const sheetGrossAreaM2 =
    (nesting.sheet_width_mm * nesting.sheet_height_mm) / 1_000_000.0;
  const pricePerM2Body =
    sheetGrossAreaM2 > 0 ? sheet18PriceTl / sheetGrossAreaM2 : 315;
  const reusableRemnantM2 = nesting.reusable_remnant_area_m2 ?? 0;
  const remnantCreditTl = applyRemnantCredit
    ? reusableRemnantM2 * pricePerM2Body * 0.75
    : 0;

  // 2. PVC Kenar Bandı Maliyeti (%10 makine baş-son kesim firesi dahil)
  const pvc20WithWasteM = bom.total_pvc_20_meters * 1.1;
  const pvc04WithWasteM =
    (bom.total_pvc_04_meters + bom.total_pvc_10_meters) * 1.1;
  const pvcCostTl =
    pvc20WithWasteM * pvc20PricePerM + pvc04WithWasteM * pvc04PricePerM;

  // 3. Hırdavat Birim Fiyat Haritası
  const hardwareUnitPrices: Record<string, number> = {
    "HRD-CBN-12": 24,
    "HRD-MNFX-15": 9,
    "HRD-KVLA-08": 1.5,
    "HRD-AYK-100": 22,
    "HRD-RAFP-05": 2.5,
    "HRD-MNTS-35": 48,
    "HRD-PSTN-100": 95,
    "HRD-KULP-160": 85,
  };

  let hardwareTotalTl = 0;
  const hardwareLines: QuoteLineItem[] = [];
  for (const hItem of bom.hardware) {
    if (hItem.code.startsWith("PVC-")) continue;
    const unitPrice = hItem.code.startsWith("HRD-CRAY-")
      ? 210
      : hardwareUnitPrices[hItem.code] ?? 25;
    const lineTotal = hItem.quantity * unitPrice;
    hardwareTotalTl += lineTotal;
    hardwareLines.push({
      code: hItem.code,
      category: "Hırdavat & Bağlantı",
      description: hItem.name,
      quantityText: `${hItem.quantity} ${hItem.unit}`,
      unitPriceTl: unitPrice,
      totalTl: lineTotal,
    });
  }

  // 4. CNC İşleme ve Atölye Montaj Süresi Hesabı
  const totalPerimeterMeters = bom.parts.reduce(
    (acc, p) =>
      acc +
      ((2 * (p.cut_length_mm + p.cut_width_mm)) / 1000.0) * p.quantity,
    0
  );
  const totalGrooves = bom.parts.reduce(
    (acc, p) => acc + p.grooves.length * p.quantity,
    0
  );
  const isRouterMode = bom.config.cutting_mode === "cnc_router";
  const routingMinutes =
    totalPerimeterMeters / (isRouterMode ? 4.2 : 7.5) +
    (bom.total_drill_count * 2.2) / 60.0 +
    (totalGrooves * 18.0) / 60.0 +
    nesting.total_sheets * 3.5;
  const cncTotalMinutes = Math.max(8, Math.round(routingMinutes));
  const cncCostTl = cncTotalMinutes * cncMinuteRateTl;

  // Cabineo 12 seçildiğinde kavela ve yatay delik olmadığı için montaj %25 daha hızlıdır
  const isCabineo = bom.config.fastener_type === "cabineo_12";
  const assemblyHours = Number(
    (
      ((bom.total_parts_count * (isCabineo ? 2.1 : 2.8) +
        (bom.config.drawer_count ?? 0) * 12) /
        60.0)
    ).toFixed(2)
  );
  const laborCostTl = assemblyHours * laborHourRateTl;

  // 5. Toplam Maliyet, Kâr Marjı ve KDV Hesabı
  const netManufacturingCostTl = Math.max(
    500,
    grossSheet18Cost +
      grossSheetThinCost -
      remnantCreditTl +
      pvcCostTl +
      hardwareTotalTl +
      cncCostTl +
      laborCostTl
  );
  const profitAmountTl = netManufacturingCostTl * (profitMarginPct / 100.0);
  const subtotalQuoteTl = netManufacturingCostTl + profitAmountTl;
  const vatAmountTl = subtotalQuoteTl * 0.2;
  const grandTotalQuoteTl = subtotalQuoteTl + vatAmountTl;

  const quoteLines: QuoteLineItem[] = [
    {
      code: "MAT-PLK-18",
      category: "Ahşap Panel",
      description: `18 mm Gövde & Kapak Plakası (${bom.config.body_material})`,
      quantityText: `${sheets18Count} Plaka (${bom.total_net_area_m2.toFixed(2)} m² Net)`,
      unitPriceTl: sheet18PriceTl,
      totalTl: grossSheet18Cost,
    },
    ...(sheetsThinCount > 0
      ? [
          {
            code: "MAT-PLK-08",
            category: "Arkalık Panel",
            description: "8 mm / 3 mm Arkalık ve Çekmece Taban Plakası",
            quantityText: `${sheetsThinCount} Plaka`,
            unitPriceTl: sheet8PriceTl,
            totalTl: grossSheetThinCost,
          },
        ]
      : []),
    ...(applyRemnantCredit && reusableRemnantM2 > 0
      ? [
          {
            code: "REM-STOK-IADE",
            category: "Artık Plaka İadesi",
            description:
              "≥ 400×600 mm Kullanılabilir Artık Plaka Depo Değeri (%75 İade)",
            quantityText: `${reusableRemnantM2.toFixed(2)} m² Artık`,
            unitPriceTl: -Math.round(pricePerM2Body * 0.75),
            totalTl: -remnantCreditTl,
          },
        ]
      : []),
    {
      code: "PVC-BANT-SET",
      category: "Kenar Bandı",
      description: `PVC Kenar Bandı (2.0mm: ${pvc20WithWasteM.toFixed(1)}m + 0.4mm: ${pvc04WithWasteM.toFixed(1)}m, %10 Fire Dahil)`,
      quantityText: `${(pvc20WithWasteM + pvc04WithWasteM).toFixed(1)} Metre`,
      unitPriceTl: pvc20PricePerM,
      totalTl: pvcCostTl,
    },
    ...hardwareLines,
    {
      code: "OPS-CNC-CAM",
      category: "CNC & Ebatlama",
      description: `CNC İşleme, Kanal Açma & Ebatlama (${bom.total_drill_count} Delik, ${totalGrooves} Kanal)`,
      quantityText: `${cncTotalMinutes} Dakika`,
      unitPriceTl: cncMinuteRateTl,
      totalTl: cncCostTl,
    },
    {
      code: "OPS-MONTAJ",
      category: "Atölye İşçilik",
      description: `Atölye Ön Montaj, Bantlama & Kalite Kontrol (${isCabineo ? "Cabineo Hızlı Montaj" : "Minifiks + Kavela"})`,
      quantityText: `${assemblyHours} Saat`,
      unitPriceTl: laborHourRateTl,
      totalTl: laborCostTl,
    },
  ];

  return (
    <div className="space-y-5">
      {/* Üst Özet Kartları */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="rounded-xl border border-slate-800 bg-slate-900/80 p-3.5">
          <span className="flex items-center gap-1.5 text-xs text-slate-400">
            <Coins className="h-3.5 w-3.5 text-sky-400" />
            Net Atölye İmalat Maliyeti
          </span>
          <p className="mt-1 text-lg font-bold text-slate-100">
            {formatTl(netManufacturingCostTl)}
          </p>
          <span className="text-[11px] text-emerald-400">
            Artık plaka iadesi: -{formatTl(remnantCreditTl)}
          </span>
        </div>

        <div className="rounded-xl border border-slate-800 bg-slate-900/80 p-3.5">
          <span className="flex items-center gap-1.5 text-xs text-slate-400">
            <Clock className="h-3.5 w-3.5 text-amber-400" />
            CNC + Atölye Üretim Süresi
          </span>
          <p className="mt-1 text-lg font-bold text-amber-300">
            {cncTotalMinutes} dk CNC + {assemblyHours} sa Montaj
          </p>
          <span className="text-[11px] text-slate-400">
            {bom.total_drill_count} delik ·{" "}
            {totalPerimeterMeters.toFixed(1)} m kesim çevresi
          </span>
        </div>

        <div className="rounded-xl border border-slate-800 bg-slate-900/80 p-3.5">
          <span className="flex items-center gap-1.5 text-xs text-slate-400">
            <TrendingUp className="h-3.5 w-3.5 text-indigo-400" />
            Atölye Brüt Kâr (%{profitMarginPct})
          </span>
          <p className="mt-1 text-lg font-bold text-indigo-300">
            {formatTl(profitAmountTl)}
          </p>
          <span className="text-[11px] text-slate-400">
            KDV Hariç Satış: {formatTl(subtotalQuoteTl)}
          </span>
        </div>

        <div className="rounded-xl border border-emerald-500/40 bg-emerald-950/30 p-3.5">
          <span className="flex items-center gap-1.5 text-xs font-semibold text-emerald-300">
            <Calculator className="h-3.5 w-3.5 text-emerald-400" />
            Müşteri Anahtar Teslim Teklifi
          </span>
          <p className="mt-1 text-xl font-extrabold text-emerald-300">
            {formatTl(grandTotalQuoteTl)}
          </p>
          <span className="text-[11px] text-emerald-200/80">
            %20 KDV ({formatTl(vatAmountTl)}) Dahil
          </span>
        </div>
      </div>

      {/* Birim Fiyat ve Kâr Marjı Parametre Kontrol Çubuğu */}
      <div className="rounded-xl border border-slate-800 bg-slate-900/80 p-4">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <div>
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-200">
              Atölye Birim Fiyat &amp; Kâr Marjı Ayarları (Canlı Hesaplama)
            </h3>
            <p className="text-[11px] text-slate-400">
              Tedarikçi plaka, PVC, CNC dakika ve işçilik birim fiyatlarını
              güncellediğinizde teklif tablosu anında yeniden hesaplanır.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <label className="flex items-center gap-1.5 text-xs text-emerald-300">
              <input
                type="checkbox"
                checked={applyRemnantCredit}
                onChange={(e) => setApplyRemnantCredit(e.target.checked)}
                className="rounded border-slate-700 bg-slate-950 text-emerald-500"
              />
              Artık Plaka (≥400×600) İadesini Düş
            </label>
            <button
              type="button"
              onClick={() => setShowContractModal(true)}
              className="inline-flex items-center gap-1.5 rounded-lg border border-indigo-500/40 bg-indigo-600/80 hover:bg-indigo-500 px-3 py-1.5 text-xs font-bold text-white transition shadow"
            >
              <FileCheck className="h-3.5 w-3.5" />
              Resmi Sözleşme & Teklif PDF'i
            </button>
            <button
              type="button"
              onClick={() => window.print()}
              className="inline-flex items-center gap-1.5 rounded-lg bg-sky-600 px-3 py-1.5 text-xs font-bold text-white transition hover:bg-sky-500"
            >
              <Printer className="h-3.5 w-3.5" />
              Hızlı Yazdır
            </button>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-6">
          <div>
            <label className="block text-[11px] font-medium text-slate-300">
              18mm Plaka (TL/Adet)
            </label>
            <input
              type="number"
              min={500}
              max={10000}
              value={sheet18PriceTl}
              onChange={(e) => setSheet18PriceTl(Number(e.target.value))}
              className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-2.5 py-1.5 font-mono text-xs text-slate-100"
            />
          </div>
          <div>
            <label className="block text-[11px] font-medium text-slate-300">
              8mm Arkalık (TL/Adet)
            </label>
            <input
              type="number"
              min={200}
              max={6000}
              value={sheet8PriceTl}
              onChange={(e) => setSheet8PriceTl(Number(e.target.value))}
              className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-2.5 py-1.5 font-mono text-xs text-slate-100"
            />
          </div>
          <div>
            <label className="block text-[11px] font-medium text-slate-300">
              2.0mm PVC (TL/m)
            </label>
            <input
              type="number"
              min={1}
              max={200}
              value={pvc20PricePerM}
              onChange={(e) => setPvc20PricePerM(Number(e.target.value))}
              className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-2.5 py-1.5 font-mono text-xs text-slate-100"
            />
          </div>
          <div>
            <label className="block text-[11px] font-medium text-slate-300">
              CNC İşleme (TL/dk)
            </label>
            <input
              type="number"
              min={5}
              max={300}
              value={cncMinuteRateTl}
              onChange={(e) => setCncMinuteRateTl(Number(e.target.value))}
              className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-2.5 py-1.5 font-mono text-xs text-slate-100"
            />
          </div>
          <div>
            <label className="block text-[11px] font-medium text-slate-300">
              Atölye İşçilik (TL/Saat)
            </label>
            <input
              type="number"
              min={100}
              max={3000}
              value={laborHourRateTl}
              onChange={(e) => setLaborHourRateTl(Number(e.target.value))}
              className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-2.5 py-1.5 font-mono text-xs text-slate-100"
            />
          </div>
          <div>
            <label className="block text-[11px] font-medium text-slate-300">
              Kâr Marjı (%)
            </label>
            <input
              type="number"
              min={0}
              max={150}
              value={profitMarginPct}
              onChange={(e) => setProfitMarginPct(Number(e.target.value))}
              className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-2.5 py-1.5 font-mono text-xs text-emerald-300"
            />
          </div>
        </div>
      </div>

      {/* Mühendislik ve Statik Sehim Denetim Kartı */}
      {bom.engineering_audit && (
        <div className="rounded-2xl border border-slate-800 bg-slate-900/90 p-4 shadow-xl backdrop-blur-sm">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800/80 pb-3">
            <div className="flex items-center gap-2.5">
              <ShieldCheck
                className={`h-5 w-5 ${
                  bom.engineering_audit.has_critical_issues
                    ? "text-amber-400"
                    : "text-emerald-400"
                }`}
              />
              <div>
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-100">
                  Mobilya Mühendislik ve Statik Sehim Denetim Raporu
                </h3>
                <p className="text-[11px] text-slate-400">
                  TS EN 14749 &amp; Euler-Bernoulli Kiriş Teorisi Standartlarında Taşıma Kapasitesi Analizi
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span
                className={`rounded-lg px-2.5 py-1 font-mono text-xs font-bold ${
                  bom.engineering_audit.has_critical_issues
                    ? "bg-amber-500/20 text-amber-300 border border-amber-500/30"
                    : "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30"
                }`}
              >
                Sağlık Skoru: %{bom.engineering_audit.overall_health_score} / 100
              </span>
            </div>
          </div>

          {/* Özet Mesajlar */}
          <div className="mt-3 flex flex-wrap gap-2 text-xs">
            {bom.engineering_audit.summary_messages.map((msg, idx) => (
              <div
                key={`audit-msg-${idx}`}
                className={`flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-[11px] font-medium ${
                  bom.engineering_audit?.has_critical_issues
                    ? "bg-amber-500/10 text-amber-300 border border-amber-500/20"
                    : "bg-emerald-500/10 text-emerald-300 border border-emerald-500/20"
                }`}
              >
                {bom.engineering_audit?.has_critical_issues ? (
                  <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
                ) : (
                  <CheckCircle className="h-3.5 w-3.5 shrink-0" />
                )}
                <span>{msg}</span>
              </div>
            ))}
          </div>

          {/* Sehim Uyarıları ve Detayları */}
          {bom.engineering_audit.shelf_deflections.some((s) => !s.is_acceptable) && (
            <div className="mt-3 space-y-2">
              <h4 className="text-[11px] font-bold text-amber-300 uppercase tracking-wider">
                Raf Esneme (Sehim) Uyarıları
              </h4>
              <div className="grid gap-2 sm:grid-cols-2">
                {bom.engineering_audit.shelf_deflections
                  .filter((s) => !s.is_acceptable)
                  .map((s) => (
                    <div
                      key={s.shelf_id}
                      className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-3 text-xs"
                    >
                      <div className="flex items-center justify-between font-bold text-amber-300">
                        <span>
                          {s.shelf_id} ({s.span_mm}×{s.depth_mm} mm)
                        </span>
                        <span className="font-mono">{s.deflection_mm} mm sehim</span>
                      </div>
                      <p className="mt-1 text-slate-300 text-[11px]">{s.warning}</p>
                      {s.recommendation && (
                        <p className="mt-1.5 font-medium text-sky-300 text-[11px]">
                          💡 Tavsiye: {s.recommendation}
                        </p>
                      )}
                    </div>
                  ))}
              </div>
            </div>
          )}

          {/* Şantiye ve Duvar Uyarıları */}
          {bom.engineering_audit.site_fitting.warnings.length > 0 && (
            <div className="mt-3 rounded-xl border border-sky-500/30 bg-sky-500/5 p-3 text-xs">
              <h4 className="text-[11px] font-bold text-sky-300 uppercase tracking-wider">
                Şantiye &amp; Rölöve Montaj Uyarıları
              </h4>
              <ul className="mt-1.5 space-y-1 text-slate-300 text-[11px] list-disc list-inside">
                {bom.engineering_audit.site_fitting.warnings.map((w, idx) => (
                  <li key={`site-warn-${idx}`}>{w}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      {/* Modern Web Guidance: responsive-table */}
      <div
        tabIndex={0}
        role="region"
        aria-labelledby="quote-table-caption"
        className="table-wrapper rounded-xl border border-slate-800 bg-slate-900/80 shadow-inner"
      >
        <table className="quote-table text-left text-xs">
          <caption
            id="quote-table-caption"
            className="border-b border-slate-800 bg-slate-900 px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wider text-slate-300"
          >
            Detaylı Maliyet Kalemleri ve Müşteri Teklif Dökümü (İş No: #{jobId} —{" "}
            {bom.config.name})
          </caption>
          <thead className="bg-slate-800/95 text-slate-300">
            <tr>
              <th className="px-3.5 py-2.5 font-semibold">Kalem Kodu</th>
              <th className="px-3.5 py-2.5 font-semibold">Kategori</th>
              <th className="px-3.5 py-2.5 font-semibold">Açıklama</th>
              <th className="px-3.5 py-2.5 font-semibold">Miktar / Süre</th>
              <th className="px-3.5 py-2.5 font-semibold">Birim Fiyat</th>
              <th className="px-3.5 py-2.5 text-right font-semibold text-emerald-300">
                Toplam Tutar
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/80">
            {quoteLines.map((item) => (
              <tr key={item.code} className="hover:bg-slate-800/40">
                <th className="px-3.5 py-2.5 font-mono font-bold text-sky-400">
                  {item.code}
                </th>
                <td className="px-3.5 py-2.5 text-slate-300">{item.category}</td>
                <td className="px-3.5 py-2.5 font-medium text-slate-100">
                  {item.description}
                </td>
                <td className="px-3.5 py-2.5 font-mono text-slate-300">
                  {item.quantityText}
                </td>
                <td className="px-3.5 py-2.5 font-mono text-slate-300">
                  {formatTl(item.unitPriceTl)}
                </td>
                <td
                  className={`px-3.5 py-2.5 text-right font-mono font-bold ${
                    item.totalTl < 0 ? "text-emerald-400" : "text-slate-100"
                  }`}
                >
                  {formatTl(item.totalTl)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Kurumsal Müşteri Sözleşmesi & Teklif PDF Modalı */}
      {showContractModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm">
          <div className="relative flex max-h-[92vh] w-full max-w-4xl flex-col rounded-2xl border border-slate-700 bg-slate-900 shadow-2xl overflow-hidden">
            {/* Modal Üst Kontrol Çubuğu */}
            <div className="flex items-center justify-between border-b border-slate-800 bg-slate-950 px-5 py-3">
              <div className="flex items-center gap-2 text-sm font-bold text-slate-100">
                <FileText className="h-4 w-4 text-sky-400" />
                Resmi Müşteri Teklifi ve İmalat Sözleşmesi (A4 PDF)
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => window.print()}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-bold text-white transition hover:bg-emerald-500"
                >
                  <Printer className="h-3.5 w-3.5" />
                  Yazdır / PDF Kaydet
                </button>
                <button
                  type="button"
                  onClick={() => setShowContractModal(false)}
                  className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-800 hover:text-slate-100 transition"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>

            {/* Müşteri Bilgileri Düzenleme Alanı */}
            <div className="border-b border-slate-800 bg-slate-950/60 p-4 print:hidden">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                Sözleşme Bilgilerini Düzenleyin (Canlı Güncellenir):
              </span>
              <div className="mt-2 grid grid-cols-1 gap-3 sm:grid-cols-4">
                <div>
                  <label className="text-[10px] text-slate-400">Müşteri / Firma Adı</label>
                  <input
                    type="text"
                    value={customerName}
                    onChange={(e) => setCustomerName(e.target.value)}
                    className="mt-0.5 w-full rounded border border-slate-700 bg-slate-900 px-2 py-1 text-xs text-slate-100"
                  />
                </div>
                <div>
                  <label className="text-[10px] text-slate-400">Proje Tanımı</label>
                  <input
                    type="text"
                    value={projectTitle}
                    onChange={(e) => setProjectTitle(e.target.value)}
                    className="mt-0.5 w-full rounded border border-slate-700 bg-slate-900 px-2 py-1 text-xs text-slate-100"
                  />
                </div>
                <div>
                  <label className="text-[10px] text-slate-400">Teslimat Adresi</label>
                  <input
                    type="text"
                    value={deliveryAddress}
                    onChange={(e) => setDeliveryAddress(e.target.value)}
                    className="mt-0.5 w-full rounded border border-slate-700 bg-slate-900 px-2 py-1 text-xs text-slate-100"
                  />
                </div>
                <div>
                  <label className="text-[10px] text-slate-400">Teslim Süresi (İş Günü)</label>
                  <input
                    type="number"
                    value={deliveryDays}
                    onChange={(e) => setDeliveryDays(Number(e.target.value))}
                    className="mt-0.5 w-full rounded border border-slate-700 bg-slate-900 px-2 py-1 text-xs text-slate-100"
                  />
                </div>
              </div>
            </div>

            {/* A4 Sözleşme Gövdesi (Yazdırılabilir) */}
            <div className="overflow-y-auto p-6 text-slate-900 bg-white min-h-[500px]">
              {/* Antet */}
              <div className="flex items-start justify-between border-b-2 border-slate-900 pb-4">
                <div>
                  <h1 className="text-xl font-black tracking-tight text-slate-900">
                    MARANGOZ ENDÜSTRİYEL PANEL MOBİLYA SAN. TİC. LTD. ŞTİ.
                  </h1>
                  <p className="text-xs text-slate-600">
                    CAD/CAM CNC Fabrikasyon İmalat &bull; Sistem 32 / Cabineo Modüler Üretim
                  </p>
                  <p className="text-[11px] text-slate-500">
                    Atölye: Sanayi Mh. Mobilyacılar Sitesi 4. Blok No:12 &bull; info@marangoz-cad.com
                  </p>
                </div>
                <div className="text-right">
                  <div className="rounded bg-slate-900 px-2.5 py-1 text-xs font-bold text-white inline-block">
                    RESMİ TEKLİF &amp; İMALAT SÖZLEŞMESİ
                  </div>
                  <div className="mt-1 text-xs font-mono font-bold text-slate-800">
                    NO: MRG-TKF-{jobId.toUpperCase()}
                  </div>
                  <div className="text-xs text-slate-600">
                    Tarih: {new Date().toLocaleDateString("tr-TR")}
                  </div>
                </div>
              </div>

              {/* Taraflar ve Proje Bilgileri */}
              <div className="mt-4 grid grid-cols-2 gap-4 rounded-lg bg-slate-50 p-3.5 border border-slate-200 text-xs">
                <div>
                  <span className="font-bold text-slate-800">MÜŞTERİ / ALICI:</span>
                  <p className="font-semibold text-slate-900 mt-0.5">{customerName}</p>
                  <p className="text-slate-600">Teslimat Adresi: {deliveryAddress}</p>
                </div>
                <div>
                  <span className="font-bold text-slate-800">PROJE / İŞ EMRİ TANIMI:</span>
                  <p className="font-semibold text-slate-900 mt-0.5">{projectTitle}</p>
                  <p className="text-slate-600">
                    Dış Ebatlar: {bom.config.width_mm} × {bom.config.height_mm} × {bom.config.depth_mm} mm
                  </p>
                </div>
              </div>

              {/* Malzeme & Teknik Şartname */}
              <div className="mt-4">
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-900 border-b border-slate-300 pb-1">
                  1. TEKNİK MALZEME VE İMALAT ŞARTNAMESİ
                </h4>
                <div className="mt-2 grid grid-cols-2 gap-2 text-xs text-slate-700">
                  <div>
                    &bull; <strong>Gövde Malzemesi:</strong> {bom.config.body_material} (18 mm)
                  </div>
                  <div>
                    &bull; <strong>Kapak / Klapa:</strong> {bom.config.door_material || bom.config.body_material}
                  </div>
                  <div>
                    &bull; <strong>Bağlantı Tipi:</strong> {bom.config.fastener_type === "cabineo_12" ? "Lamello Cabineo 12 Saf Z-CNC Cepleri" : "Minifiks Rasteks + Ahşap Kavela"}
                  </div>
                  <div>
                    &bull; <strong>Kenar Bantlama:</strong> Ön kenarlar 2.0 mm darbe emici PVC, iç kenarlar 0.4 mm
                  </div>
                  <div>
                    &bull; <strong>Arkalık Sistemi:</strong> {bom.config.back_panel_type === "grooved_8mm" ? "8 mm Kanal İçi Mukavim Arkalık" : "3 mm Çakma Arkalık"}
                  </div>
                  <div>
                    &bull; <strong>Toplam Parça / Delik:</strong> {bom.total_parts_count} Parça &bull; {bom.total_drill_count} CNC Delik
                  </div>
                </div>
              </div>

              {/* Fiyat ve Maliyet Döküm Tablosu */}
              <div className="mt-4">
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-900 border-b border-slate-300 pb-1">
                  2. FİYAT DÖKÜMÜ VE MALİYET TABLOSU
                </h4>
                <table className="mt-2 w-full text-left text-xs border border-slate-300">
                  <thead className="bg-slate-100 text-slate-800 border-b border-slate-300">
                    <tr>
                      <th className="p-2 font-bold">Kalem Tanımı</th>
                      <th className="p-2 font-bold">Miktar / Metraj</th>
                      <th className="p-2 font-bold text-right">Birim Fiyat</th>
                      <th className="p-2 font-bold text-right">Tutar (TL)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    <tr>
                      <td className="p-2">18 mm Ahşap Panel ({sheets18Count} Plaka, {bom.total_net_area_m2.toFixed(2)} m² Net)</td>
                      <td className="p-2">{sheets18Count} Adet</td>
                      <td className="p-2 text-right">{formatTl(sheet18PriceTl)}</td>
                      <td className="p-2 text-right font-semibold">{formatTl(grossSheet18Cost)}</td>
                    </tr>
                    {sheetsThinCount > 0 && (
                      <tr>
                        <td className="p-2">8 mm / 3 mm Arkalık Paneli</td>
                        <td className="p-2">{sheetsThinCount} Adet</td>
                        <td className="p-2 text-right">{formatTl(sheet8PriceTl)}</td>
                        <td className="p-2 text-right font-semibold">{formatTl(grossSheetThinCost)}</td>
                      </tr>
                    )}
                    {applyRemnantCredit && remnantCreditTl > 0 && (
                      <tr className="text-emerald-700 bg-emerald-50">
                        <td className="p-2">Artık Plaka Depo İadesi (≥400×600 mm Parçalar)</td>
                        <td className="p-2">{reusableRemnantM2.toFixed(2)} m²</td>
                        <td className="p-2 text-right">İade</td>
                        <td className="p-2 text-right font-semibold">-{formatTl(remnantCreditTl)}</td>
                      </tr>
                    )}
                    <tr>
                      <td className="p-2">PVC Kenar Bandı (2.0mm + 0.4mm, %10 fire dahil)</td>
                      <td className="p-2">{(pvc20WithWasteM + pvc04WithWasteM).toFixed(1)} m</td>
                      <td className="p-2 text-right">{formatTl(pvc20PricePerM)}</td>
                      <td className="p-2 text-right font-semibold">{formatTl(pvcCostTl)}</td>
                    </tr>
                    <tr>
                      <td className="p-2">Hırdavat, Ray, Menteşe ve Bağlantı Elemanları Seti</td>
                      <td className="p-2">1 Takım</td>
                      <td className="p-2 text-right">-</td>
                      <td className="p-2 text-right font-semibold">{formatTl(hardwareTotalTl)}</td>
                    </tr>
                    <tr>
                      <td className="p-2">CNC Ebatlama, Delik Delme &amp; Freze İşleme Süresi</td>
                      <td className="p-2">{cncTotalMinutes} Dakika</td>
                      <td className="p-2 text-right">{formatTl(cncMinuteRateTl)}/dk</td>
                      <td className="p-2 text-right font-semibold">{formatTl(cncCostTl)}</td>
                    </tr>
                    <tr>
                      <td className="p-2">Atölye Ön Montaj, Bantlama ve İşçilik</td>
                      <td className="p-2">{assemblyHours} Saat</td>
                      <td className="p-2 text-right">{formatTl(laborHourRateTl)}/sa</td>
                      <td className="p-2 text-right font-semibold">{formatTl(laborCostTl)}</td>
                    </tr>
                  </tbody>
                  <tfoot className="border-t-2 border-slate-900 bg-slate-50 font-bold">
                    <tr>
                      <td colSpan={3} className="p-2 text-right">Ara Toplam (KDV Hariç):</td>
                      <td className="p-2 text-right font-mono">{formatTl(subtotalQuoteTl)}</td>
                    </tr>
                    <tr>
                      <td colSpan={3} className="p-2 text-right font-normal text-slate-600">%20 Katma Değer Vergisi (KDV):</td>
                      <td className="p-2 text-right font-mono font-normal text-slate-600">{formatTl(vatAmountTl)}</td>
                    </tr>
                    <tr className="text-sm bg-slate-900 text-white">
                      <td colSpan={3} className="p-2.5 text-right font-black uppercase">GENEL TOPLAM (KDV DAHİL):</td>
                      <td className="p-2.5 text-right font-black font-mono text-emerald-400">{formatTl(grandTotalQuoteTl)}</td>
                    </tr>
                  </tfoot>
                </table>
              </div>

              {/* İmalat & Garanti Şartları */}
              <div className="mt-4 text-[11px] text-slate-600 leading-relaxed border-t border-slate-200 pt-3">
                <h4 className="font-bold text-slate-900 mb-1">3. TESLİM VE GARANTİ ŞARTLARI:</h4>
                <ol className="list-decimal pl-4 space-y-0.5">
                  <li>İşbu sözleşme konusu ürünler sipariş onayından itibaren <strong>{deliveryDays} iş günü</strong> içerisinde montaja hazır hale getirilecektir.</li>
                  <li>Ödeme Şekli: %50 sipariş onayında peşin/havale, %40 fabrikasyon imalat tamamlandığında, %10 montaj ve teslimat sonrasında ödenecektir.</li>
                  <li>Üretilen mobilyalar malzeme ve montaj hatalarına karşı <strong>2 (iki) yıl</strong> süreyle imalatçı firma garantisi altındadır.</li>
                  <li>Bu teklif düzenleme tarihinden itibaren 15 (on beş) gün süreyle geçerlidir.</li>
                </ol>
              </div>

              {/* İmza Alanları */}
              <div className="mt-8 grid grid-cols-2 gap-8 pt-4 border-t-2 border-slate-800">
                <div className="text-center">
                  <p className="font-bold text-xs text-slate-800">MÜŞTERİ / ALICI</p>
                  <p className="text-[11px] text-slate-500 mt-0.5">Teklif ve Şartları Kabul Ediyorum</p>
                  <div className="mt-8 border-b border-dashed border-slate-400 mx-12" />
                  <p className="mt-1 text-[11px] font-semibold text-slate-700">İmza / Kaşe</p>
                </div>
                <div className="text-center">
                  <p className="font-bold text-xs text-slate-800">İMALATÇI / YÜKLENİCİ FİRMA</p>
                  <p className="text-[11px] text-slate-500 mt-0.5">Marangoz Endüstriyel Panel Sistemleri</p>
                  <div className="mt-8 border-b border-dashed border-slate-400 mx-12" />
                  <p className="mt-1 text-[11px] font-semibold text-slate-700">Yetkili İmza / Kaşe</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
