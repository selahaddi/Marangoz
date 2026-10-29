import type { CabinetConfig, CabinetType, CabinetZone, DoorType } from "../types/cabinet";

/**
 * Kullanıcının kendi Gemini API anahtarıyla doğrudan tarayıcıdan ayrıştırma (isteğe bağlı).
 * Anahtar yalnızca bu tarayıcının localStorage alanında tutulur, koda gömülmez.
 * Varsayılan üretim yolu sunucu tarafı /api/parse fonksiyonudur.
 */

const STORAGE_KEY = "marangoz_gemini_api_key";

const CABINET_TYPES: readonly CabinetType[] = [
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

const DOOR_TYPES: readonly DoorType[] = [
  "none",
  "single_left",
  "single_right",
  "double",
  "flap_up",
];

const SYSTEM_INSTRUCTION =
  "Sen bir mobilya fabrikası için Doğal Dil Ayrıştırıcısısın (Semantic Parser). " +
  "Kullanıcının Türkçe veya İngilizce dolap tarifini oku ve yalnızca şemaya uygun JSON üret. " +
  "Tüm ölçüleri milimetreye çevir (örn: 235 cm -> 2350, 85 cm -> 850). " +
  "İç niş, cihaz veya boşluk ölçülerini dış ölçü sanma; toplam dış ölçüleri width_mm, height_mm, depth_mm olarak yaz. " +
  "Eğer alt kısımda buzdolabı veya cihaz için açık niş/boşluk yüksekliği tarif edilmişse (örn: 185 cm niş), " +
  "bunu appliance_niche_height_mm alanına mm olarak (1850) yaz ve has_plinth=false yap. " +
  "Gazlı pistonlu / yukarı doğru açılan kalkar kapak istenmişse door_type='flap_up' seç. " +
  "İstemde açıkça raf adedi belirtilmemişse ve üst kalkar kapaklı niş dolabıysa shelf_count=0 ver. " +
  "Eğer kullanıcı dolap içini dikey bölmelere ayırmışsa (sol tarafı raflı, sağ tarafı askılı ve çekmeceli, vb.), 'zones' dizisinde tanımla. " +
  "Her bölme için name, width_ratio, shelf_count, door_type, drawer_count, has_hanging_rod parametrelerini doldur. " +
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
          door_color_hex: { type: "STRING" },
        },
      },
    },
  },
  required: ["cabinet_type", "width_mm", "height_mm", "depth_mm"],
} as const;

interface GeminiRawConfig {
  name?: unknown;
  cabinet_type?: unknown;
  width_mm?: unknown;
  height_mm?: unknown;
  depth_mm?: unknown;
  shelf_count?: unknown;
  door_type?: unknown;
  drawer_count?: unknown;
  drawer_front_height_mm?: unknown;
  appliance_niche_height_mm?: unknown;
  has_plinth?: unknown;
  plinth_height_mm?: unknown;
  body_material?: unknown;
  door_material?: unknown;
  body_color_hex?: unknown;
  door_color_hex?: unknown;
  back_panel_type?: unknown;
  sheet_size?: unknown;
  zones?: unknown;
}

interface GeminiResponsePayload {
  candidates?: { content?: { parts?: { text?: string }[] } }[];
  error?: { message?: string };
}

export function getStoredGeminiApiKey(): string {
  if (typeof window === "undefined") return "";
  return (localStorage.getItem(STORAGE_KEY) ?? "").trim();
}

export function setStoredGeminiApiKey(key: string): void {
  if (typeof window === "undefined") return;
  if (!key.trim()) {
    localStorage.removeItem(STORAGE_KEY);
  } else {
    localStorage.setItem(STORAGE_KEY, key.trim());
  }
}

const clamp = (value: unknown, min: number, max: number, fallback: number): number => {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(min, Math.min(max, n));
};

const isHex = (v: unknown): v is string => typeof v === "string" && /^#[0-9a-fA-F]{6}$/.test(v);

export function normalizeGeminiConfig(raw: GeminiRawConfig): CabinetConfig {
  const heightMm = clamp(raw.height_mm, 300, 2750, 2100);
  const nicheH = clamp(raw.appliance_niche_height_mm, 0, Math.max(0, heightMm - 260), 0);
  const hasPlinth =
    nicheH > 0 ? false : typeof raw.has_plinth === "boolean" ? raw.has_plinth : true;
  const cabinetType = CABINET_TYPES.find((t) => t === raw.cabinet_type) ?? "wardrobe";
  const doorType = DOOR_TYPES.find((t) => t === raw.door_type) ?? "double";

  const rawZones = Array.isArray(raw.zones) ? (raw.zones as Record<string, unknown>[]) : [];
  const zones: CabinetZone[] = rawZones.map((z, idx) => ({
    id: typeof z.id === "string" ? z.id : `z_${idx + 1}`,
    name: typeof z.name === "string" && z.name.trim() ? z.name.trim() : `Bölme #${idx + 1}`,
    width_ratio: typeof z.width_ratio === "number" && z.width_ratio > 0 ? z.width_ratio : 1.0,
    width_mm: typeof z.width_mm === "number" && z.width_mm > 0 ? z.width_mm : undefined,
    shelf_count: Math.round(clamp(z.shelf_count, 0, 12, 0)),
    door_type: (DOOR_TYPES.find((dt) => dt === z.door_type) ?? "none") as DoorType,
    drawer_count: Math.round(clamp(z.drawer_count, 0, 6, 0)),
    drawer_front_height_mm: typeof z.drawer_front_height_mm === "number" ? z.drawer_front_height_mm : 180,
    has_hanging_rod: Boolean(z.has_hanging_rod),
    appliance_niche_height_mm: typeof z.appliance_niche_height_mm === "number" ? z.appliance_niche_height_mm : 0,
    door_color_hex: isHex(z.door_color_hex) ? z.door_color_hex : undefined,
  }));

  return {
    name: typeof raw.name === "string" && raw.name.trim() ? raw.name.trim() : "Parametrik Dolap",
    cabinet_type: cabinetType,
    width_mm: clamp(raw.width_mm, 300, 2700, 900),
    height_mm: heightMm,
    depth_mm: clamp(raw.depth_mm, 200, 900, 580),
    shelf_count: Math.round(clamp(raw.shelf_count, 0, 12, 0)),
    door_type: doorType,
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
    zones: zones.length > 0 ? zones : undefined,
  };
}

