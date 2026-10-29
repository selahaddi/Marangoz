/**
 * Vercel Serverless Function: POST /api/revise
 *
 * Mevcut dolap parametrelerini (current_config) ve kullanıcının revizyon komutunu (instruction)
 * Google Gemini ile artımlı (incremental) olarak mutasyona uğratır.
 */

const CABINET_TYPES = [
  "wardrobe",
  "kitchen_base",
  "kitchen_wall",
  "kitchen_tall",
  "bathroom_vanity",
  "bathroom_tall",
  "dresser",
  "bookshelf",
  "shoe_cabinet",
  "tv_unit",
];

const DOOR_TYPES = ["none", "single_left", "single_right", "double", "flap_up"];

const REVISION_SYSTEM_INSTRUCTION =
  "Sen mobilya fabrikası için uzman bir CAD/CAM Tasarım ve Revizyon Asistanısın. " +
  "Kullanıcı mevcut bir dolap tasarımında değişiklik (revizyon) istemektedir. " +
  "Girdi olarak sana MEVCUT DOLAP PARAMETRELERİ (JSON) ve KULLANICININ REVİZYON İSTEĞİ verilecektir. " +
  "GÖREVİN: " +
  "1. Kullanıcının değiştirmek istediği özellikleri (ölçü, çekmece, raf, kapak, açık niş, dikey bölmeler, çatı eğimi, L-köşe, renk, malzeme vb.) tespit et. " +
  "2. Kullanıcının açıkça DEĞİŞTİRMEDİĞİ tüm mevcut parametreleri (iç bölmeler, kertmeler, bağlantı tipleri vb.) AYNEN KORU. " +
  "3. Sıfırdan yeni bir dolap üretme; mevcut dolabı mutasyona uğrat. " +
  "4. Ölçüleri milimetre (mm) olarak yaz (örn: 110 cm -> 1100). " +
  "5. Çıktı olarak güncellenmiş parametreleri JSON şemasına uygun olarak üret.";

const RESPONSE_SCHEMA = {
  type: "OBJECT",
  properties: {
    name: { type: "STRING" },
    cabinet_type: { type: "STRING", enum: CABINET_TYPES },
    width_mm: { type: "NUMBER" },
    height_mm: { type: "NUMBER" },
    depth_mm: { type: "NUMBER" },
    shelf_count: { type: "INTEGER" },
    door_type: { type: "STRING", enum: DOOR_TYPES },
    drawer_count: { type: "INTEGER" },
    drawer_front_height_mm: { type: "NUMBER" },
    appliance_niche_height_mm: { type: "NUMBER" },
    niche_height_mm: { type: "NUMBER" },
    niche_bottom_offset_mm: { type: "NUMBER" },
    niche_color_hex: { type: "STRING" },
    niche_back_open: { type: "BOOLEAN" },
    has_plinth: { type: "BOOLEAN" },
    plinth_height_mm: { type: "NUMBER" },
    body_material: { type: "STRING" },
    door_material: { type: "STRING" },
    body_color_hex: { type: "STRING" },
    door_color_hex: { type: "STRING" },
    back_panel_type: { type: "STRING", enum: ["grooved_8mm", "nailed_3mm"] },
    sheet_size: { type: "STRING", enum: ["2800x2100", "3660x1830"] },
    fastener_type: { type: "STRING", enum: ["minifix_dowel", "cabineo_12"] },
    cutting_mode: { type: "STRING", enum: ["panel_saw", "cnc_router"] },
    plinth_type: { type: "STRING", enum: ["wood_plinth", "adjustable_legs"] },
    has_baseboard_notch: { type: "BOOLEAN" },
    baseboard_notch_height_mm: { type: "NUMBER" },
    baseboard_notch_depth_mm: { type: "NUMBER" },
    has_column_notch: { type: "BOOLEAN" },
    column_notch_width_mm: { type: "NUMBER" },
    column_notch_depth_mm: { type: "NUMBER" },
    left_filler_width_mm: { type: "NUMBER" },
    right_filler_width_mm: { type: "NUMBER" },
    has_slope: { type: "BOOLEAN" },
    slope_side: { type: "STRING", enum: ["left", "right"] },
    slope_start_height_mm: { type: "NUMBER" },
    slope_angle_deg: { type: "NUMBER" },
    is_corner_module: { type: "BOOLEAN" },
    corner_angle_deg: { type: "NUMBER" },
    corner_blind_width_mm: { type: "NUMBER" },
    zones: {
      type: "ARRAY",
      items: {
        type: "OBJECT",
        properties: {
          name: { type: "STRING" },
          width_ratio: { type: "NUMBER" },
          width_mm: { type: "NUMBER" },
          shelf_count: { type: "INTEGER" },
          door_type: { type: "STRING", enum: DOOR_TYPES },
          drawer_count: { type: "INTEGER" },
          drawer_front_height_mm: { type: "NUMBER" },
          has_hanging_rod: { type: "BOOLEAN" },
          appliance_niche_height_mm: { type: "NUMBER" },
          niche_height_mm: { type: "NUMBER" },
          niche_bottom_offset_mm: { type: "NUMBER" },
          niche_color_hex: { type: "STRING" },
          niche_back_open: { type: "BOOLEAN" },
          door_color_hex: { type: "STRING" },
        },
      },
    },
  },
  required: ["cabinet_type", "width_mm", "height_mm", "depth_mm"],
};

