import { useState } from "react";
import { Canvas } from "@react-three/fiber";
import { ContactShadows, Edges, Grid, Html, OrbitControls } from "@react-three/drei";
import { Box, DoorOpen, Expand, Eye, Layers } from "lucide-react";
import type { BOMReport, PanelPart } from "../types/cabinet";

interface CabinetViewer3DProps {
  bom: BOMReport;
  glbBase64: string;
  selectedPartId: string | null;
  onSelectPart: (partId: string | null) => void;
}

interface PanelMeshProps {
  part: PanelPart;
  cabinetCenterY: number;
  doorsOpen: boolean;
  explodeFactor: number;
  wireframe: boolean;
  isSelected: boolean;
  onSelect: () => void;
}

function PanelMesh3D({
  part,
  cabinetCenterY,
  doorsOpen,
  explodeFactor,
  wireframe,
  isSelected,
  onSelect,
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

  // Çekmece parçası ise kapak/çekmece açıldığında +280 mm öne doğru teleskopik ray hareketi
  const drawerSlideZ = t3d.is_drawer && doorsOpen ? 0.28 : 0.0;

  const cx = baseCx + explodeX;
  const cy = baseCy + explodeY;
  const cz = baseCz + explodeZ + drawerSlideZ;

  const displayColor = isSelected
    ? "#38BDF8"
    : hovered
    ? "#7DD3FC"
    : t3d.color_hex;

  // Kapak ise menteşe ekseni etrafında gerçekçi açılma dönüşü uygula
  if (t3d.is_door) {
    const isLeftHinge = t3d.hinge_side === "left";
    const pivotX = isLeftHinge ? cx - sx / 2.0 : cx + sx / 2.0;
    const offsetX = isLeftHinge ? sx / 2.0 : -sx / 2.0;
    const openAngle = doorsOpen
      ? isLeftHinge
        ? -Math.PI * 0.58
        : Math.PI * 0.58
      : 0.0;

    return (
      <group position={[pivotX, cy, cz]} rotation={[0, openAngle, 0]}>
        <mesh
          position={[offsetX, 0, 0]}
          onClick={(e) => {
            e.stopPropagation();
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
            roughness={0.45}
            metalness={0.08}
            wireframe={wireframe}
          />
          <Edges threshold={15} color={isSelected ? "#0284C7" : "#334155"} />
        </mesh>
      </group>
    );
  }

  return (
    <mesh
      position={[cx, cy, cz]}
      onClick={(e) => {
        e.stopPropagation();
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
        roughness={0.55}
        metalness={0.05}
        wireframe={wireframe}
      />
      <Edges threshold={15} color={isSelected ? "#0284C7" : "#475569"} />
      {isSelected && (
        <Html position={[0, sy / 2 + 0.06, 0]} center distanceFactor={3.5}>
          <div className="pointer-events-none whitespace-nowrap rounded-md border border-sky-400/50 bg-slate-900/95 px-2.5 py-1 text-xs font-medium text-sky-200 shadow-lg">
            {part.part_id} {part.name} ({part.cut_length_mm}×{part.cut_width_mm} mm)
          </div>
        </Html>
      )}
    </mesh>
  );
}

export function CabinetViewer3D({
  bom,
  glbBase64,
  selectedPartId,
  onSelectPart,
}: CabinetViewer3DProps) {
  const [doorsOpen, setDoorsOpen] = useState<boolean>(false);
  const [explodeFactor, setExplodeFactor] = useState<number>(0);
  const [wireframe, setWireframe] = useState<boolean>(false);

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
    <div className="relative flex h-[560px] w-full flex-col overflow-hidden rounded-xl border border-slate-800 bg-slate-900/80">
      {/* Üst 3D Kontrol Çubuğu */}
      <div className="z-10 flex flex-wrap items-center justify-between gap-2 border-b border-slate-800 bg-slate-900/90 px-4 py-2.5 backdrop-blur">
        <div className="flex flex-wrap items-center gap-2">
          <Box className="h-4 w-4 text-sky-400" />
          <span className="text-xs font-semibold uppercase tracking-wider text-slate-300">
            Etkileşimli 3D CAD Önizleme (Toplam Hat: {totalWidthMm} ×{" "}
            {maxHeightMm} × {maxDepthMm} mm)
          </span>
          {allModules.length > 1 && (
            <span className="rounded-md border border-indigo-500/40 bg-indigo-500/15 px-2 py-0.5 text-[11px] font-semibold text-indigo-300">
              {allModules.length} Modüllü Oda Hattı
            </span>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {hasAnyDoorsOrDrawers && (
            <button
              type="button"
              onClick={() => setDoorsOpen((prev) => !prev)}
              className={`flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-xs font-medium transition ${
                doorsOpen
                  ? "border-sky-500 bg-sky-500/20 text-sky-300"
                  : "border-slate-700 bg-slate-800 text-slate-300 hover:bg-slate-700"
              }`}
            >
              <DoorOpen className="h-3.5 w-3.5" />
              {doorsOpen
                ? "Kapak & Çekmeceleri Kapat"
                : "Kapak & Çekmeceleri Aç"}
            </button>
          )}

          <button
            type="button"
            onClick={() => setExplodeFactor((prev) => (prev > 0 ? 0 : 1))}
            className={`flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-xs font-medium transition ${
              explodeFactor > 0
                ? "border-amber-500 bg-amber-500/20 text-amber-300"
                : "border-slate-700 bg-slate-800 text-slate-300 hover:bg-slate-700"
            }`}
          >
            <Expand className="h-3.5 w-3.5" />
            {explodeFactor > 0 ? "Normal Montaj" : "Patlatılmış Görünüm"}
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
            Tel Kafes
          </button>

          <button
            type="button"
            onClick={handleDownloadGlb}
            className="flex items-center gap-1.5 rounded-lg border border-slate-700 bg-slate-800 px-2.5 py-1 text-xs font-medium text-slate-200 transition hover:border-sky-500 hover:text-sky-300"
          >
            <Layers className="h-3.5 w-3.5" />
            .GLB İndir
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
          <color attach="background" args={["#090D16"]} />
          <ambientLight intensity={0.75} />
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
                cabinetCenterY={cabinetCenterY}
                doorsOpen={doorsOpen}
                explodeFactor={explodeFactor}
                wireframe={wireframe}
                isSelected={part.part_id === selectedPartId}
                onSelect={() => onSelectPart(part.part_id)}
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
            makeDefault
            minPolarAngle={0.1}
            maxPolarAngle={Math.PI / 2 + 0.15}
            enableDamping
          />
        </Canvas>

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
              </p>
            </div>
            <div className="flex items-center gap-3 text-slate-300">
              <span className="rounded bg-slate-800 px-2 py-1">
                CNC Delik: <strong>{selectedPart.drills.length}</strong>
              </span>
              <span className="rounded bg-slate-800 px-2 py-1">
                Kanal: <strong>{selectedPart.grooves.length}</strong>
              </span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