export interface DirectGeminiResult {
  config: CabinetConfig;
  model: string;
}

/**
 * Kullanıcının tarayıcıda kayıtlı kişisel anahtarıyla Gemini'yi doğrudan çağırır.
 * Başarısız olursa açıklayıcı bir Error fırlatır (sessiz hata yok).
 */
export async function parseWithGeminiApiDirect(
  prompt: string,
  apiKey: string
): Promise<DirectGeminiResult> {
  const key = apiKey.trim();
  if (!key) {
    throw new Error("Tarayıcıda kayıtlı Gemini API anahtarı yok.");
  }

  const errors: string[] = [];
  for (const model of ["gemini-2.5-flash", "gemini-3.8-flash"]) {
    try {
      const generationConfig: Record<string, unknown> = {
        response_mime_type: "application/json",
        response_schema: RESPONSE_SCHEMA,
        temperature: 0,
      };
      if (model.startsWith("gemini-2.5")) {
        generationConfig.thinkingConfig = { thinkingBudget: 0 };
      }

      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json", "x-goog-api-key": key },
          body: JSON.stringify({
            system_instruction: { parts: [{ text: SYSTEM_INSTRUCTION }] },
            contents: [{ parts: [{ text: prompt }] }],
            generationConfig,
          }),
        }
      );
      const payload = (await res.json()) as GeminiResponsePayload;
      if (!res.ok) {
        errors.push(`${model}: HTTP ${res.status} ${payload.error?.message ?? ""}`.trim());
        continue;
      }
      const text = payload.candidates?.[0]?.content?.parts?.[0]?.text;
      if (!text) {
        errors.push(`${model}: boş yanıt`);
        continue;
      }
      return { config: normalizeGeminiConfig(JSON.parse(text) as GeminiRawConfig), model };
    } catch (err) {
      errors.push(`${model}: ${err instanceof Error ? err.message : String(err)}`);
    }
  }
  throw new Error(`Tarayıcıdan Gemini çağrısı başarısız: ${errors.join(" | ")}`);
}

/**
 * Kullanıcının tarayıcıdaki kişisel anahtarıyla Gemini Multimodal Vision API'sini çağırarak
 * el çizimi/eskiz görselini CabinetConfig JSON şemasına ayrıştırır.
 */
export async function parseSketchWithGeminiApiDirect(
  imageBase64: string,
  mimeType: string = "image/jpeg",
  prompt: string = "",
  apiKey: string
): Promise<DirectGeminiResult> {
  const key = apiKey.trim();
  if (!key) {
    throw new Error("Tarayıcıda kayıtlı Gemini API anahtarı yok.");
  }

  const cleanB64 = imageBase64.includes(",") ? imageBase64.split(",")[1] : imageBase64;
  const userPrompt =
    prompt.trim() ||
    "Bu mobilya / dolap eskizindeki veya rölöve krokisindeki dış ölçüleri, iç bölmeleri, rafları, çekmeceleri, nişleri ve kapakları dikkatle analiz et ve parametreleri çıkar.";

  const errors: string[] = [];
  for (const model of ["gemini-2.5-flash", "gemini-3.8-flash"]) {
    try {
      const generationConfig: Record<string, unknown> = {
        response_mime_type: "application/json",
        response_schema: RESPONSE_SCHEMA,
        temperature: 0,
      };
      if (model.startsWith("gemini-2.5")) {
        generationConfig.thinkingConfig = { thinkingBudget: 0 };
      }

      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json", "x-goog-api-key": key },
          body: JSON.stringify({
            system_instruction: {
              parts: [
                {
                  text:
                    SYSTEM_INSTRUCTION +
                    " Görseldeki el yazısı veya teknik çizim ölçülerini (genişlik, yükseklik, derinlik) dikkatle oku. Ölçü birimleri cm ise mm'ye çevir.",
                },
              ],
            },
            contents: [
              {
                parts: [
                  {
                    inline_data: {
                      mime_type: mimeType,
                      data: cleanB64,
                    },
                  },
                  { text: userPrompt },
                ],
              },
            ],
            generationConfig,
          }),
        }
      );
      const payload = (await res.json()) as GeminiResponsePayload;
      if (!res.ok) {
        errors.push(`${model}: HTTP ${res.status} ${payload.error?.message ?? ""}`.trim());
        continue;
      }
      const text = payload.candidates?.[0]?.content?.parts?.[0]?.text;
      if (!text) {
        errors.push(`${model}: boş yanıt`);
        continue;
      }
      return { config: normalizeGeminiConfig(JSON.parse(text) as GeminiRawConfig), model };
    } catch (err) {
      errors.push(`${model}: ${err instanceof Error ? err.message : String(err)}`);
    }
  }
  throw new Error(`Tarayıcıdan Gemini Vision çağrısı başarısız: ${errors.join(" | ")}`);
}