const clamp = (value, min, max, fallback) => {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(min, Math.min(max, n));
};

const isHex = (v) => typeof v === "string" && /^#[0-9a-fA-F]{6}$/.test(v);

function normalize(raw, currentConfig) {
  const heightMm = clamp(raw.height_mm, 300, 2750, currentConfig?.height_mm ?? 2100);
  const rawNicheH = clamp(
    raw.niche_height_mm ?? raw.appliance_niche_height_mm,
    0,
    Math.max(0, heightMm - 260),
    0
  );
  const nicheOffset = clamp(raw.niche_bottom_offset_mm, 0, heightMm, 0);
  const isBottomNiche = rawNicheH > 0 && nicheOffset <= 0;
  const hasPlinth =
    isBottomNiche ? false : typeof raw.has_plinth === "boolean" ? raw.has_plinth : true;

  const rawZones = Array.isArray(raw.zones) ? raw.zones : [];
  const zones = rawZones.map((z, idx) => ({
    id: typeof z.id === "string" ? z.id : `z_${idx + 1}`,
    name: typeof z.name === "string" && z.name.trim() ? z.name.trim() : `Bölme #${idx + 1}`,
    width_ratio: typeof z.width_ratio === "number" && z.width_ratio > 0 ? z.width_ratio : 1.0,
    width_mm: typeof z.width_mm === "number" && z.width_mm > 0 ? z.width_mm : undefined,
    shelf_count: Math.round(clamp(z.shelf_count, 0, 12, 0)),
    door_type: DOOR_TYPES.includes(z.door_type) ? z.door_type : "none",
    drawer_count: Math.round(clamp(z.drawer_count, 0, 6, 0)),
    drawer_front_height_mm: typeof z.drawer_front_height_mm === "number" ? z.drawer_front_height_mm : 180,
    has_hanging_rod: Boolean(z.has_hanging_rod),
    appliance_niche_height_mm:
      typeof z.appliance_niche_height_mm === "number"
        ? z.appliance_niche_height_mm
        : typeof z.niche_height_mm === "number"
        ? z.niche_height_mm
        : 0,
    niche_height_mm:
      typeof z.niche_height_mm === "number"
        ? z.niche_height_mm
        : typeof z.appliance_niche_height_mm === "number"
        ? z.appliance_niche_height_mm
        : undefined,
    niche_bottom_offset_mm:
      typeof z.niche_bottom_offset_mm === "number" ? z.niche_bottom_offset_mm : undefined,
    niche_color_hex: isHex(z.niche_color_hex) ? z.niche_color_hex : undefined,
    niche_back_open: typeof z.niche_back_open === "boolean" ? z.niche_back_open : undefined,
    door_color_hex: isHex(z.door_color_hex) ? z.door_color_hex : undefined,
  }));

  return {
    name: typeof raw.name === "string" && raw.name.trim() ? raw.name.trim() : currentConfig?.name || "Parametrik Dolap",
    cabinet_type: CABINET_TYPES.includes(raw.cabinet_type) ? raw.cabinet_type : currentConfig?.cabinet_type || "wardrobe",
    width_mm: clamp(raw.width_mm, 300, 2700, currentConfig?.width_mm ?? 900),
    height_mm: heightMm,
    depth_mm: clamp(raw.depth_mm, 200, 900, currentConfig?.depth_mm ?? 580),
    shelf_count: Math.round(clamp(raw.shelf_count, 0, 12, currentConfig?.shelf_count ?? 0)),
    door_type: DOOR_TYPES.includes(raw.door_type) ? raw.door_type : currentConfig?.door_type || "double",
    drawer_count: Math.round(clamp(raw.drawer_count, 0, 6, currentConfig?.drawer_count ?? 0)),
    drawer_front_height_mm: clamp(raw.drawer_front_height_mm, 120, 350, currentConfig?.drawer_front_height_mm ?? 180),
    appliance_niche_height_mm: rawNicheH,
    niche_height_mm: rawNicheH,
    niche_bottom_offset_mm: nicheOffset,
    niche_color_hex: isHex(raw.niche_color_hex) ? raw.niche_color_hex : undefined,
    niche_back_open: typeof raw.niche_back_open === "boolean" ? raw.niche_back_open : undefined,
    has_plinth: hasPlinth,
    plinth_height_mm: hasPlinth ? clamp(raw.plinth_height_mm, 50, 200, currentConfig?.plinth_height_mm ?? 80) : 0,
    body_material:
      typeof raw.body_material === "string" && raw.body_material.trim()
        ? raw.body_material.trim()
        : currentConfig?.body_material || "18mm Beyaz Suntalam",
    door_material:
      typeof raw.door_material === "string" && raw.door_material.trim()
        ? raw.door_material.trim()
        : currentConfig?.door_material || "",
    body_color_hex: isHex(raw.body_color_hex) ? raw.body_color_hex : currentConfig?.body_color_hex || "#F4F1EA",
    door_color_hex: isHex(raw.door_color_hex) ? raw.door_color_hex : currentConfig?.door_color_hex || "#C89F70",
    front_pvc_thickness_mm: currentConfig?.front_pvc_thickness_mm ?? 2.0,
    hidden_pvc_thickness_mm: currentConfig?.hidden_pvc_thickness_mm ?? 0.4,
    back_panel_type: raw.back_panel_type === "nailed_3mm" ? "nailed_3mm" : "grooved_8mm",
    sheet_size: raw.sheet_size === "3660x1830" ? "3660x1830" : "2800x2100",
    fastener_type: raw.fastener_type === "cabineo_12" ? "cabineo_12" : "minifix_dowel",
    cutting_mode: raw.cutting_mode === "cnc_router" ? "cnc_router" : "panel_saw",
    plinth_type: raw.plinth_type === "adjustable_legs" ? "adjustable_legs" : "wood_plinth",
    has_baseboard_notch: Boolean(raw.has_baseboard_notch),
    baseboard_notch_height_mm: clamp(raw.baseboard_notch_height_mm, 30, 200, 80),
    baseboard_notch_depth_mm: clamp(raw.baseboard_notch_depth_mm, 5, 50, 15),
    has_column_notch: Boolean(raw.has_column_notch),
    column_notch_width_mm: clamp(raw.column_notch_width_mm, 40, 400, 120),
    column_notch_depth_mm: clamp(raw.column_notch_depth_mm, 40, 400, 120),
    left_filler_width_mm: clamp(raw.left_filler_width_mm, 0, 200, 0),
    right_filler_width_mm: clamp(raw.right_filler_width_mm, 0, 200, 0),
    has_slope: Boolean(raw.has_slope),
    slope_side: raw.slope_side === "right" ? "right" : "left",
    slope_start_height_mm: clamp(raw.slope_start_height_mm, 300, heightMm, 1200),
    slope_angle_deg: clamp(raw.slope_angle_deg, 0, 60, 0),
    is_corner_module: Boolean(raw.is_corner_module),
    corner_angle_deg: clamp(raw.corner_angle_deg, 45, 135, 90),
    corner_blind_width_mm: clamp(raw.corner_blind_width_mm, 50, 600, 100),
    additional_modules: Array.isArray(currentConfig?.additional_modules)
      ? currentConfig.additional_modules
      : [],
    zones: zones.length > 0 ? zones : undefined,
  };
}

