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
  additional_modules?: CabinetConfig[];
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
}

export interface RoomLinePreset {
  id: string;
  category: string;
  title: string;
  subtitle: string;
  totalWidthMm: number;
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
  hinge_side: string | null;
  module_index: number;
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
  transform_3d: Box3DTransform;
}

export interface HardwareItem {
  code: string;
  name: string;
  unit: string;
  quantity: number;
  note: string;
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
  svg_content: string;
}

export interface NestingResult {
  sheet_width_mm: number;
  sheet_height_mm: number;
  kerf_mm: number;
  total_sheets: number;
  overall_efficiency_percentage: number;
  overall_waste_percentage: number;
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
  zip_download_url: string;
}
