import { useEffect, useMemo, useRef, useState } from "react";
import { Canvas, useThree } from "@react-three/fiber";
import { ContactShadows, Edges, Grid, Html, OrbitControls } from "@react-three/drei";
import type { OrbitControls as OrbitControlsImpl } from "three-stdlib";
import {
  Box,
  DoorOpen,
  Expand,
  Eye,
  HelpCircle,
  Layers,
  Maximize2,
  Minimize2,
  ScanLine,
  X as CloseIcon,
} from "lucide-react";
import * as THREE from "three";
import type { BOMReport, CabinetConfig, PanelPart } from "../types/cabinet";

interface CabinetViewer3DProps {
  bom: BOMReport;
  glbBase64: string;
  selectedPartId: string | null;
  onSelectPart: (partId: string | null) => void;
}

interface PanelMeshProps {
  part: PanelPart;
  config: CabinetConfig;
  cabinetCenterY: number;
  isOpen: boolean;
  explodeFactor: number;
  wireframe: boolean;
  xrayMode: boolean;
  isSelected: boolean;
  onSelect: () => void;
  onToggleOpen: () => void;
}

/**
 * Süpürgelik ve kolon kertmesi olan yan dikmeler için gerçekçi CSG katı geometri üretir.
 */
function createNotchedSidePanelGeometry(
  sx: number,
  sy: number,
  sz: number,
  hasBaseboard: boolean,
  baseboardH: number,
  baseboardD: number,
  hasColumn: boolean,
  columnW: number,
  columnD: number
): THREE.BufferGeometry {
  const shape = new THREE.Shape();
  const z_front = sz / 2.0;
  const z_back = -sz / 2.0;
  const y_top = sy / 2.0;
  const y_bot = -sy / 2.0;

  // 1. Ön alt köşe
  shape.moveTo(-z_front, y_bot);

  // 2. Ön üst köşe
  shape.lineTo(-z_front, y_top);

  // 3. Üst arka kenar (Kolon kertmesi varsa kertme boşluğunu takip et)
  if (hasColumn && columnD > 0 && columnW > 0) {
    const colZCut = z_back + columnD;
    const colYCut = y_top - columnW;
    shape.lineTo(-colZCut, y_top);
    shape.lineTo(-colZCut, colYCut);
    shape.lineTo(-z_back, colYCut);
  } else {
    shape.lineTo(-z_back, y_top);
  }

  // 4. Arka alt kenar (Süpürgelik kertmesi varsa kertme boşluğunu takip et)
  if (hasBaseboard && baseboardD > 0 && baseboardH > 0) {
    const bbYCut = y_bot + baseboardH;
    const bbZCut = z_back + baseboardD;
    shape.lineTo(-z_back, bbYCut);
    shape.lineTo(-bbZCut, bbYCut);
    shape.lineTo(-bbZCut, y_bot);
  } else {
    shape.lineTo(-z_back, y_bot);
  }

  // 5. Alt kenarı kapat
  shape.closePath();

  const geom = new THREE.ExtrudeGeometry(shape, { depth: sx, bevelEnabled: false });
  geom.rotateY(Math.PI / 2.0);
  geom.translate(-sx / 2.0, 0, 0);
  geom.computeVertexNormals();
  return geom;
}

interface DrillsXRayProps {
  part: PanelPart;
  sx: number;
  sy: number;
  sz: number;
}

/**
 * Röntgen (X-Ray) modunda Sistem 32 delikleri, Lamello Cabineo cepleri,
 * çekmece ray montaj delikleri, menteşe tas delikleri ve arkalık kanallarını
 * gerçekçi CAD/CAM pozisyonlarında 3D olarak görselleştirir.
 */
