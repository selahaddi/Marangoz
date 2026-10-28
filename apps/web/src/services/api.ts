import type {
  ApiResponse,
  CabinetConfig,
  ProductionPackageResponse,
} from "../types/cabinet";
import {
  generateProductionPackageLocal,
  parsePromptDeterministic,
} from "./clientEngine";
import { parseWithGeminiApiDirect } from "./geminiClient";

const API_BASE = "/api/v1";

const isLocalHost =
  typeof window !== "undefined" &&
  (window.location.hostname === "localhost" ||
    window.location.hostname === "127.0.0.1");

export async function parseNaturalLanguagePrompt(
  prompt: string
): Promise<CabinetConfig> {
  // 1. Yerel geliştirme ortamında (localhost) FastAPI backend'ini dene
  if (isLocalHost) {
    try {
      const response = await fetch(`${API_BASE}/parse`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt }),
      });

      if (response.ok) {
        const envelope: ApiResponse<CabinetConfig> =
          (await response.json()) as ApiResponse<CabinetConfig>;
        if (envelope.success && envelope.data) {
          return envelope.data;
        }
      }
    } catch {
      // Backend erişilemezse devam et
    }
  }

  // 2. Vercel veya doğrudan tarayıcı ortamında doğrudan Google Gemini API'sini çağır
  try {
    const directGeminiResult = await parseWithGeminiApiDirect(prompt);
    if (directGeminiResult) {
      return directGeminiResult;
    }
  } catch {
    // Gemini API hatası olursa yerel deterministik kural motoruna geç
  }

  // 3. Çevrimdışı / API anahtarsız deterministik ayrıştırıcı
  return parsePromptDeterministic(prompt);
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
    } catch {
      // Backend yoksa tarayıcı motoruna geç
    }
  }

  // Vercel / statik dağıtımda %100 sıfır gecikmeli tarayıcı içi CAD/CAM motoru
  return generateProductionPackageLocal(config);
}
