import type {
  ApiResponse,
  CabinetConfig,
  ProductionPackageResponse,
} from "../types/cabinet";
import {
  generateProductionPackageLocal,
  parsePromptDeterministic,
} from "./clientEngine";
import { getStoredGeminiApiKey, parseWithGeminiApiDirect } from "./geminiClient";

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

  if (isLocalHost) {
    try {
      const response = await fetch(`${API_BASE}/parse`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
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

  // Vercel sunucu fonksiyonu (anahtar sunucu tarafında)
  try {
    const response = await fetch("/api/parse", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ prompt }),
    });
    const isJson = (response.headers.get("content-type") ?? "").includes("application/json");
    if (isJson) {
      const envelope = (await response.json()) as VercelParseEnvelope;
      if (response.ok && envelope.success && envelope.data) {
        return {
          config: envelope.data,
          engine: "vercel_gemini",
          engineLabel: envelope.engine ?? "Gemini (sunucu)",
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
  const personalKey = getStoredGeminiApiKey();
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
