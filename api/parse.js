/**
 * Vercel Serverless Function: POST /api/parse
 *
 * Doğal dil mobilya istemini veya eskiz görselini Google Gemini ile CabinetConfig JSON'una ayrıştırır.
 * API anahtarı sunucu tarafında (Vercel Environment Variable: GEMINI_API_KEY) veya
 * kullanıcının x-gemini-api-key başlığında tutulur. LLM hiçbir geometrik hesap yapmaz.
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

const SYSTEM_INSTRUCTION =
  "Sen bir mobilya fabrikası için Doğal Dil Ayrıştırıcısısın (Semantic Parser). " +
  "Kullanıcının Türkçe veya İngilizce dolap tarifini oku ve yalnızca şemaya uygun JSON üret. " +
  "Tüm ölçüleri milimetreye çevir (örn: 235 cm -> 2350, 85 cm -> 850). " +
  "İç niş, cihaz veya boşluk ölçülerini dış ölçü sanma; toplam dış ölçüleri width_mm, height_mm, depth_mm olarak yaz. " +
  "Eğer alt kısımda buzdolabı veya cihaz için açık niş/boşluk yüksekliği tarif edilmişse (örn: 185 cm niş), " +
  "bunu appliance_niche_height_mm ve niche_height_mm alanına mm olarak (1850) yaz, niche_bottom_offset_mm=0 ve has_plinth=false yap. " +
  "Orta açık niş, kahve istasyonu / kahve barı, ankastre fırın veya mikrodalga nişi varsa " +
  "niche_height_mm ve niche_bottom_offset_mm (yerden kot mm) doldur (örn: yerden 85 cm yükseklikte 45 cm niş -> niche_bottom_offset_mm=850, niche_height_mm=450). " +
  "Arkalık açık veya priz/havalandırma istenmişse niche_back_open=true yap. " +
  "Niş arka/iç rengi belirtilmişse (örn. ahşap niş) niche_color_hex alanını doldur. " +
  "Gazlı pistonlu / yukarı doğru açılan kalkar kapak istenmişse door_type='flap_up' seç. " +
  "İstemde açıkça raf adedi belirtilmemişse ve üst kalkar kapaklı niş dolabıysa shelf_count=0 ver. " +
  "Eğer kullanıcı dolap içini dikey bölmelere ayırmışsa (sol tarafı raflı, sağ tarafı askılı ve çekmeceli, vb.), 'zones' dizisinde tanımla. " +
  "Her bölme için name, width_ratio, shelf_count, door_type, drawer_count, has_hanging_rod parametrelerini doldur. " +
  "Çatı eğimi, tavan eğimi, mansard çatı veya merdiven altı dolap istenmişse has_slope=true yap, eğimin alçak tarafını slope_side ('left' veya 'right') ve alçak kenar boyunu slope_start_height_mm olarak yaz. " +
  "L-Köşe dönüş modülü veya 90 derece köşe dolap istenmişse is_corner_module=true yap. " +
  "Lamello Cabineo 12 veya 3-eksen bağlantı istenmişse fastener_type='cabineo_12' seç. " +
  "Ayarlı plastik ayak istenmişse plinth_type='adjustable_legs' seç. " +
  "Süpürgelik kertmesi varsa has_baseboard_notch=true, kolon kertmesi varsa has_column_notch=true yap. " +
  "Renkleri hex koduna çevir (beyaz #F4F1EA, meşe #C89F70, ceviz #6E472B, antrasit #374151). " +
  "Kapak malzemesi ayrı belirtilmişse door_material alanına yaz (örn: '18mm Doğal Meşe MDF-Lam'). " +
  "'Tavandan tabana' bazasız demektir. Hiçbir kesim, delik veya parça hesabı yapma.";

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

function normalize(raw) {
  const heightMm = clamp(raw.height_mm, 300, 2750, 2100);
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
    name: typeof raw.name === "string" && raw.name.trim() ? raw.name.trim() : "Parametrik Dolap",
    cabinet_type: CABINET_TYPES.includes(raw.cabinet_type) ? raw.cabinet_type : "wardrobe",
    width_mm: clamp(raw.width_mm, 300, 2700, 900),
    height_mm: heightMm,
    depth_mm: clamp(raw.depth_mm, 200, 900, 580),
    shelf_count: Math.round(clamp(raw.shelf_count, 0, 12, 0)),
    door_type: DOOR_TYPES.includes(raw.door_type) ? raw.door_type : "double",
    drawer_count: Math.round(clamp(raw.drawer_count, 0, 6, 0)),
    drawer_front_height_mm: clamp(raw.drawer_front_height_mm, 120, 350, 180),
    appliance_niche_height_mm: rawNicheH,
    niche_height_mm: rawNicheH,
    niche_bottom_offset_mm: nicheOffset,
    niche_color_hex: isHex(raw.niche_color_hex) ? raw.niche_color_hex : undefined,
    niche_back_open: typeof raw.niche_back_open === "boolean" ? raw.niche_back_open : undefined,
    has_plinth: hasPlinth,
    plinth_height_mm: hasPlinth ? clamp(raw.plinth_height_mm, 50, 200, 80) : 0,
    body_material:
      typeof raw.body_material === "string" && raw.body_material.trim()
        ? raw.body_material.trim()
        : "18mm Beyaz Suntalam",
    door_material:
      typeof raw.door_material === "string" && raw.door_material.trim()
        ? raw.door_material.trim()
        : "",
    body_color_hex: isHex(raw.body_color_hex) ? raw.body_color_hex : "#F4F1EA",
    door_color_hex: isHex(raw.door_color_hex) ? raw.door_color_hex : "#C89F70",
    front_pvc_thickness_mm: 2.0,
    hidden_pvc_thickness_mm: 0.4,
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
    additional_modules: [],
    zones: zones.length > 0 ? zones : undefined,
  };
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ success: false, data: null, error: "Yalnızca POST desteklenir." });
  }

  const headerKey =
    typeof req.headers?.["x-gemini-api-key"] === "string"
      ? req.headers["x-gemini-api-key"].trim()
      : "";
  const apiKey = (process.env.GEMINI_API_KEY || headerKey || "").trim();
  if (!apiKey) {
    return res.status(503).json({
      success: false,
      data: null,
      error: "Sunucuda GEMINI_API_KEY tanımlı değil (Vercel > Settings > Environment Variables).",
    });
  }

  const body = typeof req.body === "string" ? JSON.parse(req.body || "{}") : req.body || {};
  const prompt = typeof body.prompt === "string" ? body.prompt.trim() : "";
  const imageBase64 = typeof body.image_base64 === "string" ? body.image_base64.trim() : "";
  const mimeType = typeof body.mime_type === "string" ? body.mime_type.trim() : "image/jpeg";

  if (!prompt && !imageBase64) {
    return res.status(400).json({ success: false, data: null, error: "İstem veya görsel verisi girilmelidir." });
  }

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

      const contentParts = [];
      if (imageBase64) {
        const cleanB64 = imageBase64.includes(",") ? imageBase64.split(",")[1] : imageBase64;
        contentParts.push({
          inline_data: {
            mime_type: mimeType,
            data: cleanB64,
          },
        });
      }
      contentParts.push({
        text:
          prompt ||
          "Bu mobilya / dolap eskizindeki veya rölöve çizimindeki ölçüleri, iç bölmeleri, rafları ve kapakları analiz et ve CabinetConfig şemasına dönüştür.",
      });

      const upstream = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json", "x-goog-api-key": apiKey },
          body: JSON.stringify({
            system_instruction: { parts: [{ text: SYSTEM_INSTRUCTION }] },
            contents: [{ parts: contentParts }],
            generationConfig,
          }),
        }
      );

      const payload = await upstream.json();
      if (!upstream.ok) {
        errors.push(`${model}: HTTP ${upstream.status} ${payload?.error?.message ?? ""}`.trim());
        console.error("[api/parse] Gemini hatası", model, upstream.status, payload?.error?.message);
        continue;
      }

      const text = payload?.candidates?.[0]?.content?.parts?.[0]?.text;
      if (!text) {
        errors.push(`${model}: boş yanıt`);
        continue;
      }

      return res.status(200).json({
        success: true,
        data: normalize(JSON.parse(text)),
        error: null,
        engine: model,
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      errors.push(`${model}: ${msg}`);
      console.error("[api/parse] İstisna", model, msg);
    }
  }

  return res.status(502).json({ success: false, data: null, error: `Gemini yanıt vermedi: ${errors.join(" | ")}` });
}