function PanelDrillsAndGroovesXRay({ part, sx, sy, sz }: DrillsXRayProps) {
  if (
    (!part.drills || part.drills.length === 0) &&
    (!part.grooves || part.grooves.length === 0)
  ) {
    return null;
  }

  // Panel tipini ve kalınlık eksenini otomatik tespit et
  const isDoor = Boolean(part.transform_3d?.is_door) || part.code.includes("KAPAK");
  const isSide =
    part.code.includes("YAN_") ||
    part.code.includes("DIKME") ||
    (sx <= sy && sx <= sz && !isDoor);
  const isHoriz =
    !isSide &&
    (part.code.includes("TABLA_") ||
      part.code.includes("RAF") ||
      (sy <= sx && sy <= sz && !isDoor));

  return (
    <group renderOrder={10}>
      {part.drills.map((drill, dIdx) => {
        const rad = Math.max(0.003, (drill.diameter_mm || 5) / 2000.0);
        const dep = Math.max(0.008, (drill.depth_mm || 12) / 1000.0);

        const isCabineo =
          drill.layer.includes("CABINEO") ||
          drill.description?.toLowerCase().includes("cabineo");
        const isSystem32 =
          drill.layer.includes("SYSTEM32") ||
          drill.layer.includes("SHELF_PIN") ||
          drill.description?.toLowerCase().includes("raf");
        const isSlide =
          drill.layer.includes("SLIDE") ||
          drill.description?.toLowerCase().includes("ray");
        const isHinge =
          drill.layer.includes("HINGE") ||
          drill.description?.toLowerCase().includes("menteşe");
        const isMinifix =
          drill.layer.includes("MINIFIX") ||
          drill.description?.toLowerCase().includes("minifiks");

        const drillColor = isCabineo
          ? "#F59E0B"
          : isHinge
          ? "#A855F7"
          : isSystem32
          ? "#06B6D4"
          : isSlide
          ? "#10B981"
          : isMinifix
          ? "#EC4899"
          : "#38BDF8";

        let posX = 0;
        let posY = 0;
        let posZ = 0;
        let rot: [number, number, number] = [0, 0, 0];

        if (isSide) {
          // Yan dikme: kalınlık X'te, yükseklik Y'de, derinlik Z'de
          // drill.x_mm: alt kenardan yukarıya yükseklik
          // drill.y_mm: arkadan öne doğru derinlik
          posY = -sy / 2.0 + drill.x_mm / 1000.0;
          posZ = -sz / 2.0 + drill.y_mm / 1000.0;

          const isRight = part.code.includes("SAG");
          const isLeft = part.code.includes("SOL");
          posX = isRight
            ? -sx / 2.0 + dep / 2.0
            : isLeft
            ? sx / 2.0 - dep / 2.0
            : 0;

          rot = [0, 0, Math.PI / 2.0];
        } else if (isHoriz) {
          // Alt/Üst tabla ve raflar: kalınlık Y'de, genişlik X'te, derinlik Z'de
          // drill.x_mm: sol kenardan sağa genişlik
          // drill.y_mm: arkadan öne doğru derinlik
          posX = -sx / 2.0 + drill.x_mm / 1000.0;
          posZ = -sz / 2.0 + drill.y_mm / 1000.0;

          const isTop = part.code.includes("UST");
          posY = isTop ? -sy / 2.0 + dep / 2.0 : sy / 2.0 - dep / 2.0;

          rot = [0, 0, 0];
        } else {
          // Kapaklar ve dik ön/arka paneller: kalınlık Z'de, genişlik X'te, yükseklik Y'de
          // drill.x_mm: alt kenardan yukarıya yükseklik
          // drill.y_mm: sol kenardan sağa genişlik
          posY = -sy / 2.0 + drill.x_mm / 1000.0;
          posX = -sx / 2.0 + drill.y_mm / 1000.0;
          posZ = -sz / 2.0 + dep / 2.0;

          rot = [Math.PI / 2.0, 0, 0];
        }

        return (
          <mesh
            key={`${part.part_id}-drill-${dIdx}`}
            position={[posX, posY, posZ]}
            rotation={rot}
          >
            <cylinderGeometry args={[rad, rad, dep, 16]} />
            <meshStandardMaterial
              color={drillColor}
              emissive={drillColor}
              emissiveIntensity={0.8}
              roughness={0.2}
              metalness={0.8}
              toneMapped={false}
            />
          </mesh>
        );
      })}

      {part.grooves.map((groove, gIdx) => {
        let posX = 0;
        let posY = 0;
        let posZ = 0;
        let boxArgs: [number, number, number] = [0.008, 0.008, 0.008];

        if (isSide) {
          // Yan dikmedeki arkalık kanalı
          const gDepthX = Math.max(0.005, groove.depth_mm / 1000.0);
          const gSpanY = Math.max(0.01, groove.width_mm / 1000.0);
          const gWidthZ = Math.max(0.004, groove.length_mm / 1000.0);

          posY = -sy / 2.0 + (groove.x_start_mm + groove.width_mm / 2.0) / 1000.0;
          posZ = -sz / 2.0 + (groove.y_start_mm + groove.length_mm / 2.0) / 1000.0;

          const isRight = part.code.includes("SAG");
          const isLeft = part.code.includes("SOL");
          posX = isRight
            ? -sx / 2.0 + gDepthX / 2.0
            : isLeft
            ? sx / 2.0 - gDepthX / 2.0
            : 0;

          boxArgs = [gDepthX, gSpanY, gWidthZ];
        } else if (isHoriz) {
          // Alt/Üst tabladaki arkalık kanalı
          const gSpanX = Math.max(0.01, groove.width_mm / 1000.0);
          const gDepthY = Math.max(0.005, groove.depth_mm / 1000.0);
          const gWidthZ = Math.max(0.004, groove.length_mm / 1000.0);

          posX = -sx / 2.0 + (groove.x_start_mm + groove.width_mm / 2.0) / 1000.0;
          posZ = -sz / 2.0 + (groove.y_start_mm + groove.length_mm / 2.0) / 1000.0;

          const isTop = part.code.includes("UST");
          posY = isTop ? -sy / 2.0 + gDepthY / 2.0 : sy / 2.0 - gDepthY / 2.0;

          boxArgs = [gSpanX, gDepthY, gWidthZ];
        } else {
          // Ön/arka paneller
          const gSpanX = Math.max(0.01, groove.width_mm / 1000.0);
          const gSpanY = Math.max(0.01, groove.length_mm / 1000.0);
          const gDepthZ = Math.max(0.005, groove.depth_mm / 1000.0);

          posX = -sx / 2.0 + (groove.x_start_mm + groove.width_mm / 2.0) / 1000.0;
          posY = -sy / 2.0 + (groove.y_start_mm + groove.length_mm / 2.0) / 1000.0;
          posZ = -sz / 2.0 + gDepthZ / 2.0;

          boxArgs = [gSpanX, gSpanY, gDepthZ];
        }

        return (
          <mesh
            key={`${part.part_id}-groove-${gIdx}`}
            position={[posX, posY, posZ]}
          >
            <boxGeometry args={boxArgs} />
            <meshStandardMaterial
              color="#F97316"
              emissive="#F97316"
              emissiveIntensity={0.8}
              roughness={0.2}
              metalness={0.5}
              toneMapped={false}
            />
          </mesh>
        );
      })}
    </group>
  );
}

