/**
 * Marangoz CAD/CAM & Nesting kesin TypeScript tip tanımları.
 * docs/03_ANTIGRAVITY_AGENT_RULES.md uyarınca `any` kullanımı kesinlikle yasaktır.
 */

export type CabinetType =
  | "wardrobe"
  | "kitchen_base"
  | "kitchen_wall"
  | "kitchen_tall"
  | "bathroom_vanity"
  | "bathroom_tall"
  | "dresser"
  | "bookshelf"
  | "shoe_cabinet"
  | "tv_unit";

export type DoorType = "none" | "single_left" | "single_right" | "double" | "flap_up";

export type BackPanelType = "grooved_8mm" | "nailed_3mm";

export type SheetSizeOption = "2800x2100" | "3660x1830";

export type FastenerType = "minifix_dowel" | "cabineo_12";

export type CuttingMode = "panel_saw" | "cnc_router";

export type PlinthType = "wood_plinth" | "adjustable_legs";

export interface ApiResponse<T> {
  success: boolean;
  data: T | null;
  error: string | null;
}

export interface EdgeBandSpec {
  length_1_mm: number;
  length_2_mm: number;
  width_1_mm: number;
  width_2_mm: number;
}

export interface CabinetZone {
  id?: string;
  name?: string;
  width_ratio?: number; // e.g. 1.0 (equal), 0.5, 2.0
  width_mm?: number; // explicit mm width (optional)
  shelf_count: number; // 0..12
  door_type: DoorType; // "none" | "single_left" | "single_right" | "double" | "flap_up"
  drawer_count: number; // 0..6
  drawer_front_height_mm?: number;
  has_hanging_rod?: boolean; // Elbise askı borusu
  appliance_niche_height_mm?: number; // Geriye dönük uyumluluk
  niche_height_mm?: number; // Açık niş / cihaz boşluğu yüksekliği (mm)
  niche_bottom_offset_mm?: number; // 0 = alt açık niş, >0 = orta açık niş (kahve istasyonu/fırın)
  niche_color_hex?: string; // Niş içi ve arka paneli kontrast rengi
  niche_back_open?: boolean; // Niş arkalığı açık mı (duvar prizi, havalandırma)
  door_color_hex?: string; // Bu bölmeye özel kapak rengi
}

export interface CabinetConfig {
  name: string;
  cabinet_type: CabinetType;
  width_mm: number;
  height_mm: number;
  depth_mm: number;
  shelf_count: number;
  door_type: DoorType;
  drawer_count: number;
  drawer_front_height_mm: number;
  appliance_niche_height_mm?: number;
  niche_height_mm?: number; // Açık niş / cihaz boşluğu yüksekliği (mm)
  niche_bottom_offset_mm?: number; // 0 = alt açık niş (buzdolabı), >0 = orta açık niş (kahve köşesi/fırın)
  niche_color_hex?: string; // Açık niş içi ve arka paneli kontrast rengi
  niche_back_open?: boolean; // Niş arkalığı açık mı
  additional_modules?: CabinetConfig[];
  zones?: CabinetZone[];
  has_plinth: boolean;
  plinth_height_mm: number;
  body_material: string;
  door_material?: string;
  body_color_hex: string;
  door_color_hex: string;
  front_pvc_thickness_mm: number;
  hidden_pvc_thickness_mm: number;
  back_panel_type: BackPanelType;
  sheet_size: SheetSizeOption;
  fastener_type?: FastenerType;
  cutting_mode?: CuttingMode;
  router_bit_diameter_mm?: number;
  left_filler_width_mm?: number;
  right_filler_width_mm?: number;
  has_baseboard_notch?: boolean;
  baseboard_notch_height_mm?: number;
  baseboard_notch_depth_mm?: number;
  has_column_notch?: boolean;
  column_notch_width_mm?: number;
  column_notch_depth_mm?: number;
  plinth_type?: PlinthType;
  has_slope?: boolean;
  slope_side?: "left" | "right";
  slope_start_height_mm?: number;
  slope_angle_deg?: number;
  is_corner_module?: boolean;
  corner_angle_deg?: number;
  corner_blind_width_mm?: number;
  hardware_brand?: "generic" | "blum" | "hafele" | "samet";
  drawer_system?: string;
  hinge_system?: string;
  lift_system?: string;
  handle_type?: string;
}

export type CatalogCategoryId =
  | "kitchen"
  | "bedroom"
  | "bathroom"
  | "living"
  | "hallway"
  | "office"
  | "special";

export interface CatalogCategoryMeta {
  id: CatalogCategoryId;
  label: string;
  description: string;
}

export interface RoomLinePreset {
  id: string;
  categoryId: CatalogCategoryId;
  category: string;
  title: string;
  subtitle: string;
  totalWidthMm: number;
  prompt: string;
  highlights: string[];
  config: CabinetConfig;
}

export interface DrillPoint {
  x_mm: number;
  y_mm: number;
  diameter_mm: number;
  depth_mm: number;
  layer: string;
  description: string;
}

export interface GroovePath {
  x_start_mm: number;
  y_start_mm: number;
  width_mm: number;
  length_mm: number;
  depth_mm: number;
  layer: string;
}

