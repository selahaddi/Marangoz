import { useEffect, useMemo, useState } from "react";
import {
  Bath,
  Bed,
  Boxes,
  Briefcase,
  Copy,
  Plus,
  Search,
  Tv,
  UtensilsCrossed,
  X,
} from "lucide-react";
import type { CabinetConfig } from "../types/cabinet";

export interface ModuleTemplateItem {
  id: string;
  category: "kitchen" | "bedroom" | "bathroom" | "living" | "hallway_office" | "custom";
  categoryLabel: string;
  title: string;
  dimensions: string;
  description: string;
  highlights: string[];
  config: Partial<CabinetConfig>;
}

interface AddModuleModalProps {
  isOpen: boolean;
  onClose: () => void;
  activeModule: CabinetConfig;
  activeModuleIndex: number;
  onSelectOption: (optionConfig: Partial<CabinetConfig>) => void;
}

export function AddModuleModal({
  isOpen,
  onClose,
  activeModule,
  activeModuleIndex,
  onSelectOption,
}: AddModuleModalProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string>("all");

  // ESC tuşu ile modalı kapatma
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  // Hazır Modül / Ürün Şablonları Listesi
  const templateItems: ModuleTemplateItem[] = useMemo(() => {
    return [
      // 1. MUTFAK MODÜLLERİ
      {
        id: "kitchen_drawer_base_60",
        category: "kitchen",
        categoryLabel: "Mutfak",
        title: "3 Çekmeceli Kaşıklık & Tencere Alt Dolabı",
        dimensions: "600 × 820 × 560 mm",
        description: "500 mm frenli teleskopik raylı 3 tam boy çekmece kasası (Ray boşluğu 26 mm).",
        highlights: ["3 Çekmece", "100mm Baza", "500mm Ray", "Kapaksız"],
        config: {
          name: "3 Çekmeceli Mutfak Alt Dolabı",
          cabinet_type: "kitchen_base",
          width_mm: 600,
          height_mm: 820,
          depth_mm: 560,
          shelf_count: 0,
          door_type: "none",
          drawer_count: 3,
          drawer_front_height_mm: 180,
          has_plinth: true,
          plinth_height_mm: 100,
          plinth_type: "adjustable_legs",
        },
      },
      {
        id: "kitchen_sink_base_80",
        category: "kitchen",
        categoryLabel: "Mutfak",
        title: "Çift Kapaklı Mutfak Evye / Tezgah Alt Dolabı",
        dimensions: "800 × 820 × 560 mm",
        description: "10 cm ayarlı bazalı, çift kapaklı, 1 hareketli raflı standart tezgah altı modülü.",
        highlights: ["Çift Kapak", "1 Hareketli Raf", "100mm Baza", "Menteşe Ø35mm"],
        config: {
          name: "Çift Kapaklı Mutfak Alt Dolabı",
          cabinet_type: "kitchen_base",
          width_mm: 800,
          height_mm: 820,
          depth_mm: 560,
          shelf_count: 1,
          door_type: "double",
          drawer_count: 0,
          has_plinth: true,
          plinth_height_mm: 100,
          plinth_type: "adjustable_legs",
        },
      },
      {
        id: "kitchen_single_base_45",
        category: "kitchen",
        categoryLabel: "Mutfak",
        title: "Tek Kapaklı Dar Mutfak Alt Dolabı",
        dimensions: "450 × 820 × 560 mm",
        description: "Tek sol menteşe kapaklı, 1 raflı dar mutfak tezgah altı depolama modülü.",
        highlights: ["Tek Kapak (Sol)", "1 Hareketli Raf", "100mm Baza"],
        config: {
          name: "Tek Kapaklı Mutfak Alt Dolabı",
          cabinet_type: "kitchen_base",
          width_mm: 450,
          height_mm: 820,
          depth_mm: 560,
          shelf_count: 1,
          door_type: "single_left",
          drawer_count: 0,
          has_plinth: true,
          plinth_height_mm: 100,
          plinth_type: "adjustable_legs",
        },
      },
      {
        id: "kitchen_wall_double_80",
        category: "kitchen",
        categoryLabel: "Mutfak",
        title: "Çift Kapaklı Mutfak Üst Duvar Dolabı",
        dimensions: "800 × 720 × 350 mm",
        description: "Bazasız, 2 hareketli raflı, çift menteşeli standart mutfak üst dolabı.",
        highlights: ["Çift Kapak", "2 Hareketli Raf", "Bazasız Duvar Tipi", "350mm Derinlik"],
        config: {
          name: "Çift Kapaklı Mutfak Üst Dolabı",
          cabinet_type: "kitchen_wall",
          width_mm: 800,
          height_mm: 720,
          depth_mm: 350,
          shelf_count: 2,
          door_type: "double",
          drawer_count: 0,
          has_plinth: false,
          plinth_height_mm: 0,
        },
      },
      {
        id: "kitchen_wall_flap_80",
        category: "kitchen",
        categoryLabel: "Mutfak",
        title: "Gazlı Pistonlu Kalkar Kapaklı Mutfak Üst Dolabı",
        dimensions: "800 × 720 × 350 mm",
        description: "Yukarı doğru açılan tek parça kalkar kapaklı modern üst modül.",
        highlights: ["Kalkar Kapak (Gazlı Piston)", "1 Hareketli Raf", "Bazasız Duvar Tipi"],
        config: {
          name: "Kalkar Kapaklı Mutfak Üst Dolabı",
          cabinet_type: "kitchen_wall",
          width_mm: 800,
          height_mm: 720,
          depth_mm: 350,
          shelf_count: 1,
          door_type: "flap_up",
          drawer_count: 0,
          has_plinth: false,
          plinth_height_mm: 0,
        },
      },
      {
        id: "kitchen_tall_pantry_60",
        category: "kitchen",
        categoryLabel: "Mutfak",
        title: "Mutfak Boy Kiler & Ankastre Kule Dolabı",
        dimensions: "600 × 2100 × 580 mm",
        description: "Altta 2 çekmece, üstte çift kapaklı ve 4 raflı tam boy mutfak kiler kulesi.",
        highlights: ["2 Çekmece", "Çift Kapak", "4 Raf", "2100mm Boy Kule"],
        config: {
          name: "Mutfak Boy Kiler Kulesi",
          cabinet_type: "kitchen_tall",
          width_mm: 600,
          height_mm: 2100,
          depth_mm: 580,
          shelf_count: 4,
          door_type: "double",
          drawer_count: 2,
          drawer_front_height_mm: 180,
          has_plinth: true,
          plinth_height_mm: 100,
          plinth_type: "adjustable_legs",
        },
      },
      {
        id: "kitchen_fridge_enclosure",
        category: "kitchen",
        categoryLabel: "Mutfak",
        title: "Solo Buzdolabı Çevreleme & Kalkar Üst Dolap",
        dimensions: "850 × 2350 × 650 mm",
        description: "Alt kısımda 185 cm buzdolabı nişi (açık/arkalıksız), üstte kalkar kapaklı derin depolama.",
        highlights: ["1850mm Açık Niş", "Kalkar Kapak", "Derin Gövde 650mm"],
        config: {
          name: "Buzdolabı Çevreleme & Üst Dolap",
          cabinet_type: "kitchen_tall",
          width_mm: 850,
          height_mm: 2350,
          depth_mm: 650,
          shelf_count: 0,
          door_type: "flap_up",
          drawer_count: 0,
          appliance_niche_height_mm: 1850,
          has_plinth: false,
          plinth_height_mm: 0,
        },
      },

      // 2. YATAK ODASI & GARDIROP
      {
        id: "bedroom_wardrobe_90",
        category: "bedroom",
        categoryLabel: "Yatak Odası",
        title: "2 Çekmeceli & Çift Kapaklı Gardırop Modülü",
        dimensions: "900 × 2100 × 580 mm",
        description: "Altta 2 derin çekmece, üstte çift kapak ve 3 hareketli raflı standart gardırop.",
        highlights: ["2 Çekmece", "Çift Kapak", "3 Raf", "80mm Ahşap Baza"],
        config: {
          name: "Çift Kapaklı & Çekmeceli Gardırop",
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
          plinth_type: "wood_plinth",
        },
      },
      {
        id: "bedroom_tall_linen_60",
        category: "bedroom",
        categoryLabel: "Yatak Odası",
        title: "Tek Kapaklı Yekpare Yüklük / Elbise Dolabı",
        dimensions: "600 × 2400 × 600 mm",
        description: "Tavandan tabana inen, 5 raflı tek kapaklı derin elbise ve nevresim dolabı.",
        highlights: ["Tek Kapak (Sağ)", "5 Hareketli Raf", "2400mm Yüksek Boy"],
        config: {
          name: "Tek Kapaklı Yüklük Modülü",
          cabinet_type: "wardrobe",
          width_mm: 600,
          height_mm: 2400,
          depth_mm: 600,
          shelf_count: 5,
          door_type: "single_right",
          drawer_count: 0,
          has_plinth: true,
          plinth_height_mm: 80,
          plinth_type: "wood_plinth",
        },
      },
      {
        id: "bedroom_dresser_4drawer_90",
        category: "bedroom",
        categoryLabel: "Yatak Odası",
        title: "4 Çekmeceli Yatak Odası Şifonyeri",
        dimensions: "900 × 860 × 480 mm",
        description: "Kapaksız, 4 tam boy teleskopik raylı çekmeceli geniş yatak odası şifonyeri.",
        highlights: ["4 Çekmece Kasası", "Kapaksız", "80mm Ahşap Baza"],
        config: {
          name: "4 Çekmeceli Şifonyer",
          cabinet_type: "dresser",
          width_mm: 900,
          height_mm: 860,
          depth_mm: 480,
          shelf_count: 0,
          door_type: "none",
          drawer_count: 4,
          drawer_front_height_mm: 180,
          has_plinth: true,
          plinth_height_mm: 80,
          plinth_type: "wood_plinth",
        },
      },
      {
        id: "bedroom_nightstand_50",
        category: "bedroom",
        categoryLabel: "Yatak Odası",
        title: "2 Çekmeceli Yatak Başı Komodini",
        dimensions: "500 × 520 × 450 mm",
        description: "Kompakt, 2 çekmeceli yatak yanı komodin ünitesi.",
        highlights: ["2 Çekmece", "50mm Baza", "Kompakt 500mm"],
        config: {
          name: "2 Çekmeceli Komodin",
          cabinet_type: "dresser",
          width_mm: 500,
          height_mm: 520,
          depth_mm: 450,
          shelf_count: 0,
          door_type: "none",
          drawer_count: 2,
          drawer_front_height_mm: 180,
          has_plinth: true,
          plinth_height_mm: 50,
          plinth_type: "wood_plinth",
        },
      },

      // 3. BANYO & ÇAMAŞIR
      {
        id: "bathroom_vanity_2drawer_80",
        category: "bathroom",
        categoryLabel: "Banyo & Çamaşır",
        title: "2 Derin Çekmeceli Asma Banyo Lavabo Altı Dolabı",
        dimensions: "800 × 650 × 480 mm",
        description: "Asma bazasız tip, 2 derin çekmeceli modern banyo lavabo altı konsolu.",
        highlights: ["2 Derin Çekmece", "Bazasız Asma", "MDF-Lam Gövde"],
        config: {
          name: "Asma Banyo Lavabo Dolabı",
          cabinet_type: "bathroom_vanity",
          width_mm: 800,
          height_mm: 650,
          depth_mm: 480,
          shelf_count: 0,
          door_type: "none",
          drawer_count: 2,
          drawer_front_height_mm: 200,
          has_plinth: false,
          plinth_height_mm: 0,
        },
      },
      {
        id: "bathroom_tall_45",
        category: "bathroom",
        categoryLabel: "Banyo & Çamaşır",
        title: "Çekmeceli & Tek Kapaklı Banyo Boy Kulesi",
        dimensions: "450 × 1800 × 380 mm",
        description: "Altta 1 çekmece, üstte tek kapaklı ve 3 raflı havlu ve banyo gereçleri kulesi.",
        highlights: ["1 Çekmece", "Tek Kapak", "3 Raf", "80mm Ayak/Baza"],
        config: {
          name: "Banyo Boy Dolap Kulesi",
          cabinet_type: "bathroom_tall",
          width_mm: 450,
          height_mm: 1800,
          depth_mm: 380,
          shelf_count: 3,
          door_type: "single_left",
          drawer_count: 1,
          drawer_front_height_mm: 180,
          has_plinth: true,
          plinth_height_mm: 80,
          plinth_type: "wood_plinth",
        },
      },
      {
        id: "bathroom_washing_machine_tower",
        category: "bathroom",
        categoryLabel: "Banyo & Çamaşır",
        title: "Çamaşır Makinesi Üstü Dolap Kulesi",
        dimensions: "700 × 2200 × 650 mm",
        description: "Alt 90 cm çamaşır makinesi nişi (açık), üstte çift kapaklı ve 2 raflı deterjan dolabı.",
        highlights: ["900mm Açık Makine Nişi", "Çift Kapak", "2 Raf", "Bazasız"],
        config: {
          name: "Çamaşır Makinesi Üstü Dolabı",
          cabinet_type: "bathroom_tall",
          width_mm: 700,
          height_mm: 2200,
          depth_mm: 650,
          shelf_count: 2,
          door_type: "double",
          drawer_count: 0,
          appliance_niche_height_mm: 900,
          has_plinth: false,
          plinth_height_mm: 0,
        },
      },

      // 4. SALON, TV & KİTAPLIK
      {
        id: "living_tv_console_180",
        category: "living",
        categoryLabel: "Salon & TV",
        title: "2 Çekmeceli & Çift Kapaklı Geniş TV Medya Konsolu",
        dimensions: "1800 × 520 × 420 mm",
        description: "Geniş salon TV alt sehpası, ortada 2 çekmece, yanlarda çift kapaklı depolama.",
        highlights: ["1800mm Geniş", "2 Çekmece", "Çift Kapak", "50mm Baza"],
        config: {
          name: "Geniş TV Medya Konsolu",
          cabinet_type: "tv_unit",
          width_mm: 1800,
          height_mm: 520,
          depth_mm: 420,
          shelf_count: 1,
          door_type: "double",
          drawer_count: 2,
          drawer_front_height_mm: 160,
          has_plinth: true,
          plinth_height_mm: 50,
          plinth_type: "wood_plinth",
        },
      },
      {
        id: "living_bookshelf_5shelf_80",
        category: "living",
        categoryLabel: "Salon & TV",
        title: "5 Raflı Açık Salon & Çalışma Odası Kitaplığı",
        dimensions: "800 × 1950 × 350 mm",
        description: "Kapaksız, 5 hareketli raflı, yüksek taşıma kapasiteli açık kitaplık ve dekor ünitesi.",
        highlights: ["5 Hareketli Raf", "Kapaksız Açık Raf", "80mm Baza"],
        config: {
          name: "5 Raflı Açık Kitaplık",
          cabinet_type: "bookshelf",
          width_mm: 800,
          height_mm: 1950,
          depth_mm: 350,
          shelf_count: 5,
          door_type: "none",
          drawer_count: 0,
          has_plinth: true,
          plinth_height_mm: 80,
          plinth_type: "wood_plinth",
        },
      },
      {
        id: "living_vitrine_tower_60",
        category: "living",
        categoryLabel: "Salon & TV",
        title: "Vitrin Kulesi (2 Çekmece + 4 Açık Raf)",
        dimensions: "600 × 1950 × 380 mm",
        description: "Altta 2 çekmece, üstte 4 açık sergileme raflı şık salon vitrini.",
        highlights: ["2 Çekmece", "4 Açık Raf", "Vitrin Tipi", "80mm Baza"],
        config: {
          name: "Vitrin Kulesi",
          cabinet_type: "bookshelf",
          width_mm: 600,
          height_mm: 1950,
          depth_mm: 380,
          shelf_count: 4,
          door_type: "none",
          drawer_count: 2,
          drawer_front_height_mm: 180,
          has_plinth: true,
          plinth_height_mm: 80,
          plinth_type: "wood_plinth",
        },
      },

      // 5. ANTRE & OFİS
      {
        id: "hallway_shoe_cabinet_90",
        category: "hallway_office",
        categoryLabel: "Antre & Ofis",
        title: "2 Çekmeceli & Çift Kapaklı Yüksek Ayakkabılık",
        dimensions: "900 × 1200 × 380 mm",
        description: "Üstte 2 anahtarlık çekmecesi, altta 3 raflı çift kapaklı ayakkabı dolabı.",
        highlights: ["2 Çekmece", "Çift Kapak", "3 Eğimli/Düz Raf", "80mm Baza"],
        config: {
          name: "Yüksek Ayakkabılık",
          cabinet_type: "shoe_cabinet",
          width_mm: 900,
          height_mm: 1200,
          depth_mm: 380,
          shelf_count: 3,
          door_type: "double",
          drawer_count: 2,
          drawer_front_height_mm: 160,
          has_plinth: true,
          plinth_height_mm: 80,
          plinth_type: "wood_plinth",
        },
      },
      {
        id: "hallway_bench_90",
        category: "hallway_office",
        categoryLabel: "Antre & Ofis",
        title: "Oturma Banklı & 2 Çekmeceli Antre Ayakkabılığı",
        dimensions: "900 × 550 × 400 mm",
        description: "Üstü oturma minderli alçak bank, altta 2 derin ayakkabı çekmecesi.",
        highlights: ["2 Derin Çekmece", "Alçak Oturma Boyu (550mm)", "Kapaksız"],
        config: {
          name: "Oturma Banklı Ayakkabılık",
          cabinet_type: "shoe_cabinet",
          width_mm: 900,
          height_mm: 550,
          depth_mm: 400,
          shelf_count: 0,
          door_type: "none",
          drawer_count: 2,
          drawer_front_height_mm: 200,
          has_plinth: true,
          plinth_height_mm: 60,
          plinth_type: "wood_plinth",
        },
      },
      {
        id: "office_archive_cabinet_80",
        category: "hallway_office",
        categoryLabel: "Antre & Ofis",
        title: "Çift Kapaklı & 4 Raflı Klasör Arşiv Dolabı",
        dimensions: "800 × 2000 × 400 mm",
        description: "Standart A4/A3 klasör aralığına uygun 4 raflı, çift kilitlenebilir kapaklı ofis dolabı.",
        highlights: ["Çift Kapak", "4 Klasör Rafı", "2000mm Yüksek Boy", "80mm Baza"],
        config: {
          name: "Ofis Klasör Arşiv Dolabı",
          cabinet_type: "wardrobe",
          width_mm: 800,
          height_mm: 2000,
          depth_mm: 400,
          shelf_count: 4,
          door_type: "double",
          drawer_count: 0,
          has_plinth: true,
          plinth_height_mm: 80,
          plinth_type: "wood_plinth",
        },
      },
      {
        id: "office_pedestal_keson_45",
        category: "hallway_office",
        categoryLabel: "Antre & Ofis",
        title: "3 Çekmeceli Masa Altı Ofis Keson Modülü",
        dimensions: "450 × 620 × 500 mm",
        description: "Masa altına sığacak 62 cm boyunda, 3 çekmeceli ofis keson ünitesi.",
        highlights: ["3 Çekmece", "Masa Altı Boyu (620mm)", "Kapaksız"],
        config: {
          name: "3 Çekmeceli Ofis Kesonu",
          cabinet_type: "dresser",
          width_mm: 450,
          height_mm: 620,
          depth_mm: 500,
          shelf_count: 0,
          door_type: "none",
          drawer_count: 3,
          drawer_front_height_mm: 160,
          has_plinth: true,
          plinth_height_mm: 40,
          plinth_type: "wood_plinth",
        },
      },
    ];
  }, []);

  // Filtreleme mantığı: Kategori + Arama Sorgusu
  const filteredTemplates = useMemo(() => {
    let result = templateItems;

    if (selectedCategory !== "all") {
      result = result.filter((item) => item.category === selectedCategory);
    }

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      result = result.filter(
        (item) =>
          item.title.toLowerCase().includes(q) ||
          item.description.toLowerCase().includes(q) ||
          item.dimensions.toLowerCase().includes(q) ||
          item.highlights.some((h) => h.toLowerCase().includes(q))
      );
    }

    return result;
  }, [templateItems, selectedCategory, searchQuery]);

  // Kategori Listesi ve Sayıları
  const categoryFilters = [
    { id: "all", label: "Tümü", count: templateItems.length },
    {
      id: "kitchen",
      label: "Mutfak",
      count: templateItems.filter((i) => i.category === "kitchen").length,
    },
    {
      id: "bedroom",
      label: "Yatak Odası",
      count: templateItems.filter((i) => i.category === "bedroom").length,
    },
    {
      id: "bathroom",
      label: "Banyo & Çamaşır",
      count: templateItems.filter((i) => i.category === "bathroom").length,
    },
    {
      id: "living",
      label: "Salon & TV",
      count: templateItems.filter((i) => i.category === "living").length,
    },
    {
      id: "hallway_office",
      label: "Antre & Ofis",
      count: templateItems.filter((i) => i.category === "hallway_office").length,
    },
  ];

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-slate-950/80 backdrop-blur-md animate-in fade-in duration-150">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="add-module-modal-title"
        className="relative flex flex-col w-full max-w-3xl max-h-[90vh] rounded-2xl border border-slate-800 bg-slate-900 shadow-2xl text-slate-100 overflow-hidden"
      >
        {/* Modal Başlığı */}
        <div className="flex items-center justify-between border-b border-slate-800 px-5 py-4 bg-slate-950/70">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-indigo-600/20 text-indigo-400 border border-indigo-500/30">
              <Plus className="h-5 w-5" />
            </div>
            <div>
              <h2
                id="add-module-modal-title"
                className="text-sm sm:text-base font-bold text-white tracking-tight"
              >
                Hatta Eklenecek Modülü / Ürünü Seçin
              </h2>
              <p className="text-xs text-slate-400">
                Seçtiğiniz ürün, mevcut dolabınızın hemen sağına yeni bir modül olarak eklenecektir.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl p-2 text-slate-400 hover:bg-slate-800 hover:text-white transition"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Arama Çubuğu ve Kategori Filtreleri */}
        <div className="border-b border-slate-800 bg-slate-950/40 p-4 space-y-3">
          {/* Arama Girişi */}
          <div className="relative">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <input
              type="text"
              autoFocus
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Modül veya özellik ara (örn: çekmece, evye, üst dolap, gardırop, banyo...)"
              className="w-full rounded-xl border border-slate-700 bg-slate-950 pl-10 pr-10 py-2.5 text-xs sm:text-sm text-slate-100 placeholder-slate-500 focus:border-indigo-500 focus:outline-none shadow-inner"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery("")}
                className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full p-1 text-slate-400 hover:text-white"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>

          {/* Kategori Butonları */}
          <div className="flex flex-wrap items-center gap-1.5">
            {categoryFilters.map((cat) => {
              const isSelected = selectedCategory === cat.id;
              return (
                <button
                  key={cat.id}
                  type="button"
                  onClick={() => setSelectedCategory(cat.id)}
                  className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
                    isSelected
                      ? "bg-indigo-600 text-white shadow-md shadow-indigo-600/30"
                      : "bg-slate-950 text-slate-300 border border-slate-800 hover:border-slate-700 hover:text-white"
                  }`}
                >
                  <span>{cat.label}</span>
                  <span
                    className={`rounded-full px-1.5 py-0.2 text-[10px] ${
                      isSelected
                        ? "bg-white/20 text-white"
                        : "bg-slate-800 text-slate-400"
                    }`}
                  >
                    {cat.count}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Modal Gövdesi: Hızlı Klon + Ürün Şablonları Listesi */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {/* Hızlı Eylem: Aktif Modülü Klonla */}
          {!searchQuery && selectedCategory === "all" && (
            <div
              onClick={() => onSelectOption(activeModule)}
              className="group flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3.5 rounded-xl border border-sky-500/40 bg-gradient-to-r from-sky-950/40 via-indigo-950/30 to-slate-900 hover:border-sky-400 hover:from-sky-950/60 transition cursor-pointer shadow-md"
            >
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-sky-600/20 text-sky-400 border border-sky-500/30 group-hover:bg-sky-600 group-hover:text-white transition">
                  <Copy className="h-5 w-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs sm:text-sm font-bold text-white">
                      Aktif Modülü Birebir Yanına Klonla (M{activeModuleIndex + 1})
                    </span>
                    <span className="rounded-full bg-sky-500/20 px-2 py-0.5 text-[10px] font-bold text-sky-300 border border-sky-500/30">
                      Hızlı Klon
                    </span>
                  </div>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Mevcut modülün tüm ölçüleri ({activeModule.width_mm}×{activeModule.height_mm}×{activeModule.depth_mm} mm), raf ({activeModule.shelf_count} adet) ve kapak/çekmece ayarlarıyla eşleşir.
                  </p>
                </div>
              </div>
              <button
                type="button"
                className="inline-flex items-center justify-center gap-1.5 shrink-0 rounded-xl bg-sky-600 px-3.5 py-1.5 text-xs font-bold text-white shadow-md shadow-sky-600/30 group-hover:bg-sky-500 transition"
              >
                <Plus className="h-3.5 w-3.5" />
                <span>Klonu Ekle</span>
              </button>
            </div>
          )}

          {/* Şablon Ürün Listesi */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
            {filteredTemplates.map((item) => {
              return (
                <div
                  key={item.id}
                  onClick={() => onSelectOption(item.config)}
                  className="group flex flex-col justify-between p-3.5 rounded-xl border border-slate-800 bg-slate-950/60 hover:border-indigo-500/50 hover:bg-slate-950 transition cursor-pointer shadow-sm hover:shadow-indigo-500/10"
                >
                  <div>
                    {/* Üst Kategori ve Ölçü Rozeti */}
                    <div className="flex items-center justify-between gap-2 mb-1.5">
                      <span className="text-[11px] font-semibold text-indigo-400 flex items-center gap-1">
                        {item.category === "kitchen" && <UtensilsCrossed className="h-3 w-3" />}
                        {item.category === "bedroom" && <Bed className="h-3 w-3" />}
                        {item.category === "bathroom" && <Bath className="h-3 w-3" />}
                        {item.category === "living" && <Tv className="h-3 w-3" />}
                        {item.category === "hallway_office" && <Briefcase className="h-3 w-3" />}
                        {item.categoryLabel}
                      </span>
                      <span className="rounded-md bg-slate-800 px-2 py-0.5 font-mono text-[11px] font-bold text-slate-200 border border-slate-700">
                        {item.dimensions}
                      </span>
                    </div>

                    {/* Başlık */}
                    <h3 className="text-xs sm:text-sm font-bold text-white group-hover:text-indigo-300 transition line-clamp-1">
                      {item.title}
                    </h3>

                    {/* Açıklama */}
                    <p className="text-xs text-slate-400 mt-1 line-clamp-2 leading-relaxed">
                      {item.description}
                    </p>

                    {/* Öne Çıkan Özellik Rozetleri */}
                    <div className="mt-2 flex flex-wrap gap-1">
                      {item.highlights.map((h, idx) => (
                        <span
                          key={idx}
                          className="rounded bg-slate-900 px-1.5 py-0.5 text-[10px] text-slate-300 border border-slate-800"
                        >
                          {h}
                        </span>
                      ))}
                    </div>
                  </div>

                  {/* Alt Ekleme Butonu */}
                  <div className="mt-3.5 pt-2 border-t border-slate-800/80 flex items-center justify-between">
                    <span className="text-[11px] text-slate-500 font-medium">
                      Modül olarak hatta ekle
                    </span>
                    <button
                      type="button"
                      className="inline-flex items-center gap-1 rounded-lg bg-indigo-600/20 px-2.5 py-1 text-xs font-bold text-indigo-300 border border-indigo-500/30 group-hover:bg-indigo-600 group-hover:text-white transition"
                    >
                      <Plus className="h-3.5 w-3.5" />
                      <span>Hatta Ekle</span>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>

          {filteredTemplates.length === 0 && (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <Boxes className="h-10 w-10 text-slate-600 mb-2" />
              <p className="text-sm font-semibold text-slate-400">
                "{searchQuery}" aramasıyla eşleşen ürün bulunamadı.
              </p>
              <button
                type="button"
                onClick={() => {
                  setSearchQuery("");
                  setSelectedCategory("all");
                }}
                className="mt-2 text-xs font-semibold text-indigo-400 hover:underline"
              >
                Filtreleri temizle
              </button>
            </div>
          )}
        </div>

        {/* Modal Alt Çubuğu */}
        <div className="flex items-center justify-between border-t border-slate-800 px-5 py-3 bg-slate-950/70 text-xs text-slate-400">
          <span>Toplam {templateItems.length} hazır ürün ve modül şablonu</span>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-slate-700 bg-slate-800 px-3.5 py-1.5 font-semibold text-slate-300 hover:bg-slate-700 transition"
          >
            Vazgeç
          </button>
        </div>
      </div>
    </div>
  );
}
