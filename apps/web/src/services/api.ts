import type {
  ApiResponse,
  CabinetConfig,
  ProductionPackageResponse,
} from "../types/cabinet";
import {
  generateProductionPackageLocal,
  parsePromptDeterministic,
} from "./clientEngine";

const API_BASE = "/api/v1";

// Yerel geliştirme ortamında (localhost / 127.0.0.1) FastAPI sunucusunu dener;
// Vercel statik dağıtımında (veya 404/405 durumunda) tarayıcı içi deterministik
// CAD/CAM/DXF/Nesting motorunu doğrudan çalıştırarak 405 ağ hatalarını önler.
let preferClientEngine =
  typeof window !== "undefined" &&
  window.location.hostname !== "localhost" &&
  window.location.hostname !== "127.0.0.1";

export async function parseNaturalLanguagePrompt(
  prompt: string
): Promise<CabinetConfig> {
  if (preferClientEngine) {
    return parsePromptDeterministic(prompt);
  }

  try {
    const response = await fetch(`${API_BASE}/parse`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ prompt }),
    });

    if (response.status === 404 || response.status === 405) {
      preferClientEngine = true;
      return parsePromptDeterministic(prompt);
    }

    if (!response.ok) {
      return parsePromptDeterministic(prompt);
    }

    const envelope: ApiResponse<CabinetConfig> =
      (await response.json()) as ApiResponse<CabinetConfig>;

    if (!envelope.success || !envelope.data) {
      return parsePromptDeterministic(prompt);
    }

    return envelope.data;
  } catch {
    preferClientEngine = true;
    return parsePromptDeterministic(prompt);
  }
}

export async function generateProductionPackage(
  config: CabinetConfig
): Promise<ProductionPackageResponse> {
  if (preferClientEngine) {
    return generateProductionPackageLocal(config);
  }

  try {
    const response = await fetch(`${API_BASE}/generate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(config),
    });

    if (response.status === 404 || response.status === 405) {
      preferClientEngine = true;
      return generateProductionPackageLocal(config);
    }

    if (!response.ok) {
      return generateProductionPackageLocal(config);
    }

    const envelope: ApiResponse<ProductionPackageResponse> =
      (await response.json()) as ApiResponse<ProductionPackageResponse>;

    if (!envelope.success || !envelope.data) {
      return generateProductionPackageLocal(config);
    }

    return envelope.data;
  } catch {
    preferClientEngine = true;
    return generateProductionPackageLocal(config);
  }
}