export interface Box3DTransform {
  center_x_mm: number;
  center_y_mm: number;
  center_z_mm: number;
  size_x_mm: number;
  size_y_mm: number;
  size_z_mm: number;
  color_hex: string;
  is_door: boolean;
  is_drawer: boolean;
  is_hanging_rod?: boolean;
  is_niche?: boolean;
  hinge_side: string | null;
  module_index: number;
  rotation_z_deg?: number;
  is_sloped?: boolean;
  corner_rotation_y_deg?: number;
}

export interface PanelPart {
  part_id: string;
  code: string;
  name: string;
  material: string;
  thickness_mm: number;
  quantity: number;
  net_length_mm: number;
  net_width_mm: number;
  cut_length_mm: number;
  cut_width_mm: number;
  pvc_deduction_length_mm: number;
  pvc_deduction_width_mm: number;
  edge_band: EdgeBandSpec;
  area_m2: number;
  grain_direction: string;
  drills: DrillPoint[];
  grooves: GroovePath[];
  holding_tabs_count?: number;
  notch_info?: string;
  is_true_shape?: boolean;
  is_trapezoid?: boolean;
  trapezoid_h_start_mm?: number;
  trapezoid_h_end_mm?: number;
  transform_3d: Box3DTransform;
}

export interface HardwareItem {
  code: string;
  name: string;
  unit: string;
  quantity: number;
  note: string;
}

export interface ShelfDeflectionResult {
  shelf_id: string;
  span_mm: number;
  depth_mm: number;
  thickness_mm: number;
  material: string;
  load_kg: number;
  deflection_mm: number;
  allowable_deflection_mm: number;
  is_acceptable: boolean;
  warning?: string | null;
  recommendation?: string | null;
}

export interface DoorHardwareAudit {
  door_id: string;
  height_mm: number;
  width_mm: number;
  weight_kg: number;
  door_type: string;
  current_hinge_count: number;
  recommended_hinge_count: number;
  recommended_gas_piston_n?: number | null;
  is_acceptable: boolean;
  warning?: string | null;
}

export interface SiteFittingAudit {
  has_wall_clash_risk: boolean;
  has_baseboard_clash_risk: boolean;
  warnings: string[];
  recommendations: string[];
}

export interface EngineeringAuditReport {
  shelf_deflections: ShelfDeflectionResult[];
  door_audits: DoorHardwareAudit[];
  site_fitting: SiteFittingAudit;
  overall_health_score: number;
  has_critical_issues: boolean;
  summary_messages: string[];
}

export interface BOMReport {
  config: CabinetConfig;
  parts: PanelPart[];
  hardware: HardwareItem[];
  total_net_area_m2: number;
  total_cut_area_m2: number;
  total_pvc_04_meters: number;
  total_pvc_10_meters: number;
  total_pvc_20_meters: number;
  total_parts_count: number;
  total_drill_count: number;
  engineering_audit?: EngineeringAuditReport;
}

export interface NestedPartPlacement {
  part_id: string;
  code: string;
  name: string;
  thickness_mm: number;
  sheet_index: number;
  x_mm: number;
  y_mm: number;
  width_mm: number;
  height_mm: number;
  rotated: boolean;
  cut_length_mm: number;
  cut_width_mm: number;
  holding_tabs_count?: number;
  notch_info?: string;
  is_true_shape?: boolean;
}

export interface RemnantStockItem {
  remnant_id: string;
  sheet_index: number;
  material: string;
  thickness_mm: number;
  x_mm: number;
  y_mm: number;
  width_mm: number;
  height_mm: number;
  area_m2: number;
  reusable?: boolean;
}

export interface SheetLayout {
  sheet_index: number;
  material: string;
  thickness_mm: number;
  sheet_width_mm: number;
  sheet_height_mm: number;
  usable_width_mm: number;
  usable_height_mm: number;
  trim_margin_mm: number;
  kerf_mm: number;
  used_area_m2: number;
  waste_area_m2: number;
  waste_percentage: number;
  placements: NestedPartPlacement[];
  remnants?: RemnantStockItem[];
  svg_content: string;
}

export interface NestingResult {
  sheet_width_mm: number;
  sheet_height_mm: number;
  kerf_mm: number;
  total_sheets: number;
  overall_efficiency_percentage: number;
  overall_waste_percentage: number;
  reusable_remnant_area_m2?: number;
  effective_waste_percentage?: number;
  remnants?: RemnantStockItem[];
  sheets: SheetLayout[];
  combined_svg: string;
}

export interface ProductionPackageResponse {
  job_id: string;
  config: CabinetConfig;
  bom: BOMReport;
  nesting: NestingResult;
  glb_base64: string;
  dxf_filenames: string[];
  cix_filenames?: string[];
  zip_download_url: string;
}

export interface ChatMessage {
  id?: string;
  role: "user" | "assistant";
  content: string;
  timestamp?: string;
  diff_summary?: string[];
}

export interface RevisionResponseData {
  updated_config: CabinetConfig;
  assistant_message: string;
  diff_summary: string[];
}

export interface RevisionResponse {
  success: boolean;
  message: string;
  data: RevisionResponseData;
}

export interface UserCustomPreset {
  id: string;
  title: string;
  description: string;
  createdAt: string;
  updatedAt: string;
  config: CabinetConfig;
  tags?: string[];
}


