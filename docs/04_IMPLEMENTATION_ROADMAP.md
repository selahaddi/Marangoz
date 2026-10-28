# 04. Uygulama Yol Haritası (Implementation Roadmap)

## Faz 1: Altyapı, Veri Şemaları ve Deterministik BOM Çekirdeği
- [x] Ortam değişkenleri şablonunun (`.env.example`) ve proje dizin yapısının oluşturulması.
- [x] Pydantic V2 şemalarının (`CabinetConfig`, `PanelPart`, `DrillPoint`, `BOMReport`, `NestingResult`) tanımlanması.
- [x] Fabrika üretim kurallarını (18 mm gövde, 8 mm kanal içi arkalık, PVC düşüm matematiği, Sistem 32 delik koordinatları) işleten deterministik `BOMEngine` modülünün kodlanması.

## Faz 2: CAD (3D GLB), CNC (DXF R2010) ve Nesting (Kesim Optimizasyonu) Motorları
- [x] `CabinetGeometryEngine`: Parametrik dolap parçalarının 3D uzayda konumlandırılması ve `GLB` formatında dışa aktarılması.
- [x] `DXFProductionEngine` (`ezdxf`): Her parça için `OUTLINE_CUT`, `GROOVE_BACK_8MM`, `DRILL_MINIFIX_CAM_D15`, `DRILL_DOWEL_D8`, `DRILL_SHELF_PIN_D5`, `DRILL_HINGE_CUP_D35` katmanlarına sahip gerçek CNC DXF R2010 dosyalarının üretilmesi.
- [x] `NestingEngine` (`rectpack`): 2800×2100 mm (veya 3660×1830 mm) plakalara 4 mm testere payı (kerf) ve 10 mm kenar temizlik payı ile 2D giyotin yerleşim yapılması, fire oranının hesaplanması ve ölçekli `SVG` kesim şemasının üretilmesi.

## Faz 3: FastAPI Backend ve Doğal Dil Ayrıştırıcı (Gemini 1.5/2.5 Flash)
- [x] Doğal dil istemini ("210 cm yüksekliğinde, 90 cm genişliğinde, 58 cm derinliğinde, 4 raflı, çift kapaklı beyaz gardırop") `CabinetConfig` JSON şemasına çeviren `SemanticParserEngine` (Gemini API + kural tabanlı yerel ayrıştırıcı yedek mekanizması).
- [x] `/api/v1/healthz`, `/api/v1/parse`, `/api/v1/generate`, `/api/v1/jobs/{job_id}/download-zip` uç noktalarının standart JSON zarfıyla (`{success, data, error}`) kurulması.
- [x] Tek tıkla tüm üretim paketini (`cabinet_model.glb`, `kesim_ve_malzeme_listesi.csv`, `bom_report.json`, `nesting/*.svg`, `cnc_dxf/*.dxf`) içeren `.zip` arşivi indirme servisi.

## Faz 4: Frontend (React + TypeScript + TailwindCSS + Three.js) ve Testler
- [x] Doğal dil istemi + parametrik ince ayar kontrol paneli (Genişlik, Yükseklik, Derinlik, Raf Sayısı, Kapak Tipi, PVC Kalınlığı, Plaka Ebadı).
- [x] `@react-three/fiber` ve `@react-three/drei` ile etkileşimli 3D dolap görüntüleyici (kapak açma/kapama, patlatılmış görünüm / exploded view, tel kafes görünümü, parça seçimi).
- [x] Canlı BOM (Kesim & PVC & Hırdavat Listesi) tablosu, SVG Kesim Şeması (Nesting) görüntüleyici ve CNC DXF önizleme / ZIP üretim paketi indirme arayüzü.
- [x] Tüm hesaplama, DXF, Nesting ve API uç noktaları için kapsamlı birim ve entegrasyon testlerinin (`pytest`) çalıştırılıp doğrulanması.