function computeDiffSummary(oldCfg, newCfg) {
  const diffs = [];
  if (oldCfg.width_mm !== newCfg.width_mm) {
    diffs.push(`Genişlik: ${oldCfg.width_mm} mm ➔ ${newCfg.width_mm} mm`);
  }
  if (oldCfg.height_mm !== newCfg.height_mm) {
    diffs.push(`Yükseklik: ${oldCfg.height_mm} mm ➔ ${newCfg.height_mm} mm`);
  }
  if (oldCfg.depth_mm !== newCfg.depth_mm) {
    diffs.push(`Derinlik: ${oldCfg.depth_mm} mm ➔ ${newCfg.depth_mm} mm`);
  }
  if (oldCfg.door_type !== newCfg.door_type) {
    diffs.push(`Kapak: ${oldCfg.door_type} ➔ ${newCfg.door_type}`);
  }
  if (oldCfg.shelf_count !== newCfg.shelf_count) {
    diffs.push(`Raf Sayısı: ${oldCfg.shelf_count} ➔ ${newCfg.shelf_count}`);
  }
  if (oldCfg.drawer_count !== newCfg.drawer_count) {
    diffs.push(`Çekmece: ${oldCfg.drawer_count} ➔ ${newCfg.drawer_count}`);
  }
  const oldNiche = Math.max(oldCfg.niche_height_mm || 0, oldCfg.appliance_niche_height_mm || 0);
  const newNiche = Math.max(newCfg.niche_height_mm || 0, newCfg.appliance_niche_height_mm || 0);
  if (oldNiche !== newNiche) {
    diffs.push(`Açık Niş Boyu: ${oldNiche} mm ➔ ${newNiche} mm`);
  }
  if (oldCfg.door_color_hex !== newCfg.door_color_hex) {
    diffs.push(`Kapak Rengi: ${oldCfg.door_color_hex} ➔ ${newCfg.door_color_hex}`);
  }
  if (oldCfg.body_color_hex !== newCfg.body_color_hex) {
    diffs.push(`Gövde Rengi: ${oldCfg.body_color_hex} ➔ ${newCfg.body_color_hex}`);
  }
  if (Boolean(oldCfg.has_slope) !== Boolean(newCfg.has_slope)) {
    diffs.push(newCfg.has_slope ? `Çatı Eğimi: Aktif (${newCfg.slope_start_height_mm} mm)` : "Çatı Eğimi: İptal");
  }
  if (Boolean(oldCfg.is_corner_module) !== Boolean(newCfg.is_corner_module)) {
    diffs.push(newCfg.is_corner_module ? "L-Köşe Modülü: Aktif" : "L-Köşe Modülü: İptal");
  }
  const oldZ = Array.isArray(oldCfg.zones) ? oldCfg.zones.length : 0;
  const newZ = Array.isArray(newCfg.zones) ? newCfg.zones.length : 0;
  if (oldZ !== newZ) {
    diffs.push(`Dikey Bölmeler: ${oldZ} Bölme ➔ ${newZ} Bölme`);
  }
  return diffs;
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ success: false, message: "Yalnızca POST desteklenir." });
  }

  const headerKey =
    typeof req.headers?.["x-gemini-api-key"] === "string"
      ? req.headers["x-gemini-api-key"].trim()
      : "";
  const apiKey = (process.env.GEMINI_API_KEY || headerKey || "").trim();
  if (!apiKey) {
    return res.status(503).json({
      success: false,
      message: "Sunucuda GEMINI_API_KEY tanımlı değil.",
    });
  }

  const body = typeof req.body === "string" ? JSON.parse(req.body || "{}") : req.body || {};
  const currentConfig = body.current_config || {};
  const instruction = typeof body.instruction === "string" ? body.instruction.trim() : "";
  const history = Array.isArray(body.history) ? body.history : [];

  if (!instruction) {
    return res.status(400).json({ success: false, message: "Revizyon komutu girilmelidir." });
  }

  const historyText = history
    .slice(-4)
    .map((m) => `- ${m.role}: ${m.content}`)
    .join("\n");

  const prompt =
    `MEVCUT DOLAP PARAMETRELERİ (JSON):\n${JSON.stringify(currentConfig, null, 2)}\n\n` +
    (historyText ? `Önceki Sohbet Geçmişi:\n${historyText}\n\n` : "") +
    `KULLANICI REVİZYON KOMUTU:\n"${instruction}"\n\n` +
    "Lütfen yalnızca kullanıcının talep ettiği değişiklikleri uygulayarak şemaya uygun güncellenmiş JSON parametrelerini üret.";

  const models = [process.env.GEMINI_MODEL || "gemini-2.5-flash", "gemini-2.5-flash", "gemini-2.0-flash"]
    .filter((m, i, arr) => m && arr.indexOf(m) === i);

  const errors = [];
  for (const model of models) {
    try {
      const generationConfig = {
        response_mime_type: "application/json",
        response_schema: RESPONSE_SCHEMA,
        temperature: 0,
      };
      if (model.startsWith("gemini-2.5")) {
        generationConfig.thinkingConfig = { thinkingBudget: 0 };
      }

      const upstream = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json", "x-goog-api-key": apiKey },
          body: JSON.stringify({
            system_instruction: { parts: [{ text: REVISION_SYSTEM_INSTRUCTION }] },
            contents: [{ parts: [{ text: prompt }] }],
            generationConfig,
          }),
        }
      );

      const payload = await upstream.json();
      if (!upstream.ok) {
        errors.push(`${model}: HTTP ${upstream.status} ${payload?.error?.message ?? ""}`.trim());
        continue;
      }

      const text = payload?.candidates?.[0]?.content?.parts?.[0]?.text;
      if (!text) {
        errors.push(`${model}: boş yanıt`);
        continue;
      }

      const updatedConfig = normalize(JSON.parse(text), currentConfig);
      const diffSummary = computeDiffSummary(currentConfig, updatedConfig);
      const assistantMessage =
        diffSummary.length > 0
          ? `Revizyon uygulandı: ${diffSummary.join(", ")}`
          : "İstediğiniz düzenlemeler uygulandı.";

      return res.status(200).json({
        success: true,
        message: "Tasarım başarıyla revize edildi",
        data: {
          updated_config: updatedConfig,
          assistant_message: assistantMessage,
          diff_summary: diffSummary,
        },
      });
    } catch (err) {
      errors.push(`${model}: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  return res.status(502).json({
    success: false,
    message: `Gemini revizyon yanıtı alınamadı: ${errors.join(" | ")}`,
  });
}

