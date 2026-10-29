import type { CabinetConfig, UserCustomPreset } from "../types/cabinet";

const STORAGE_KEY = "marangoz_user_custom_presets";

const DEFAULT_USER_PRESETS: UserCustomPreset[] = [
  {
    id: "preset_mansard_understairs_01",
    title: "Merdiven Altı / Tavan Arası Eğimli Dolap",
    description: "Sol dikmesi 120 cm, sağ dikmesi 210 cm olan açılı üst tablalı ve trapezoid arkalıklı merdiven altı depolama ünitesi.",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    tags: ["Eğimli", "Merdiven Altı", "Mansard", "Özel Ölçü"],
    config: {
      name: "Merdiven Altı Eğimli Dolap (120➔210cm)",
      cabinet_type: "wardrobe",
      width_mm: 1200,
      height_mm: 2100,
      depth_mm: 580,
      shelf_count: 3,
      door_type: "double",
      drawer_count: 2,
      drawer_front_height_mm: 180,
      has_plinth: true,
      plinth_height_mm: 80,
      has_slope: true,
      slope_side: "left",
      slope_start_height_mm: 1200,
      slope_angle_deg: 36.9,
      body_material: "18mm Beyaz Suntalam",
      body_color_hex: "#F4F1EA",
      door_color_hex: "#374151",
      front_pvc_thickness_mm: 2.0,
      hidden_pvc_thickness_mm: 0.4,
      back_panel_type: "grooved_8mm",
      sheet_size: "2800x2100",
      fastener_type: "minifix_dowel",
      cutting_mode: "panel_saw",
    },
  },
  {
    id: "preset_l_corner_base_02",
    title: "L-Köşe 90° Kör Panelli Mutfak Alt Dolabı",
    description: "90 derece dönüş açılı ve 100 mm rölöve kör kapama panelli L-Mutfak köşe modülü.",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    tags: ["L-Köşe", "Mutfak", "90 Derece", "Kör Kapama"],
    config: {
      name: "90° L-Köşe Mutfak Alt Modülü",
      cabinet_type: "kitchen_base",
      width_mm: 1050,
      height_mm: 860,
      depth_mm: 600,
      shelf_count: 1,
      door_type: "single_left",
      drawer_count: 0,
      drawer_front_height_mm: 180,
      has_plinth: true,
      plinth_height_mm: 100,
      is_corner_module: true,
      corner_angle_deg: 90.0,
      corner_blind_width_mm: 100.0,
      body_material: "18mm Beyaz Suntalam",
      body_color_hex: "#F4F1EA",
      door_color_hex: "#C89F70",
      front_pvc_thickness_mm: 2.0,
      hidden_pvc_thickness_mm: 0.4,
      back_panel_type: "grooved_8mm",
      sheet_size: "2800x2100",
      fastener_type: "minifix_dowel",
      cutting_mode: "panel_saw",
    },
  },
];

export function getUserCustomPresets(): UserCustomPreset[] {
  if (typeof window === "undefined") return DEFAULT_USER_PRESETS;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(DEFAULT_USER_PRESETS));
      return DEFAULT_USER_PRESETS;
    }
    const parsed = JSON.parse(raw) as UserCustomPreset[];
    return Array.isArray(parsed) && parsed.length > 0 ? parsed : DEFAULT_USER_PRESETS;
  } catch {
    return DEFAULT_USER_PRESETS;
  }
}

export function saveUserCustomPreset(
  title: string,
  description: string,
  config: CabinetConfig,
  tags: string[] = []
): UserCustomPreset {
  const currentPresets = getUserCustomPresets();
  const id = `preset_custom_${Date.now()}`;
  const now = new Date().toISOString();

  const newPreset: UserCustomPreset = {
    id,
    title: title.trim() || config.name || "Özel Tasarım",
    description: description.trim() || `${config.width_mm}x${config.height_mm}x${config.depth_mm} mm parametrik dolap`,
    createdAt: now,
    updatedAt: now,
    tags: tags.length > 0 ? tags : ["Özel Tasarım", config.cabinet_type],
    config: JSON.parse(JSON.stringify(config)),
  };

  const updated = [newPreset, ...currentPresets];
  if (typeof window !== "undefined") {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
  }
  return newPreset;
}

export function deleteUserCustomPreset(id: string): UserCustomPreset[] {
  const current = getUserCustomPresets();
  const filtered = current.filter((p) => p.id !== id);
  if (typeof window !== "undefined") {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(filtered));
  }
  return filtered;
}

export function exportSinglePresetAsJsonFile(preset: UserCustomPreset): void {
  const blob = new Blob([JSON.stringify(preset, null, 2)], {
    type: "application/json",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  const slug = preset.title.toLowerCase().replace(/[^a-z0-9]/g, "_").slice(0, 30);
  a.href = url;
  a.download = `marangoz_tasarim_${slug}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export function exportAllPresetsAsJsonFile(): void {
  const presets = getUserCustomPresets();
  const blob = new Blob([JSON.stringify(presets, null, 2)], {
    type: "application/json",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `marangoz_tum_ozel_tasarimlar_${new Date().toISOString().slice(0, 10)}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export function importPresetsFromJsonText(jsonText: string): {
  importedCount: number;
  errors: string[];
} {
  const errors: string[] = [];
  try {
    const parsed = JSON.parse(jsonText);
    const presetsToImport: UserCustomPreset[] = [];

    if (Array.isArray(parsed)) {
      for (const item of parsed) {
        if (item && item.config && item.config.width_mm && item.config.height_mm) {
          presetsToImport.push({
            id: item.id || `preset_imported_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
            title: item.title || item.config.name || "İçe Aktarılan Tasarım",
            description: item.description || "JSON dosyasından içe aktarıldı",
            createdAt: item.createdAt || new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            tags: item.tags || ["İçe Aktarılan"],
            config: item.config,
          });
        }
      }
    } else if (parsed && parsed.config && parsed.config.width_mm) {
      presetsToImport.push({
        id: parsed.id || `preset_imported_${Date.now()}`,
        title: parsed.title || parsed.config.name || "İçe Aktarılan Tasarım",
        description: parsed.description || "JSON dosyasından içe aktarıldı",
        createdAt: parsed.createdAt || new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        tags: parsed.tags || ["İçe Aktarılan"],
        config: parsed.config,
      });
    } else {
      errors.push("Geçerli bir Marangoz dolap konfigürasyonu bulunamadı.");
    }

    if (presetsToImport.length > 0) {
      const existing = getUserCustomPresets();
      const combined = [...presetsToImport, ...existing.filter((e) => !presetsToImport.some((p) => p.id === e.id))];
      if (typeof window !== "undefined") {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(combined));
      }
      return { importedCount: presetsToImport.length, errors };
    }
  } catch (err) {
    errors.push(`JSON ayrıştırma hatası: ${err instanceof Error ? err.message : String(err)}`);
  }
  return { importedCount: 0, errors };
}

