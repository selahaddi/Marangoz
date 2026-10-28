import { useState } from "react";
import { Calculator, Clock, Coins, Printer, TrendingUp } from "lucide-react";
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
              onClick={() => window.print()}
              className="inline-flex items-center gap-1.5 rounded-lg bg-sky-600 px-3 py-1.5 text-xs font-bold text-white transition hover:bg-sky-500"
            >
              <Printer className="h-3.5 w-3.5" />
              Müşteri Teklifini Yazdır
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
    </div>
  );
}
