import type {
  ApiResponse,
  CabinetConfig,
  ProductionPackageResponse,
} from "../types/cabinet";

const API_BASE = "/api/v1";

export async function parseNaturalLanguagePrompt(
  prompt: string
): Promise<CabinetConfig> {
  const response = await fetch(`${API_BASE}/parse`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ prompt }),
  });

  if (!response.ok) {
    throw new Error(`HTTP Hatası (${response.status}): İstem ayrıştırılamadı.`);
  }

  const envelope: ApiResponse<CabinetConfig> =
    (await response.json()) as ApiResponse<CabinetConfig>;

  if (!envelope.success || !envelope.data) {
    throw new Error(envelope.error ?? "Doğal dil ayrıştırma başarısız oldu.");
  }

  return envelope.data;
}

export async function generateProductionPackage(
  config: CabinetConfig
): Promise<ProductionPackageResponse> {
  const response = await fetch(`${API_BASE}/generate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(config),
  });

  if (!response.ok) {
    throw new Error(
      `HTTP Hatası (${response.status}): Üretim paketi oluşturulamadı.`
    );
  }

  const envelope: ApiResponse<ProductionPackageResponse> =
    (await response.json()) as ApiResponse<ProductionPackageResponse>;

  if (!envelope.success || !envelope.data) {
    throw new Error(envelope.error ?? "Üretim motoru hatası.");
  }

  return envelope.data;
}

