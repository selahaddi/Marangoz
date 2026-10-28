# Marangoz — Parametrik Mobilya CAD/CAM, CNC DXF & Nesting Platformu

> Doğal dilden (veya parametrik girdilerden) sıfır hata payıyla dolap tasarımı yapan, 3D önizleme sunan, fabrika standartlarında CNC delik planı (DXF R2010), plaka kesim optimizasyonu (Nesting SVG) ve malzeme listesi (BOM) üreten hafif ve web tabanlı mühendislik platformu.

---

## 🛠️ Temel Özellikler

* **Anti-Halüsinasyon Mühendislik İlkesi:** LLM yalnızca doğal dili anlamlandıran bir semantik ayrıştırıcıdır. Parça ölçüleri, toleranslar, delik koordinatları ve kesim optimizasyonları %100 deterministik Python ve CAD motorları tarafından matematiksel olarak hesaplanır.
* **Akıllı Doğal Dil Ayrıştırma (Semantic Parser):** *"210 cm boyunda, 90 cm eninde, 58 cm derinliğinde, 4 raflı, çift kapaklı gardırop"* gibi serbest metinlerden otomatik model parametreleri üretimi (Gemini API veya yerleşik çevrimdışı kural motoru).
* **3D Etkileşimli CAD Önizleme:** React Three Fiber (`@react-three/fiber`) ile tarayıcıda doğrudan 3D dolap görüntüleme, kapak açma/kapama animasyonu, patlatılmış montaj görünümü (exploded view), tel kafes ve binary `.glb` dışa aktarma.
* **Fabrika Üretim & CNC Kuralları:**
  * $18\text{ mm}$ gövde, $8\text{ mm}$ kanal içi geçme arkalık ($+15\text{ mm}$ binme payı) veya $3\text{ mm}$ çakma arkalık.
  * $0.4\text{ mm}$ PVC ihmali; $1.0\text{ mm}$ ve $2.0\text{ mm}$ PVC kenar bandı düşüm formülleri.
  * Sistem 32 delik eksenleri: Minifiks eksantrik gövde ($\varnothing 15\text{ mm}$), Minifiks mil ($\varnothing 8\text{ mm}$), kavela ($\varnothing 8\text{ mm}$), raf pimi ($\varnothing 5\text{ mm}$) ve tas menteşe ($\varnothing 35\text{ mm}$).
* **Endüstriyel CNC DXF (R2010):** `ezdxf` ile standart katmanlı (`OUTLINE_CUT`, `GROOVE_BACK_8MM`, `DRILL_MINIFIX_CAM_D15`, `DRILL_SHELF_PIN_D5`, vb.) CNC dosyaları üretimi.
* **Giyotin Plaka Kesim Optimizasyonu (Nesting):** `rectpack` ile standart $2800\times 2100\text{ mm}$ veya $3660\times 1830\text{ mm}$ plakalara $10\text{ mm}$ kenar temizlik payı ve $4.0\text{ mm}$ testere talaş payı (kerf) düşülerek 2D giyotin yerleşim, fire oranı ve SVG kesim şeması.
* **Tek Tıkla Üretim Paketi (.ZIP):** 3D GLB modeli, tüm parçaların DXF dosyaları, SVG kesim şemaları ve CSV/JSON BOM malzeme listesini içeren tam fabrika arşivi.

---

## 🏗️ Proje Mimarisi ve Teknoloji Yığını

```text
├── api/
│   └── index.py            # Vercel Serverless Function giriş noktası
├── apps/
│   ├── api/                # FastAPI Backend & Mühendislik Motorları
│   │   ├── app/
│   │   │   ├── core/       # Konfigürasyon ve fabrika üretim sabitleri
│   │   │   ├── schemas/    # Pydantic V2 veri modelleri
│   │   │   ├── engines/    # BOM, CAD (GLB), DXF (R2010), Nesting, NLP
│   │   │   └── routers/    # FastAPI uç noktaları
│   │   └── tests/          # pytest birim ve entegrasyon testleri
│   └── web/                # Vite + React (TypeScript) + TailwindCSS + Three.js
├── docs/                   # Mühendislik, mimari ve kural dokümantasyonu
├── vercel.json             # Vercel monorepo dağıtım konfigürasyonu
└── requirements.txt        # Python bağımlılıkları
```

---

## 🚀 Yerel Geliştirme (Local Development)

### 1. Backend'i Başlatma
```bash
# Sanal ortam oluşturup bağımlılıkları yükleyin
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt

# API sunucusunu çalıştırın
PYTHONPATH=apps/api uvicorn app.main:app --host 127.0.0.1 --port 8000 --reload
```

### 2. Frontend'i Başlatma
```bash
cd apps/web
npm install
npm run dev
```

Tarayıcınızda `http://localhost:5173` adresine giderek sistemi kullanabilirsiniz.

---

## 🌐 Vercel Dağıtımı (Deployment)

Proje kök dizinindeki `vercel.json` dosyası hem React frontend uygulamasını hem de Python serverless API fonksiyonlarını tek çatı altında dağıtmak üzere yapılandırılmıştır:

1. [Vercel Dashboard](https://vercel.com)'a giriş yapın ve **"Add New Project"** seçeneğini seçin.
2. `https://github.com/selahaddi/Marangoz` GitHub deposunu içe aktarın (Import).
3. Vercel proje ayarlarında:
   * **Root Directory:** `./` (Kök dizin)
   * **Build Command:** `cd apps/web && npm install && npm run build` (vercel.json tarafından otomatik yönetilir)
   * **Output Directory:** `apps/web/dist` (vercel.json tarafından otomatik yönetilir)
4. (İsteğe bağlı) Gemini API kullanmak isterseniz Environment Variables kısmına:
   * `GEMINI_API_KEY`: `AIzaSy...`
5. **Deploy** butonuna basarak yayına alın.

---

## 📄 Lisans
Bu proje MIT lisansı ile lisanslanmıştır.

