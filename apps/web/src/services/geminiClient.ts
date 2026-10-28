import type { CabinetConfig } from "../types/cabinet";

const STORAGE_KEY = "marangoz_gemini_api_key";
const metaEnv = (import.meta as unknown as { env?: Record<string, string> })
  .env;
const DEFAULT_KEY = metaEnv?.VITE_GEMINI_API_KEY || "";

export function getStoredGeminiApiKey(): string {
  if (typeof window === "undefined") return DEFAULT_KEY;
  const stored = localStorage.getItem(STORAGE_KEY);
  return (stored && stored.trim()) || DEFAULT_KEY;
}

export function setStoredGeminiApiKey(key: string): void {
  if (typeof window === "undefined") return;
  if (!key.trim()) {
    localStorage.removeItem(STORAGE_KEY);
  } else {
    localStorage.setItem(STORAGE_KEY, key.trim());
  }
}

export async function parseWithGeminiApiDirect(
  prompt: string,
  apiKey?: string
): Promise<CabinetConfig | null> {
  const key = (apiKey || getStoredGeminiApiKey()).trim();
  if (!key) return null;

  const candidateModels = ["gemini-2.5-flash", "gemini-3.8-flash"];
  const sysInst =
    "Sen bir mobilya fabrikası için Doğal Dil Ayrıştırıcısısın (Semantic Parser). " +
    "Kullanıcının Türkçe veya İngilizce dolap tarifini dikkatle oku ve yalnızca " +
    "CabinetConfig JSON şemasına uygun parametreleri çıkar. " +
    "Dış ölçüleri (genişlik, yükseklik, derinlik) daima milimetre (mm) cinsine çevir (örn: 235 cm -> 2350 mm, 85 cm -> 850 mm). " +
    "İç boşluk (niş) veya buzdolabı ölçülerini dış ölçü sanma; verilen toplam dış ölçüleri esas al.";

  const body = {
    system_instruction: { parts: [{ text: sysInst }] },
    contents: [{ parts: [{ text: prompt }] }],
    generationConfig: {
      response_mime_type: "application/json",
      response_schema: {
        type: "OBJECT",
        properties: {
          name: { type: "STRING" },
          cabinet_type: {
            type: "STRING",
            enum: [
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
            ],
          },
          width_mm: { type: "NUMBER" },
          height_mm: { type: "NUMBER" },
          depth_mm: { type: "NUMBER" },
          shelf_count: { type: "INTEGER" },
          door_type: {
            type: "STRING",
            enum: ["none", "single_left", "single_right", "double"],
          },
          drawer_count: { type: "INTEGER" },
          drawer_front_height_mm: { type: "NUMBER" },
          has_plinth: { type: "BOOLEAN" },
          plinth_height_mm: { type: "NUMBER" },
          body_material: { type: "STRING" },
          body_color_hex: { type: "STRING" },
          door_color_hex: { type: "STRING" },
          front_pvc_thickness_mm: { type: "NUMBER" },
          hidden_pvc_thickness_mm: { type: "NUMBER" },
          back_panel_type: {
            type: "STRING",
            enum: ["grooved_8mm", "nailed_3mm"],
          },
          sheet_size: {
            type: "STRING",
            enum: ["2800x2100", "3660x1830"],
          },
        },
        required: ["cabinet_type", "width_mm", "height_mm", "depth_mm"],
      },
      temperature: 0.0,
    },
  };

  for (const model of candidateModels) {
    try {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(
        key
      )}`;
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (!res.ok) continue;

      const data = await res.json();
      const rawText = data?.candidates?.[0]?.content?.parts?.[0]?.text;
      if (!rawText) continue;

      const parsed = JSON.parse(rawText) as Partial<CabinetConfig>;

      // Güvenli sınırlara kırp
      const widthMm = Math.max(
        300,
        Math.min(2700, Number(parsed.width_mm) || 900)
      );
      const heightMm = Math.max(
        300,
        Math.min(2750, Number(parsed.height_mm) || 2100)
      );
      const depthMm = Math.max(
        200,
        Math.min(900, Number(parsed.depth_mm) || 580)
      );

      return {
        name: parsed.name || "Parametrik Dolap",
        cabinet_type: parsed.cabinet_type || "wardrobe",
        width_mm: widthMm,
        height_mm: heightMm,
        depth_mm: depthMm,
        shelf_count: Math.max(0, Math.min(12, Number(parsed.shelf_count) || 0)),
        door_type: parsed.door_type || "double",
        drawer_count: Math.max(
          0,
          Math.min(6, Number(parsed.drawer_count) || 0)
        ),
        drawer_front_height_mm: Math.max(
          120,
          Math.min(350, Number(parsed.drawer_front_height_mm) || 180)
        ),
        has_plinth: parsed.has_plinth ?? true,
        plinth_height_mm: parsed.has_plinth
          ? Number(parsed.plinth_height_mm) || 80
          : 0,
        body_material: parsed.body_material || "18mm Beyaz Suntalam",
        body_color_hex: parsed.body_color_hex || "#F4F1EA",
        door_color_hex: parsed.door_color_hex || "#C89F70",
        front_pvc_thickness_mm: Number(parsed.front_pvc_thickness_mm) || 2.0,
        hidden_pvc_thickness_mm: Number(parsed.hidden_pvc_thickness_mm) || 0.4,
        back_panel_type: parsed.back_panel_type || "grooved_8mm",
        sheet_size: parsed.sheet_size || "2800x2100",
        additional_modules: [],
      };
    } catch {
      continue;
    }
  }

  return null;
}