function PanelMesh3D({
  part,
  config,
  cabinetCenterY,
  isOpen,
  explodeFactor,
  wireframe,
  xrayMode,
  isSelected,
  onSelect,
  onToggleOpen,
}: PanelMeshProps) {
  const [hovered, setHovered] = useState<boolean>(false);
  const t3d = part.transform_3d;

  // mm -> metre dönüşümü (1000 mm = 1.0 birim)
  const sx = t3d.size_x_mm / 1000.0;
  const sy = t3d.size_y_mm / 1000.0;
  const sz = t3d.size_z_mm / 1000.0;

  const baseCx = t3d.center_x_mm / 1000.0;
  const baseCy = t3d.center_y_mm / 1000.0;
  const baseCz = t3d.center_z_mm / 1000.0;

  // Patlatılmış görünüm (Exploded View) vektörü
  const dy = baseCy - cabinetCenterY;
  const explodeX = baseCx * explodeFactor * 0.35;
  const explodeY = dy * explodeFactor * 0.35;
  const explodeZ =
    t3d.is_door || t3d.is_drawer
      ? explodeFactor * 0.28
      : part.code === "ARKALIK"
        ? -explodeFactor * 0.25
        : baseCz * explodeFactor * 0.3;

  // Çekmece parçası ise tıklandığında veya global açıldığında +280 mm öne doğru teleskopik ray hareketi
  const drawerSlideZ = t3d.is_drawer && isOpen ? 0.28 : 0.0;

  const cx = baseCx + explodeX;
  const cy = baseCy + explodeY;
  const cz = baseCz + explodeZ + drawerSlideZ;

  const displayColor = isSelected
    ? "#38BDF8"
    : hovered
      ? "#7DD3FC"
      : t3d.color_hex;

  // Yan dikmelerde süpürgelik veya kolon kertmesi varsa gerçekçi CSG kesik geometri üret
  const isNotchedSide =
    part.code.includes("YAN_") &&
    Boolean(part.notch_info) &&
    (Boolean(config.has_baseboard_notch) || Boolean(config.has_column_notch));

  const notchedGeometry = useMemo(() => {
    if (!isNotchedSide) return null;
    return createNotchedSidePanelGeometry(
      sx,
      sy,
      sz,
      Boolean(config.has_baseboard_notch),
      (config.baseboard_notch_height_mm ?? 80) / 1000.0,
      (config.baseboard_notch_depth_mm ?? 15) / 1000.0,
      Boolean(config.has_column_notch),
      (config.column_notch_width_mm ?? 120) / 1000.0,
      (config.column_notch_depth_mm ?? 120) / 1000.0
    );
  }, [isNotchedSide, sx, sy, sz, config]);

  // Kapak ise menteşe ekseni etrafında gerçekçi açılma dönüşü uygula
  if (t3d.is_door) {
    if (t3d.hinge_side === "top") {
      const pivotY = cy + sy / 2.0;
      const offsetY = -sy / 2.0;
      const openAngleX = isOpen ? -Math.PI * 0.56 : 0.0;

      return (
        <group position={[cx, pivotY, cz]} rotation={[openAngleX, 0, 0]}>
          <group position={[0, offsetY, 0]}>
            <mesh
              onClick={(e) => {
                e.stopPropagation();
                onToggleOpen();
                onSelect();
              }}
              onPointerOver={(e) => {
                e.stopPropagation();
                setHovered(true);
              }}
              onPointerOut={() => setHovered(false)}
              castShadow
              receiveShadow
            >
              <boxGeometry args={[sx, sy, sz]} />
              <meshStandardMaterial
                color={displayColor}
                roughness={xrayMode ? 0.1 : 0.45}
                metalness={0.08}
                wireframe={wireframe}
                transparent={xrayMode}
                opacity={xrayMode ? 0.35 : 1.0}
                depthWrite={!xrayMode}
              />
              <Edges threshold={15} color={isSelected ? "#0284C7" : xrayMode ? "#38BDF8" : "#334155"} />
              {isSelected && (
                <Html position={[0, sy / 2 + 0.06, 0]} center distanceFactor={3.5}>
                  <div className="pointer-events-none whitespace-nowrap rounded-md border border-sky-400/50 bg-slate-900/95 px-2.5 py-1 text-xs font-medium text-sky-200 shadow-lg">
                    {part.part_id} {part.name} ({part.cut_length_mm}×{part.cut_width_mm} mm)
                  </div>
                </Html>
              )}
            </mesh>
            {xrayMode && (
              <PanelDrillsAndGroovesXRay part={part} sx={sx} sy={sy} sz={sz} />
            )}
          </group>
        </group>
      );
    }

    const isLeftHinge = t3d.hinge_side === "left";
    const pivotX = isLeftHinge ? cx - sx / 2.0 : cx + sx / 2.0;
    const offsetX = isLeftHinge ? sx / 2.0 : -sx / 2.0;
    const openAngle = isOpen
      ? isLeftHinge
        ? -Math.PI * 0.58
        : Math.PI * 0.58
      : 0.0;

    return (
      <group position={[pivotX, cy, cz]} rotation={[0, openAngle, 0]}>
        <group position={[offsetX, 0, 0]}>
          <mesh
            position={[0, 0, 0]}
            onClick={(e) => {
              e.stopPropagation();
              onToggleOpen();
              onSelect();
            }}
            onPointerOver={(e) => {
              e.stopPropagation();
              setHovered(true);
            }}
            onPointerOut={() => setHovered(false)}
            castShadow
            receiveShadow
          >
            <boxGeometry args={[sx, sy, sz]} />
            <meshStandardMaterial
              color={displayColor}
              roughness={xrayMode ? 0.1 : 0.45}
              metalness={0.08}
              wireframe={wireframe}
              transparent={xrayMode}
              opacity={xrayMode ? 0.35 : 1.0}
              depthWrite={!xrayMode}
            />
            <Edges threshold={15} color={isSelected ? "#0284C7" : xrayMode ? "#38BDF8" : "#334155"} />
            {isSelected && (
              <Html position={[0, sy / 2 + 0.06, 0]} center distanceFactor={3.5}>
                <div className="pointer-events-none whitespace-nowrap rounded-md border border-sky-400/50 bg-slate-900/95 px-2.5 py-1 text-xs font-medium text-sky-200 shadow-lg">
                  {part.part_id} {part.name} ({part.cut_length_mm}×{part.cut_width_mm} mm)
                </div>
              </Html>
            )}
          </mesh>
          {xrayMode && (
            <PanelDrillsAndGroovesXRay part={part} sx={sx} sy={sy} sz={sz} />
          )}
        </group>
      </group>
    );
  }

  // Elbise askı borusu (Metal silindir ve yan rozetler)
  if (t3d.is_hanging_rod) {
    return (
      <group position={[cx, cy, cz]}>
        <mesh rotation={[0, 0, Math.PI / 2]} castShadow receiveShadow>
          <cylinderGeometry args={[0.012, 0.012, sx, 24]} />
          <meshStandardMaterial
            color="#E2E8F0"
            metalness={0.9}
            roughness={0.15}
          />
        </mesh>
        <mesh position={[-sx / 2 + 0.005, 0, 0]} rotation={[0, 0, Math.PI / 2]}>
          <cylinderGeometry args={[0.02, 0.02, 0.01, 16]} />
          <meshStandardMaterial color="#94A3B8" metalness={0.8} roughness={0.25} />
        </mesh>
        <mesh position={[sx / 2 - 0.005, 0, 0]} rotation={[0, 0, Math.PI / 2]}>
          <cylinderGeometry args={[0.02, 0.02, 0.01, 16]} />
          <meshStandardMaterial color="#94A3B8" metalness={0.8} roughness={0.25} />
        </mesh>
        {isSelected && (
          <Html position={[0, 0.05, 0]} center distanceFactor={3.5}>
            <div className="pointer-events-none whitespace-nowrap rounded-md border border-sky-400/50 bg-slate-900/95 px-2.5 py-1 text-xs font-medium text-sky-200 shadow-lg">
              {part.name} ({part.cut_length_mm} mm)
            </div>
          </Html>
        )}
      </group>
    );
  }

  const rotZ = t3d.rotation_z_deg ? (t3d.rotation_z_deg * Math.PI) / 180.0 : 0.0;
  const rotY = t3d.corner_rotation_y_deg ? (t3d.corner_rotation_y_deg * Math.PI) / 180.0 : 0.0;
  const geomSx = t3d.is_sloped ? part.net_length_mm / 1000.0 : sx;

  return (
    <group position={[cx, cy, cz]} rotation={[0, rotY, rotZ]}>
      <mesh
        onClick={(e) => {
          e.stopPropagation();
          if (t3d.is_drawer) {
            onToggleOpen();
          }
          onSelect();
        }}
        onPointerOver={(e) => {
          e.stopPropagation();
          setHovered(true);
        }}
        onPointerOut={() => setHovered(false)}
        castShadow
        receiveShadow
        geometry={notchedGeometry ?? undefined}
      >
        {!notchedGeometry && <boxGeometry args={[geomSx, sy, sz]} />}
        <meshStandardMaterial
          color={displayColor}
          roughness={xrayMode ? 0.1 : 0.55}
          metalness={0.05}
          wireframe={wireframe}
          transparent={xrayMode}
          opacity={xrayMode ? 0.35 : 1.0}
          depthWrite={!xrayMode}
        />
        <Edges threshold={15} color={isSelected ? "#0284C7" : xrayMode ? "#38BDF8" : "#475569"} />
        {isSelected && (
          <Html position={[0, sy / 2 + 0.06, 0]} center distanceFactor={3.5}>
            <div className="pointer-events-none whitespace-nowrap rounded-md border border-sky-400/50 bg-slate-900/95 px-2.5 py-1 text-xs font-medium text-sky-200 shadow-lg">
              {part.part_id} {part.name} ({part.cut_length_mm}×{part.cut_width_mm} mm)
            </div>
          </Html>
        )}
      </mesh>

      {/* Röntgen Modunda Sistem 32 delikleri, Cabineo cepleri ve kanalların 3D renderı */}
      {xrayMode && (
        <PanelDrillsAndGroovesXRay part={part} sx={sx} sy={sy} sz={sz} />
      )}
    </group>
  );
}

