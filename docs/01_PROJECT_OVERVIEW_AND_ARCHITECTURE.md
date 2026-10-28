# 01. Proje Özeti ve Sistem Mimarisi

## 1. Proje Amacı
Mobilya fabrikaları için doğal dilden (veya eskiz görselinden) parametrik dolap tasarımı yapan, 3D önizleme sunan ve sıfır hata payıyla CNC delik planı (DXF), plaka kesim optimizasyonu (Nesting) ve malzeme listesi (BOM) üreten hafif, düşük maliyetli ve web tabanlı bir mühendislik platformudur.

## 2. Temel Mühendislik İlkesi (Anti-Halüsinasyon)
* **LLM'in Sınırı:** Büyük Dil Modelleri geometrik hesaplama yapamaz. LLM yalnızca bir "Doğal Dil Ayrıştırıcısı" (Semantic Parser) olarak görev yapar. Kullanıcının serbest metnini doğrulanmış bir JSON nesnesine (`CabinetConfig`) dönüştürür.
* **Deterministik Çekirdek:** Parça boyutları, PVC kenar bandı düşümleri, toleranslar, delik merkezleri ve fire hesapları %100 saf Python ve CAD motoru (`build123d` / `ezdxf` / `rectpack`) tarafından matematiksel olarak işletilir.

## 3. Teknoloji Yığını (Tech Stack)
* **Geliştirme Ortamı:** Google Antigravity / Linux / Python 3.11+
* **LLM & Vision:** Gemini 1.5 Flash / Gemini API (Düşük maliyet, yüksek hız, yerel JSON Schema desteği)
* **Backend Framework:** FastAPI (Uvicorn ile asenkron API)
* **Veri Doğrulama:** Pydantic V2
* **CAD / Geometri Motoru:** `build123d` / `trimesh` (OpenCASCADE çekirdekli parametrik katı modelleme ve GLB çıktısı)
* **CNC / Vektör Çıktı:** `ezdxf` (DXF R2010 katmanlı delik ve kanal çizimleri)
* **Kesim Optimizasyonu (Nesting):** `rectpack` (Giyotin tipi 2D bin-packing algoritması ve SVG kesim şeması)
* **Frontend:** Vite + React (TypeScript) + TailwindCSS + `@react-three/fiber` (Three.js 3D Web Görüntüleyici)

## 4. Uçtan Uca Veri Akış Hattı (Pipeline)

```text
[Kullanıcı İstemi / Referans Görsel]
         ↓
[Gemini 1.5 Flash (Strict JSON Schema)]
         ↓
  (CabinetConfig JSON)
         ↓
[Pydantic V2 Doğrulama Katmanı]
         ↓
[CabinetGeometryEngine (build123d)] ──> [GLB 3D Model] ──> Frontend 3D Önizleme
         ↓
[ProductionEngine (ezdxf)] ───────────> [DXF CNC Dosyaları & BOM (CSV/JSON)]
         ↓
[NestingEngine (rectpack)] ───────────> [Kesim Şeması (SVG) & Fire Oranı]
         ↓
[Zip Export / Üretim Paketi]
```

## 5. Dizin Yapısı (Project Directory Layout)

```text
├── apps/
│   ├── api/                        # FastAPI Backend & Mühendislik Motorları
│   │   ├── app/
│   │   │   ├── core/               # Konfigürasyon (.env) ve sabit kurallar
│   │   │   ├── schemas/            # Pydantic V2 veri modelleri (CabinetConfig, BOM, Nesting)
│   │   │   ├── engines/
│   │   │   │   ├── parser_engine.py      # Gemini 1.5 Flash doğal dil ayrıştırıcı
│   │   │   │   ├── bom_engine.py         # Parça, PVC düşümü ve delik koordinat motoru
│   │   │   │   ├── geometry_engine.py    # build123d 3D katı model ve GLB üretici
│   │   │   │   ├── dxf_engine.py         # ezdxf R2010 CNC katmanlı DXF üretici
│   │   │   │   └── nesting_engine.py     # rectpack 2D plaka kesim ve SVG üretici
│   │   │   ├── routers/            # API uç noktaları
│   │   │   └── main.py             # FastAPI uygulama girişi
│   │   └── tests/                  # Birim ve entegrasyon testleri
│   └── web/                        # Vite + React + TypeScript + R3F Frontend
│       ├── src/
│       │   ├── components/         # 3D Sahne, BOM Tablosu, Nesting Görünümü, Form
│       │   ├── types/              # TypeScript kesin tip tanımları
│       │   ├── services/           # API istemcisi
│       │   └── App.tsx
│       └── package.json
├── docs/                           # Mimari ve Üretim Kuralları Belgeleri
└── .env.example
```

## 6. API Sözleşmesi Standartları
Tüm API yanıtları standart JSON zarfında döner:
```json
{
  "success": true,
  "data": {},
  "error": null
}
```

