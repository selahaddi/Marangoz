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
  "Sen bir mobilya fabrikası için uzman Doğal Dil CAD/CAM Ayrıştırıcısısın (Semantic Parser).\n" +
  "Kullanıcının Türkçe veya İngilizce dolap, oda veya mobilya tarifini dikkatle oku ve yalnızca verilen JSON şemasına uygun nesne üret.\n\n" +
  "ÖLÇÜ DÖNÜŞÜM KURALLARI (HER ZAMAN MİLİMETRE):\n" +
  "- 'en', 'eninde', 'genişlik', 'genişliğinde', 'boyuna' (en anlamında) -> width_mm (örn: 120 cm -> 1200, 2.4 m -> 2400).\n" +
  "- 'boy', 'boyunda', 'yükseklik', 'yüksekliğinde', 'tavan boyu' -> height_mm (örn: 210 cm -> 2100, 240 cm -> 2400).\n" +
  "- 'derinlik', 'derinliğinde' -> depth_mm (varsayılanlar: gardırop=580, mutfak alt=580, mutfak üst=330, banyo=480, kitaplık=320, vestiyer/ayakkabılık=360).\n\n" +
  "MİMARİ VE FONKSİYONEL KURALLAR:\n" +
  "- TEK DOLAP İÇİ BÖLMELER (İÇ DİKME) İLE ÇOKLU MODÜL HATTI FARKI:\n" +
  "  * Eğer kullanıcı TEK BİR DOLABIN İÇİNİ (örn. sol tarafı raflı, sağ tarafı askılı tek bir gardırop) tarif ediyorsa 'zones' dizisini kullan.\n" +
  "  * FAKAT kullanıcı YAN YANA AYRI MODÜLLERDEN OLUŞAN BİR HAT (örn: mutfak alt dolapları, 80 cm evye + 60 cm çekmeceli + 100 cm tencere dolabı gibi) tarif ediyorsa 'zones' KULLANMA!\n" +
  "    Bunun yerine ilk modülü ana nesneye (örn: width_mm: 800, name: '80cm Evye Dolabı'), diğer modülleri sırasıyla 'additional_modules' dizisine ekle.\n" +
  "- 'Tavandan tabana' veya 'yerden tavana' bazasız demektir (has_plinth=false, plinth_height_mm=0).\n" +
  "- Ayarlı plastik ayak istenmişse plinth_type='adjustable_legs'; standart ahşap baza için plinth_type='wood_plinth'.\n" +
  "- Lamello Cabineo 12 veya 3-eksen bağlantı için fastener_type='cabineo_12'; Minifix/kavela için fastener_type='minifix_dowel'.\n" +
  "- Açık nişler:\n" +
  "  * Altta buzdolabı / solo cihaz boşluğu varsa: appliance_niche_height_mm ve niche_height_mm (örn: 185 cm -> 1850), niche_bottom_offset_mm=0, has_plinth=false.\n" +
  "  * Orta açık niş / kahve köşesi / fırın varsa: niche_bottom_offset_mm (yerden kot mm, örn: 85 cm -> 850) ve niche_height_mm (örn: 45 cm -> 450).\n" +
  "  * Priz, kablo veya havalandırma için arkalıksız ise niche_back_open=true.\n" +
  "- Çatı / Merdiven Eğimi:\n" +
  "  * has_slope=true, slope_side ('left' veya 'right'), slope_start_height_mm (eğimin alçak kenar boyu mm).\n" +
  "- L-Köşe Modülü:\n" +
  "  * 90° köşe dolap için is_corner_module=true, corner_blind_width_mm=100.\n" +
  "- Renkler: hex koduna çevir (#F4F1EA kırık beyaz, #C89F70 doğal meşe, #6E472B ceviz, #374151 antrasit, #1E293B mat siyah).\n" +
  "- Kapak malzemesi ayrı belirtilmişse door_material alanına yaz (örn: '18mm Doğal Meşe MDF-Lam', '18mm Mat Antrasit Akrilik').\n" +
  "Kesinlikle hiçbir delik, kesim veya parça geometrisi hesabı yapma; yalnızca dolap parametrelerini JSON olarak döndür.";

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
    additional_modules: {
      type: "ARRAY",
      description: "Yan yana çoklu modül hattındaki (örn. mutfak alt dolapları, bitişik modüller) diğer modüller",
      items: {
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
          body_material: { type: "STRING" },
          door_material: { type: "STRING" },
          body_color_hex: { type: "STRING" },
          door_color_hex: { type: "STRING" },
          has_plinth: { type: "BOOLEAN" },
          plinth_height_mm: { type: "NUMBER" },
          has_slope: { type: "BOOLEAN" },
          slope_side: { type: "STRING", enum: ["left", "right"] },
          slope_start_height_mm: { type: "NUMBER" },
          is_corner_module: { type: "BOOLEAN" },
          corner_blind_width_mm: { type: "NUMBER" },
        },
        required: ["cabinet_type", "width_mm", "height_mm", "depth_mm"],
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
  const rawModules = Array.isArray(raw.additional_modules) ? raw.additional_modules : [];
  let primaryRaw = { ...raw };
  let modulesList = [...rawModules];

  // Eğer LLM tüm modülleri additional_modules içine koymuşsa ve root modül toplam genişlik ise:
  if (modulesList.length >= 2) {
    const sumModWidth = modulesList.reduce((acc, m) => acc + (Number(m.width_mm) || 0), 0);
    if (Math.abs(sumModWidth - (Number(raw.width_mm) || 0)) < 50) {
      primaryRaw = { ...modulesList[0] };
      modulesList = modulesList.slice(1);
    }
  }

  const heightMm = clamp(primaryRaw.height_mm, 300, 2750, 2100);
  const rawNicheH = clamp(
    primaryRaw.niche_height_mm ?? primaryRaw.appliance_niche_height_mm,
    0,
    Math.max(0, heightMm - 260),
    0
  );
  const nicheOffset = clamp(primaryRaw.niche_bottom_offset_mm, 0, heightMm, 0);
  const isBottomNiche = rawNicheH > 0 && nicheOffset <= 0;
  const hasPlinth =
    isBottomNiche ? false : typeof primaryRaw.has_plinth === "boolean" ? primaryRaw.has_plinth : true;

  const rawZones = Array.isArray(primaryRaw.zones) ? primaryRaw.zones : [];
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

  const additionalModules = modulesList.map((m, idx) => ({
    name: typeof m.name === "string" && m.name.trim() ? m.name.trim() : `Ek Modül #${idx + 2}`,
    cabinet_type: CABINET_TYPES.includes(m.cabinet_type) ? m.cabinet_type : primaryRaw.cabinet_type || "kitchen_base",
    width_mm: clamp(m.width_mm, 200, 2400, 600),
    height_mm: clamp(m.height_mm, 300, 2750, heightMm),
    depth_mm: clamp(m.depth_mm, 200, 900, clamp(primaryRaw.depth_mm, 200, 900, 580)),
    shelf_count: Math.round(clamp(m.shelf_count, 0, 12, 1)),
    door_type: DOOR_TYPES.includes(m.door_type) ? m.door_type : "single_left",
    drawer_count: Math.round(clamp(m.drawer_count, 0, 6, 0)),
    drawer_front_height_mm: clamp(m.drawer_front_height_mm, 120, 350, 180),
    body_material: typeof m.body_material === "string" && m.body_material.trim() ? m.body_material.trim() : (primaryRaw.body_material || "18mm Beyaz Suntalam"),
    door_material: typeof m.door_material === "string" && m.door_material.trim() ? m.door_material.trim() : (primaryRaw.door_material || ""),
    body_color_hex: isHex(m.body_color_hex) ? m.body_color_hex : (isHex(primaryRaw.body_color_hex) ? primaryRaw.body_color_hex : "#F4F1EA"),
    door_color_hex: isHex(m.door_color_hex) ? m.door_color_hex : (isHex(primaryRaw.door_color_hex) ? primaryRaw.door_color_hex : "#C89F70"),
    front_pvc_thickness_mm: 2.0,
    hidden_pvc_thickness_mm: 0.4,
    back_panel_type: primaryRaw.back_panel_type === "nailed_3mm" ? "nailed_3mm" : "grooved_8mm",
    sheet_size: primaryRaw.sheet_size === "3660x1830" ? "3660x1830" : "2800x2100",
    fastener_type: primaryRaw.fastener_type === "cabineo_12" ? "cabineo_12" : "minifix_dowel",
    cutting_mode: primaryRaw.cutting_mode === "cnc_router" ? "cnc_router" : "panel_saw",
    plinth_type: primaryRaw.plinth_type === "adjustable_legs" ? "adjustable_legs" : "wood_plinth",
    has_plinth: typeof m.has_plinth === "boolean" ? m.has_plinth : Boolean(primaryRaw.has_plinth),
    plinth_height_mm: typeof m.plinth_height_mm === "number" ? clamp(m.plinth_height_mm, 50, 200, 80) : 80,
    has_baseboard_notch: false,
    has_column_notch: false,
    has_slope: Boolean(m.has_slope),
    slope_side: m.slope_side === "right" ? "right" : "left",
    slope_start_height_mm: clamp(m.slope_start_height_mm, 300, 2750, 1200),
    is_corner_module: Boolean(m.is_corner_module),
    corner_blind_width_mm: clamp(m.corner_blind_width_mm, 50, 600, 100),
    additional_modules: [],
  }));

  return {
    name: typeof primaryRaw.name === "string" && primaryRaw.name.trim() ? primaryRaw.name.trim() : "Parametrik Dolap",
    cabinet_type: CABINET_TYPES.includes(primaryRaw.cabinet_type) ? primaryRaw.cabinet_type : "wardrobe",
    width_mm: clamp(primaryRaw.width_mm, 300, 2700, 900),
    height_mm: heightMm,
    depth_mm: clamp(primaryRaw.depth_mm, 200, 900, 580),
    shelf_count: Math.round(clamp(primaryRaw.shelf_count, 0, 12, 0)),
    door_type: DOOR_TYPES.includes(primaryRaw.door_type) ? primaryRaw.door_type : "double",
    drawer_count: Math.round(clamp(primaryRaw.drawer_count, 0, 6, 0)),
    drawer_front_height_mm: clamp(primaryRaw.drawer_front_height_mm, 120, 350, 180),
    appliance_niche_height_mm: rawNicheH,
    niche_height_mm: rawNicheH,
    niche_bottom_offset_mm: nicheOffset,
    niche_color_hex: isHex(primaryRaw.niche_color_hex) ? primaryRaw.niche_color_hex : undefined,
    niche_back_open: typeof primaryRaw.niche_back_open === "boolean" ? primaryRaw.niche_back_open : undefined,
    has_plinth: hasPlinth,
    plinth_height_mm: hasPlinth ? clamp(primaryRaw.plinth_height_mm, 50, 200, 80) : 0,
    body_material:
      typeof primaryRaw.body_material === "string" && primaryRaw.body_material.trim()
        ? primaryRaw.body_material.trim()
        : "18mm Beyaz Suntalam",
    door_material:
      typeof primaryRaw.door_material === "string" && primaryRaw.door_material.trim()
        ? primaryRaw.door_material.trim()
        : "",
    body_color_hex: isHex(primaryRaw.body_color_hex) ? primaryRaw.body_color_hex : "#F4F1EA",
    door_color_hex: isHex(primaryRaw.door_color_hex) ? primaryRaw.door_color_hex : "#C89F70",
    front_pvc_thickness_mm: 2.0,
    hidden_pvc_thickness_mm: 0.4,
    back_panel_type: primaryRaw.back_panel_type === "nailed_3mm" ? "nailed_3mm" : "grooved_8mm",
    sheet_size: primaryRaw.sheet_size === "3660x1830" ? "3660x1830" : "2800x2100",
    fastener_type: primaryRaw.fastener_type === "cabineo_12" ? "cabineo_12" : "minifix_dowel",
    cutting_mode: primaryRaw.cutting_mode === "cnc_router" ? "cnc_router" : "panel_saw",
    plinth_type: primaryRaw.plinth_type === "adjustable_legs" ? "adjustable_legs" : "wood_plinth",
    has_baseboard_notch: Boolean(primaryRaw.has_baseboard_notch),
    baseboard_notch_height_mm: clamp(primaryRaw.baseboard_notch_height_mm, 30, 200, 80),
    baseboard_notch_depth_mm: clamp(primaryRaw.baseboard_notch_depth_mm, 5, 50, 15),
    has_column_notch: Boolean(primaryRaw.has_column_notch),
    column_notch_width_mm: clamp(primaryRaw.column_notch_width_mm, 40, 400, 120),
    column_notch_depth_mm: clamp(primaryRaw.column_notch_depth_mm, 40, 400, 120),
    left_filler_width_mm: clamp(primaryRaw.left_filler_width_mm, 0, 200, 0),
    right_filler_width_mm: clamp(primaryRaw.right_filler_width_mm, 0, 200, 0),
    has_slope: Boolean(primaryRaw.has_slope),
    slope_side: primaryRaw.slope_side === "right" ? "right" : "left",
    slope_start_height_mm: clamp(primaryRaw.slope_start_height_mm, 300, heightMm, 1200),
    slope_angle_deg: clamp(primaryRaw.slope_angle_deg, 0, 60, 0),
    is_corner_module: Boolean(primaryRaw.is_corner_module),
    corner_angle_deg: clamp(primaryRaw.corner_angle_deg, 45, 135, 90),
    corner_blind_width_mm: clamp(primaryRaw.corner_blind_width_mm, 50, 600, 100),
    additional_modules: additionalModules,
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

  const models = [
    process.env.GEMINI_MODEL,
    "gemini-2.5-flash-lite",
    "gemini-3.5-flash",
    "gemini-2.5-flash",
  ].filter((m, i, arr) => m && arr.indexOf(m) === i);

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

      const engineLabel =
        model === "gemini-2.5-flash-lite"
          ? "Gemini 2.5 Flash Lite (Google AI)"
          : model === "gemini-3.5-flash"
          ? "Gemini 3.5 Flash (Google AI)"
          : `Gemini (${model})`;

      return res.status(200).json({
        success: true,
        data: normalize(JSON.parse(text)),
        error: null,
        engine: model,
        engine_label: engineLabel,
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      errors.push(`${model}: ${msg}`);
      console.error("[api/parse] İstisna", model, msg);
    }
  }

  return res.status(502).json({ success: false, data: null, error: `Gemini yanıt vermedi: ${errors.join(" | ")}` });
}