function CameraController({
  view,
  cameraDist,
  controlsRef,
}: {
  view: "iso" | "front" | "side" | "top";
  cameraDist: number;
  controlsRef: React.RefObject<OrbitControlsImpl | null>;
}) {
  const { camera } = useThree();

  useEffect(() => {
    if (view === "iso") {
      camera.position.set(cameraDist * 0.7, 1.5, cameraDist * 0.9);
    } else if (view === "front") {
      camera.position.set(0, 0, cameraDist * 1.35);
    } else if (view === "side") {
      camera.position.set(cameraDist * 1.35, 0, 0);
    } else if (view === "top") {
      camera.position.set(0, cameraDist * 1.45, 0.001);
    }
    camera.lookAt(0, 0, 0);
    if (controlsRef.current) {
      controlsRef.current.target.set(0, 0, 0);
      controlsRef.current.update();
    }
  }, [view, cameraDist, camera, controlsRef]);

  return null;
}

export function CabinetViewer3D({
  bom,
  glbBase64,
  selectedPartId,
  onSelectPart,
}: CabinetViewer3DProps) {
  const [allDoorsOpen, setAllDoorsOpen] = useState<boolean>(false);
  const [openPartIds, setOpenPartIds] = useState<Set<string>>(new Set());
  const [explodeFactor, setExplodeFactor] = useState<number>(0);
  const [wireframe, setWireframe] = useState<boolean>(false);
  const [xrayMode, setXrayMode] = useState<boolean>(false);
  const [cameraView, setCameraView] = useState<"iso" | "front" | "side" | "top">("iso");
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);
  const [showHelpModal, setShowHelpModal] = useState<boolean>(false);

  const controlsRef = useRef<OrbitControlsImpl | null>(null);

  const allModules = [bom.config, ...(bom.config.additional_modules ?? [])];
  const totalWidthMm = allModules.reduce((acc, m) => acc + m.width_mm, 0);
  const maxHeightMm = Math.max(...allModules.map((m) => m.height_mm));
  const maxDepthMm = Math.max(...allModules.map((m) => m.depth_mm));
  const hasAnyDoorsOrDrawers = allModules.some(
    (m) => m.door_type !== "none" || (m.drawer_count ?? 0) > 0
  );

  const cabinetCenterY = maxHeightMm / 2000.0;
  const cameraDist = Math.max(2.4, (totalWidthMm / 1000.0) * 1.15);

  const selectedPart =
    bom.parts.find((p) => p.part_id === selectedPartId) ?? null;

  const toggleAllDoors = () => {
    const nextState = !allDoorsOpen;
    setAllDoorsOpen(nextState);
    if (nextState) {
      const doorAndDrawerIds = bom.parts
        .filter((p) => p.transform_3d.is_door || p.transform_3d.is_drawer)
        .map((p) => p.part_id);
      setOpenPartIds(new Set(doorAndDrawerIds));
    } else {
      setOpenPartIds(new Set());
    }
  };

  const toggleIndividualPart = (partId: string) => {
    setOpenPartIds((prev) => {
      const next = new Set(prev);
      if (next.has(partId)) {
        next.delete(partId);
      } else {
        next.add(partId);
      }
      return next;
    });
  };

  // Klavye Kısayolları (Space: Kapaklar, X: Röntgen, E: Patlatılmış, F: Tam Ekran, ?: Yardım)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Kullanıcı metin girdisi içindeyse tetikleme
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement ||
        e.target instanceof HTMLSelectElement
      ) {
        return;
      }

      if (e.code === "Space") {
        e.preventDefault();
        toggleAllDoors();
      } else if (e.key.toLowerCase() === "x") {
        setXrayMode((prev) => !prev);
      } else if (e.key.toLowerCase() === "e") {
        setExplodeFactor((prev) => (prev > 0 ? 0 : 1));
      } else if (e.key.toLowerCase() === "f") {
        setIsFullscreen((prev) => !prev);
      } else if (e.key === "1") {
        setCameraView("iso");
      } else if (e.key === "2") {
        setCameraView("front");
      } else if (e.key === "3") {
        setCameraView("side");
      } else if (e.key === "4") {
        setCameraView("top");
      } else if (e.key === "?" || (e.shiftKey && e.key === "/")) {
        setShowHelpModal((prev) => !prev);
      } else if (e.key === "Escape") {
        setIsFullscreen(false);
        setShowHelpModal(false);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [allDoorsOpen, bom.parts]);

  const handleDownloadGlb = () => {
    if (!glbBase64) return;
    const byteCharacters = atob(glbBase64);
    const byteNumbers = new Array<number>(byteCharacters.length);
    for (let i = 0; i < byteCharacters.length; i += 1) {
      byteNumbers[i] = byteCharacters.charCodeAt(i);
    }
    const byteArray = new Uint8Array(byteNumbers);
    const blob = new Blob([byteArray], { type: "model/gltf-binary" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${bom.config.cabinet_type}_${totalWidthMm}x${maxHeightMm}.glb`;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div
      className={`relative flex flex-col overflow-hidden bg-slate-900/95 transition-all ${
        isFullscreen
          ? "fixed inset-0 z-50 h-screen w-screen rounded-none border-none"
          : "h-[580px] w-full rounded-2xl border border-slate-800 shadow-xl"
      }`}
    >
      {/* Üst 3D Kontrol Çubuğu */}
      <div className="z-10 flex flex-wrap items-center justify-between gap-2 border-b border-slate-800 bg-slate-950/80 px-4 py-2.5 backdrop-blur">
        <div className="flex flex-wrap items-center gap-2">
          <Box className="h-4 w-4 text-sky-400" />
          <span className="text-xs font-semibold uppercase tracking-wider text-slate-200">
            3D CAD ({totalWidthMm} × {maxHeightMm} × {maxDepthMm} mm)
          </span>
          {allModules.length > 1 && (
            <span className="rounded-md border border-indigo-500/40 bg-indigo-500/15 px-2 py-0.5 text-[11px] font-semibold text-indigo-300">
              {allModules.length} Modül
            </span>
          )}
          {xrayMode && (
            <span className="rounded-md border border-amber-500/40 bg-amber-500/15 px-2 py-0.5 text-[11px] font-semibold text-amber-300 animate-pulse">
              CNC Röntgen Aktif
            </span>
          )}

          {/* Hızlı Kamera Açıları */}
          <div className="hidden sm:flex items-center gap-1 rounded-lg border border-slate-800 bg-slate-900 p-0.5 text-[11px]">
            <button
              type="button"
              onClick={() => setCameraView("iso")}
              className={`rounded px-2 py-0.5 font-medium transition ${
                cameraView === "iso" ? "bg-sky-600 text-white" : "text-slate-400 hover:text-white"
              }`}
            >
              İzo (1)
            </button>
            <button
              type="button"
              onClick={() => setCameraView("front")}
              className={`rounded px-2 py-0.5 font-medium transition ${
                cameraView === "front" ? "bg-sky-600 text-white" : "text-slate-400 hover:text-white"
              }`}
            >
              Ön (2)
            </button>
            <button
              type="button"
              onClick={() => setCameraView("side")}
              className={`rounded px-2 py-0.5 font-medium transition ${
                cameraView === "side" ? "bg-sky-600 text-white" : "text-slate-400 hover:text-white"
              }`}
            >
              Yan (3)
            </button>
            <button
              type="button"
              onClick={() => setCameraView("top")}
              className={`rounded px-2 py-0.5 font-medium transition ${
                cameraView === "top" ? "bg-sky-600 text-white" : "text-slate-400 hover:text-white"
              }`}
            >
              Üst (4)
            </button>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
          {hasAnyDoorsOrDrawers && (
            <button
              type="button"
              onClick={toggleAllDoors}
              className={`flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-xs font-medium transition ${
                openPartIds.size > 0
                  ? "border-sky-500 bg-sky-500/20 text-sky-300"
                  : "border-slate-700 bg-slate-800 text-slate-300 hover:bg-slate-700"
              }`}
              title="Kısayol: Space (Boşluk)"
            >
              <DoorOpen className="h-3.5 w-3.5" />
              <span>{openPartIds.size > 0 ? "Kapat" : "Aç"}</span>
            </button>
          )}

          <button
            type="button"
            onClick={() => setXrayMode((prev) => !prev)}
            className={`flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-xs font-medium transition ${
              xrayMode
                ? "border-amber-500 bg-amber-500/25 text-amber-300 shadow-[0_0_12px_rgba(245,158,11,0.3)]"
                : "border-slate-700 bg-slate-800 text-slate-300 hover:bg-slate-700"
            }`}
            title="Kısayol: X tuşu"
          >
            <ScanLine className="h-3.5 w-3.5" />
            <span className="hidden md:inline">Röntgen</span>
          </button>

          <button
            type="button"
            onClick={() => setExplodeFactor((prev) => (prev > 0 ? 0 : 1))}
            className={`flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-xs font-medium transition ${
              explodeFactor > 0
                ? "border-amber-500 bg-amber-500/20 text-amber-300"
                : "border-slate-700 bg-slate-800 text-slate-300 hover:bg-slate-700"
            }`}
            title="Kısayol: E tuşu"
          >
            <Expand className="h-3.5 w-3.5" />
            <span className="hidden md:inline">{explodeFactor > 0 ? "Topla" : "Patlat"}</span>
          </button>

          <button
            type="button"
            onClick={() => setWireframe((prev) => !prev)}
            className={`flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-xs font-medium transition ${
              wireframe
                ? "border-emerald-500 bg-emerald-500/20 text-emerald-300"
                : "border-slate-700 bg-slate-800 text-slate-300 hover:bg-slate-700"
            }`}
          >
            <Eye className="h-3.5 w-3.5" />
            <span className="hidden md:inline">Tel Kafes</span>
          </button>

          <button
            type="button"
            onClick={handleDownloadGlb}
            title=".GLB 3D Modeli İndir"
            className="flex items-center gap-1.5 rounded-lg border border-slate-700 bg-slate-800 px-2.5 py-1 text-xs font-medium text-slate-200 transition hover:border-sky-500 hover:text-sky-300"
          >
            <Layers className="h-3.5 w-3.5" />
            <span className="hidden md:inline">.GLB</span>
          </button>

          {/* Tam Ekran Toggle Butonu */}
          <button
            type="button"
            onClick={() => setIsFullscreen((prev) => !prev)}
            className="flex items-center gap-1 rounded-lg border border-slate-700 bg-slate-800 p-1.5 text-slate-300 hover:bg-slate-700 hover:text-white transition"
            title={isFullscreen ? "Tam Ekrandan Çık (Esc / F)" : "Tam Ekran Görünüm (F)"}
          >
            {isFullscreen ? (
              <Minimize2 className="h-4 w-4" />
            ) : (
              <Maximize2 className="h-4 w-4" />
            )}
          </button>

          {/* Kısayol Yardım Butonu */}
          <button
            type="button"
            onClick={() => setShowHelpModal(true)}
            className="flex items-center rounded-lg border border-slate-700 bg-slate-800 p-1.5 text-slate-400 hover:text-white transition"
            title="Klavye Kısayolları (?)"
          >
            <HelpCircle className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Three.js Sahnesi */}
      <div className="relative flex-1">
        <Canvas
          shadows
          camera={{ position: [cameraDist * 0.7, 1.6, cameraDist], fov: 42 }}
          onPointerMissed={() => onSelectPart(null)}
        >
          <CameraController
            view={cameraView}
            cameraDist={cameraDist}
            controlsRef={controlsRef}
          />
          <color attach="background" args={["#090D16"]} />
          <ambientLight intensity={xrayMode ? 1.0 : 0.75} />
          <directionalLight
            position={[3, 5, 4]}
            intensity={1.2}
            castShadow
            shadow-mapSize={[1024, 1024]}
          />
          <directionalLight position={[-3, 2, -2]} intensity={0.45} />

          <group position={[0, -cabinetCenterY, 0]}>
            {bom.parts.map((part) => (
              <PanelMesh3D
                key={part.part_id}
                part={part}
                config={bom.config}
                cabinetCenterY={cabinetCenterY}
                isOpen={openPartIds.has(part.part_id)}
                explodeFactor={explodeFactor}
                wireframe={wireframe}
                xrayMode={xrayMode}
                isSelected={part.part_id === selectedPartId}
                onSelect={() => onSelectPart(part.part_id)}
                onToggleOpen={() => toggleIndividualPart(part.part_id)}
              />
            ))}

            <ContactShadows
              position={[0, -0.005, 0]}
              opacity={0.5}
              scale={8}
              blur={2}
              far={3.0}
            />
            <Grid
              position={[0, -0.01, 0]}
              args={[8, 8]}
              cellSize={0.2}
              cellThickness={0.6}
              cellColor="#1e293b"
              sectionSize={1}
              sectionThickness={1.2}
              sectionColor="#334155"
              fadeDistance={10}
            />
          </group>

          <OrbitControls
            ref={controlsRef}
            makeDefault
            minPolarAngle={0.1}
            maxPolarAngle={Math.PI / 2 + 0.15}
            enableDamping
          />
        </Canvas>

        {/* Röntgen Modu Renk Rehberi (X-Ray Legend) */}
        {xrayMode && (
          <div className="absolute top-3 left-3 z-10 hidden sm:flex flex-col gap-1.5 rounded-lg border border-slate-700/80 bg-slate-900/90 p-2.5 text-[11px] shadow-xl backdrop-blur">
            <div className="flex items-center gap-1.5 font-semibold text-slate-200">
              <ScanLine className="h-3.5 w-3.5 text-amber-400" />
              <span>CNC Röntgen Renk Rehberi</span>
            </div>
            <div className="flex items-center gap-2 text-slate-300">
              <span className="h-2.5 w-2.5 shrink-0 rounded-full bg-amber-400 shadow-[0_0_6px_#f59e0b]" />
              <span>Lamello Cabineo Cebi (Ø15) / Vidası (Ø5)</span>
            </div>
            <div className="flex items-center gap-2 text-slate-300">
              <span className="h-2.5 w-2.5 shrink-0 rounded-full bg-cyan-400 shadow-[0_0_6px_#06b6d4]" />
              <span>Sistem 32 Raf Pimi Delikleri (Ø5)</span>
            </div>
            <div className="flex items-center gap-2 text-slate-300">
              <span className="h-2.5 w-2.5 shrink-0 rounded-full bg-emerald-400 shadow-[0_0_6px_#10b981]" />
              <span>Çekmece Rayı Montaj Delikleri (Ø5)</span>
            </div>
            <div className="flex items-center gap-2 text-slate-300">
              <span className="h-2.5 w-2.5 shrink-0 rounded-full bg-purple-400 shadow-[0_0_6px_#a855f7]" />
              <span>Tas Menteşe Yuvası (Ø35)</span>
            </div>
            <div className="flex items-center gap-2 text-slate-300">
              <span className="h-2.5 w-2.5 shrink-0 rounded-full bg-orange-400 shadow-[0_0_6px_#f97316]" />
              <span>Arkalık Montaj Kanalı (8×8.5 mm)</span>
            </div>
          </div>
        )}

        {/* Seçili Parça Bilgi Kartı */}
        {selectedPart && (
          <div className="
            absolute bottom-3 left-3 right-3 z-10 flex flex-wrap items-center justify-between gap-3
            rounded-lg border border-sky-500/40 bg-slate-900/95 px-4 py-2.5 text-xs shadow-xl backdrop-blur
          ">
            <div>
              <span className="font-bold text-sky-400">
                {selectedPart.part_id} — {selectedPart.name} ({selectedPart.code})
              </span>
              <p className="mt-0.5 text-slate-300">
                Net: <strong>{selectedPart.net_length_mm} × {selectedPart.net_width_mm} mm</strong> |{" "}
                Kesim (PVC Düşülmüş):{" "}
                <strong className="text-emerald-300">
                  {selectedPart.cut_length_mm} × {selectedPart.cut_width_mm} mm
                </strong>{" "}
                | Kalınlık: {selectedPart.thickness_mm} mm
                {selectedPart.notch_info && (
                  <span className="ml-2 rounded bg-amber-500/20 px-1.5 py-0.5 text-amber-300 font-semibold">
                    {selectedPart.notch_info}
                  </span>
                )}
              </p>
            </div>
            <div className="flex items-center gap-3 text-slate-300">
              <span className="rounded bg-slate-800 px-2 py-1">
                CNC Delik: <strong>{selectedPart.drills.length}</strong>
              </span>
              <span className="rounded bg-slate-800 px-2 py-1">
                Kanal: <strong>{selectedPart.grooves.length}</strong>
              </span>
              {(selectedPart.transform_3d.is_door || selectedPart.transform_3d.is_drawer) && (
                <button
                  type="button"
                  onClick={() => toggleIndividualPart(selectedPart.part_id)}
                  className="rounded bg-sky-600/80 hover:bg-sky-500 px-2.5 py-1 font-semibold text-white transition"
                >
                  {openPartIds.has(selectedPart.part_id) ? "Kapat" : "Aç"}
                </button>
              )}
            </div>
          </div>
        )}

        {/* 3D Klavye Kısayolları Modal */}
        {showHelpModal && (
          <div className="absolute inset-0 z-30 flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm">
            <div className="w-full max-w-sm rounded-2xl border border-slate-700 bg-slate-900 p-5 shadow-2xl">
              <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                <div className="flex items-center gap-2">
                  <HelpCircle className="h-4 w-4 text-sky-400" />
                  <h3 className="text-xs font-bold uppercase tracking-wider text-slate-100">
                    3D CAD Klavye Kısayolları
                  </h3>
                </div>
                <button
                  type="button"
                  onClick={() => setShowHelpModal(false)}
                  className="rounded-lg p-1 text-slate-400 hover:text-white"
                >
                  <CloseIcon className="h-4 w-4" />
                </button>
              </div>

              <div className="mt-3 space-y-2 text-xs">
                <div className="flex items-center justify-between border-b border-slate-800/60 pb-1.5">
                  <span className="text-slate-300">Kapak &amp; Çekmeceleri Aç/Kapat</span>
                  <kbd className="rounded border border-slate-700 bg-slate-800 px-2 py-0.5 font-mono text-[11px] font-bold text-sky-300">
                    Space
                  </kbd>
                </div>
                <div className="flex items-center justify-between border-b border-slate-800/60 pb-1.5">
                  <span className="text-slate-300">CNC Röntgen (Delik/Cep) Modu</span>
                  <kbd className="rounded border border-slate-700 bg-slate-800 px-2 py-0.5 font-mono text-[11px] font-bold text-amber-300">
                    X
                  </kbd>
                </div>
                <div className="flex items-center justify-between border-b border-slate-800/60 pb-1.5">
                  <span className="text-slate-300">Patlatılmış Montaj (Exploded)</span>
                  <kbd className="rounded border border-slate-700 bg-slate-800 px-2 py-0.5 font-mono text-[11px] font-bold text-slate-200">
                    E
                  </kbd>
                </div>
                <div className="flex items-center justify-between border-b border-slate-800/60 pb-1.5">
                  <span className="text-slate-300">Tam Ekran Aç / Kapat</span>
                  <kbd className="rounded border border-slate-700 bg-slate-800 px-2 py-0.5 font-mono text-[11px] font-bold text-slate-200">
                    F
                  </kbd>
                </div>
                <div className="flex items-center justify-between border-b border-slate-800/60 pb-1.5">
                  <span className="text-slate-300">Kamera Açıları (İzo / Ön / Yan / Üst)</span>
                  <kbd className="rounded border border-slate-700 bg-slate-800 px-2 py-0.5 font-mono text-[11px] font-bold text-slate-200">
                    1 - 4
                  </kbd>
                </div>
                <div className="flex items-center justify-between pt-1">
                  <span className="text-slate-300">Bu Yardım Penceresi</span>
                  <kbd className="rounded border border-slate-700 bg-slate-800 px-2 py-0.5 font-mono text-[11px] font-bold text-slate-200">
                    ?
                  </kbd>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setShowHelpModal(false)}
                className="mt-4 w-full rounded-xl bg-sky-600 py-2 text-xs font-bold text-white hover:bg-sky-500 transition"
              >
                Anladım
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
