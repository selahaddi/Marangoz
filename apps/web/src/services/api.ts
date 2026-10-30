import type {
  ApiResponse,
  CabinetConfig,
  ProductionPackageResponse,
} from "../types/cabinet";
import {
  generateProductionPackageLocal,
  parsePromptDeterministic,
} from "./clientEngine";
import {
  getStoredGeminiApiKey,
  parseSketchWithGeminiApiDirect,
  parseWithGeminiApiDirect,
} from "./geminiClient";

const API_BASE = "/api/v1";

const isLocalHost =
  typeof window !== "undefined" &&
  (window.location.hostname === "localhost" ||
    window.location.hostname === "127.0.0.1");

export type ParseEngine =
  | "local_fastapi"
  | "vercel_gemini"
  | "browser_gemini"
  | "rule_based";

export interface ParseResult {
  config: CabinetConfig;
  engine: ParseEngine;
  /** Kullanılan model veya motor açıklaması (örn. "gemini-2.5-flash") */
  engineLabel: string;
  /** Yapay zekâ denenip başarısız olduysa nedenleri (kural motoruna düşüldüğünde gösterilir) */
  aiErrors: string[];
}

interface VercelParseEnvelope extends ApiResponse<CabinetConfig> {
  engine?: string;
  engine_label?: string;
}

/**
 * Doğal dil istemini sırasıyla şu motorlarla ayrıştırır:
 *  1. localhost'ta FastAPI backend (/api/v1/parse)
 *  2. Vercel sunucu fonksiyonu (/api/parse) — anahtar sunucuda (GEMINI_API_KEY)
 *  3. Kullanıcının tarayıcıya kaydettiği kişisel anahtarla doğrudan Gemini
 *  4. Çevrimdışı deterministik kural motoru
 * Her adımın hatası toplanır ve arayüzde gösterilir; hiçbir hata sessizce yutulmaz.
 */
