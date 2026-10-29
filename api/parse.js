/**
 * Vercel Serverless Function: POST /api/parse
 *
 * Doğal dil mobilya istemini Google Gemini ile CabinetConfig JSON'una ayrıştırır.
 * API anahtarı yalnızca sunucu tarafında (Vercel Environment Variable: GEMINI_API_KEY)
 * tutulur; tarayıcıya asla gönderilmez. LLM hiçbir geometrik hesap yapmaz.
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
  "bunu appliance_niche_height_mm alanına mm olarak (1850) yaz ve has_plinth=false yap. " +
  "Gazlı pistonlu / yukarı doğru açılan kalkar kapak istenmişse door_type='flap_up' seç. " +
  "İstemde açıkça raf adedi belirtilmemişse ve üst kalkar kapaklı niş dolabıysa shelf_count=0 ver. " +
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
    has_plinth: { type: "BOOLEAN" },
    plinth_height_mm: { type: "NUMBER" },
    body_material: { type: "STRING" },
    door_material: { type: "STRING" },
    body_color_hex: { type: "STRING" },
    door_color_hex: { type: "STRING" },
    back_panel_type: { type: "STRING", enum: ["grooved_8mm", "nailed_3mm"] },
    sheet_size: { type: "STRING", enum: ["2800x2100", "3660x1830"] },
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
  const nicheH = clamp(raw.appliance_niche_height_mm, 0, Math.max(0, heightMm - 260), 0);
  const hasPlinth =
    nicheH > 0 ? false : typeof raw.has_plinth === "boolean" ? raw.has_plinth : true;
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
    appliance_niche_height_mm: nicheH,
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
    additional_modules: [],
  };
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ success: false, data: null, error: "Yalnızca POST desteklenir." });
  }

  const apiKey = (process.env.GEMINI_API_KEY || "").trim();
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

  const models = [process.env.GEMINI_MODEL || "gemini-2.5-flash", "gemini-2.5-flash", "gemini-3.8-flash"]
    .filter((m, i, arr) => m && arr.indexOf(m) === i);

  const errors = [];
  for (const model of models) {
    try {
      const generationConfig = {
        response_mime_type: "application/json",
        response_schema: RESPONSE_SCHEMA,
        temperature: 0,
      };
      // 2.5 serisinde "düşünme" kapatılır: ~12 sn yerine ~1 sn yanıt
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
        text: prompt || "Bu mobilya / dolap eskizindeki veya rölöve çizimindeki ölçüleri, iç bölmeleri, rafları ve kapakları analiz et ve CabinetConfig şemasına dönüştür.",
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