export async function parseNaturalLanguagePrompt(prompt: string): Promise<ParseResult> {
  const aiErrors: string[] = [];
  const personalKey = getStoredGeminiApiKey();
  const reqHeaders: Record<string, string> = { "Content-Type": "application/json" };
  if (personalKey) {
    reqHeaders["x-gemini-api-key"] = personalKey;
  }

  if (isLocalHost) {
    try {
      const response = await fetch(`${API_BASE}/parse`, {
        method: "POST",
        headers: reqHeaders,
        body: JSON.stringify({ prompt }),
      });
      if (response.ok) {
        const envelope = (await response.json()) as ApiResponse<CabinetConfig>;
        if (envelope.success && envelope.data) {
          return {
            config: envelope.data,
            engine: "local_fastapi",
            engineLabel: "Yerel FastAPI (Gemini)",
            aiErrors,
          };
        }
        aiErrors.push(`FastAPI: ${envelope.error ?? "geçersiz yanıt"}`);
      } else {
        aiErrors.push(`FastAPI: HTTP ${response.status}`);
      }
    } catch (err) {
      aiErrors.push(`FastAPI erişilemedi: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  // Vercel sunucu fonksiyonu (anahtar sunucu tarafında veya x-gemini-api-key başlığında)
  try {
    const response = await fetch("/api/parse", {
      method: "POST",
      headers: reqHeaders,
      body: JSON.stringify({ prompt }),
    });
    const isJson = (response.headers.get("content-type") ?? "").includes("application/json");
    if (isJson) {
      const envelope = (await response.json()) as VercelParseEnvelope;
      if (response.ok && envelope.success && envelope.data) {
        return {
          config: envelope.data,
          engine: "vercel_gemini",
          engineLabel: envelope.engine_label || envelope.engine || "Gemini (sunucu)",
          aiErrors,
        };
      }
      aiErrors.push(`Sunucu /api/parse: ${envelope.error ?? `HTTP ${response.status}`}`);
    } else {
      aiErrors.push(`Sunucu /api/parse bulunamadı (HTTP ${response.status})`);
    }
  } catch (err) {
    aiErrors.push(`Sunucu /api/parse erişilemedi: ${err instanceof Error ? err.message : String(err)}`);
  }

  // Kullanıcının kişisel anahtarı varsa doğrudan tarayıcıdan
  if (personalKey) {
    try {
      const direct = await parseWithGeminiApiDirect(prompt, personalKey);
      return {
        config: direct.config,
        engine: "browser_gemini",
        engineLabel: `${direct.model} (tarayıcı anahtarı)`,
        aiErrors,
      };
    } catch (err) {
      aiErrors.push(err instanceof Error ? err.message : String(err));
    }
  }

  return {
    config: parsePromptDeterministic(prompt),
    engine: "rule_based",
    engineLabel: "Yerel kural motoru (yapay zekâ devre dışı)",
    aiErrors,
  };
}

/**
 * Kağıda el ile çizilmiş dolap krokisi veya rölöve fotoğrafını Gemini Vision ile ayrıştırır.
 *  1. Localhost'ta FastAPI (/api/v1/parse_sketch)
 *  2. Vercel sunucu fonksiyonu (/api/parse)
 *  3. Tarayıcıda saklanan Gemini API anahtarı ile doğrudan çağrı
 *  4. Çevrimdışı yedek konfigürasyon
 */
export async function parseSketchImage(
  imageBase64: string,
  mimeType: string = "image/jpeg",
  prompt: string = ""
): Promise<ParseResult> {
  const aiErrors: string[] = [];
  const personalKey = getStoredGeminiApiKey();
  const reqHeaders: Record<string, string> = { "Content-Type": "application/json" };
  if (personalKey) {
    reqHeaders["x-gemini-api-key"] = personalKey;
  }

  if (isLocalHost) {
    try {
      const response = await fetch(`${API_BASE}/parse_sketch`, {
        method: "POST",
        headers: reqHeaders,
        body: JSON.stringify({
          image_base64: imageBase64,
          mime_type: mimeType,
          prompt,
        }),
      });
      if (response.ok) {
        const envelope = (await response.json()) as ApiResponse<CabinetConfig>;
        if (envelope.success && envelope.data) {
          return {
            config: envelope.data,
            engine: "local_fastapi",
            engineLabel: "Yerel FastAPI Vision (Gemini)",
            aiErrors,
          };
        }
        aiErrors.push(`FastAPI: ${envelope.error ?? "geçersiz yanıt"}`);
      } else {
        aiErrors.push(`FastAPI: HTTP ${response.status}`);
      }
    } catch (err) {
      aiErrors.push(`FastAPI erişilemedi: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  // Vercel sunucu fonksiyonu
  try {
    const response = await fetch("/api/parse", {
      method: "POST",
      headers: reqHeaders,
      body: JSON.stringify({
        image_base64: imageBase64,
        mime_type: mimeType,
        prompt,
      }),
    });
    const isJson = (response.headers.get("content-type") ?? "").includes("application/json");
    if (isJson) {
      const envelope = (await response.json()) as VercelParseEnvelope;
      if (response.ok && envelope.success && envelope.data) {
        return {
          config: envelope.data,
          engine: "vercel_gemini",
          engineLabel: envelope.engine_label || envelope.engine || "Gemini Vision (sunucu)",
          aiErrors,
        };
      }
      aiErrors.push(`Sunucu /api/parse: ${envelope.error ?? `HTTP ${response.status}`}`);
    } else {
      aiErrors.push(`Sunucu /api/parse bulunamadı (HTTP ${response.status})`);
    }
  } catch (err) {
    aiErrors.push(`Sunucu /api/parse erişilemedi: ${err instanceof Error ? err.message : String(err)}`);
  }

  // Kullanıcının kişisel anahtarı varsa tarayıcıdan doğrudan Gemini Vision
  if (personalKey) {
    try {
      const direct = await parseSketchWithGeminiApiDirect(
        imageBase64,
        mimeType,
        prompt,
        personalKey
      );
      return {
        config: direct.config,
        engine: "browser_gemini",
        engineLabel: `${direct.model} Vision (tarayıcı)`,
        aiErrors,
      };
    } catch (err) {
      aiErrors.push(err instanceof Error ? err.message : String(err));
    }
  }

  return {
    config: prompt.trim()
      ? parsePromptDeterministic(prompt)
      : {
          name: "Eskizden Çıkarılan Gardırop",
          cabinet_type: "wardrobe",
          width_mm: 900,
          height_mm: 2100,
          depth_mm: 580,
          shelf_count: 3,
          door_type: "double",
          drawer_count: 2,
          drawer_front_height_mm: 180,
          has_plinth: true,
          plinth_height_mm: 80,
          appliance_niche_height_mm: 0,
          body_material: "18mm Beyaz Suntalam",
          door_material: "18mm Doğal Meşe Suntalam",
          body_color_hex: "#F4F1EA",
          door_color_hex: "#C89F70",
          front_pvc_thickness_mm: 2.0,
          hidden_pvc_thickness_mm: 0.4,
          back_panel_type: "grooved_8mm",
          sheet_size: "2800x2100",
          additional_modules: [],
        },
    engine: "rule_based",
    engineLabel: "Çevrimdışı Eskiz Şablonu (Yapay zekâ yanıt vermedi)",
    aiErrors,
  };
}

export async function generateProductionPackage(
  config: CabinetConfig
): Promise<ProductionPackageResponse> {
  // Yerel FastAPI ortamında backend motorunu dene
  if (isLocalHost) {
    try {
      const response = await fetch(`${API_BASE}/generate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(config),
      });

      if (response.ok) {
        const envelope: ApiResponse<ProductionPackageResponse> =
          (await response.json()) as ApiResponse<ProductionPackageResponse>;
        if (envelope.success && envelope.data) {
          return envelope.data;
        }
      }
      console.warn("[generate] FastAPI başarısız, tarayıcı motoruna geçiliyor. HTTP", response.status);
    } catch (err) {
      console.warn("[generate] FastAPI erişilemedi, tarayıcı motoruna geçiliyor:", err);
    }
  }

  // Vercel / statik dağıtımda tarayıcı içi deterministik CAD/CAM motoru
  return generateProductionPackageLocal(config);
}
