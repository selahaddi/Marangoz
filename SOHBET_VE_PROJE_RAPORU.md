# MARANGOZ CAD/CAM SİSTEMİ: KAPSAMLI SOHBET, İMALAT ENTEGRASYONU VE GELECEK YOL HARİTASI RAPORU

**Tarih:** 29 Ekim 2026  
**Proje:** Yapay Zekâ Destekli Parametrik Ahşap ve Panel Mobilya CAD/CAM Üretim Sistemi  
**Depo:** `/home/selahaddin/Belgeler/Marangoz` (Git: `origin main` — `6cddf8a`)  

---

## 1. BÖLÜM: SOHBETİN KRONOLOJİSİ VE ELE ALINAN KONULAR (KONUŞULANLAR)

Bu oturum boyunca sistemin mobilya atölyesi gerçekleriyle tam uyumlu hale getirilmesi, yapay zekâ entegrasyonu, model maliyetleri, mimari gereksinimler ve fabrika üretim paketleri adım adım tartışılmıştır:

### 1.1. Projenin Temel Amacı ve Değerlendirmesi
- Projenin bir "oyuncak 3D çizim aracı" değil, marangoz ve modüler mobilya üreticilerinin (Suntalam/MDF-Lam) doğrudan CNC tezgâhına (`.DXF`, ISO `.NC`, WoodWOP `.MPR`, Biesse `.CIX`) ve ebatlama testeresine gönderebileceği **endüstriyel bir üretim çekirdeği** olması hedeflendi.
- Doğal dilden ("prompt") parametrik kabin JSON şeması (`CabinetConfig`) üreten semantik ayrıştırıcı, BOM (Malzeme Listesi), PVC kenar bandı düşümleri, Sistem 32 delik şablonları ve 2D plaka nesting optimizasyonu ele alındı.

### 1.2. Yapay Zekâ, API Kullanımı, Model Deprecation ve Maliyetler
- **Doğal Dil / LLM Entegrasyonu:** Gemini API kullanımı değerlendirildi. `gemini-2.5-flash` gibi modellerin güncel durumu, `gemini-2.0-flash` ve `gemini-1.5-flash` modellerinin metin girdi maliyetleri incelendi (1 milyon token başına ~0.075$ – 0.10$ mertebesinde, yani kabin başına maliyet kuruşun kesirleri düzeyinde).
- **Eskiz / El Çizimi Fotoğrafı Ekleme Potansiyeli:** Atölye ustalarının veya iç mimarların kağıda çizdiği ölçülü rölöve krokilerinin fotoğrafını çekip sisteme yüklemesi senaryosu tartışıldı. Multimodal Vision modellerinin (Gemini 1.5/2.0 Flash) görüntü başına ~258 token (~0.00002$) harcadığı, dolayısıyla operasyonel maliyetin neredeyse sıfır olduğu ancak doğru prompt şablonu ve JSON çıktı kısıtı gerektirdiği belirlendi. Kullanıcı bu adımı ileriki aşamaya bırakmayı tercih etti.
- **Kesintisiz Çok Katmanlı Ayrıştırma Mimarisi:** API kesilse dahi sistemin durmaması için 4 katmanlı hibrit mimari kuruldu:
  1. Yerel FastAPI Python Backend (`/api/v1/parse`)
  2. Vercel Serverless Function (`/api/parse` — sunucu ortam değişkeniyle)
  3. Kullanıcının tarayıcısında saklanan kişisel Gemini API anahtarı
  4. Çevrimdışı Deterministik Kural Motoru (Offline Deterministic Regex Engine)

### 1.3. Buzdolabı Çevreleme (Gömme) Modülü Testi ve Hata Ayıklama
- Kullanıcının ilettiği gerçek atölye senaryosu test edildi:
  > *"Mutfakta solo buzdolabımızın etrafını saracak bir buzdolabı çevreleme (gömme) dolap modülü tasarlamak istiyorum. Yükseklik 235 cm, genişlik 85 cm, derinlik 65 cm olsun. Alt kısımda 80 cm genişliğinde ve 185 cm yüksekliğinde açık niş bırakılsın, arkalık konmasın. Üstte gazlı pistonlu tek parça kalkar kapaklı depolama dolabı olsun..."*
- Yapılan testlerde buzdolabı niş boşluğunun tespit edilmesi, alt bölgeye arkalık konmaması, üst kalkar kapak için 100N gazlı piston ve tas menteşe deliklerinin açılması, baza sıfırlama kuralları doğrulandı.

### 1.4. Kategorize Üretim Kataloğu İhtiyacı
- Sitede üretilebilecek tüm mobilyaların tekil modüller ve çoklu modül oda hatları halinde kategorize edilmesi kararlaştırıldı: 6 Ana Mobilya & Oda Kategorisi altında 29 hazır fabrika üretim şablonu oluşturuldu.

### 1.5. Atölye ve Saha Raporunun (`rapor.txt`) Masaya Yatırılması
- İncelenen raporda (*Ahşap ve Panel Mobilya İmalatında Yapay Zekâ Destekli Parametrik CAD/CAM Sistem Gereksinimleri ve Atölye İhtiyaç Analizi*), Türkiye ve Avrupa'daki panel mobilya atölyelerinin yaşadığı 5 büyük darboğaz tespit edildi ve kullanıcının onayıyla **"5 Paketi Entegre Edelim"** kararı alındı.

---

## 2. BÖLÜM: YAPILANLAR (MÜHENDİSLİK VE KODLAMA ENTEGRASYONLARI)

Bu oturumda geliştirilen ve hem backend (Python FastAPI) hem de frontend (React/TypeScript/Vite) tarafında tamamlanan teknik geliştirmeler:

### 2.1. Kategorize 29 Şablonlu Üretim Kataloğu
- **6 Kategori:** Mutfak & Ankastre, Yatak Odası & Gardırop, Banyo & Çamaşır Odası, Salon/TV/Kitaplık, Antre/Vestiyer, Ofis/Arşiv.
- **Çoklu Modül Hatları:** Ortak plaka nesting'i yapan 2'li ve 3'lü hatlar (örn. 280 cm Salon Duvar Hattı, 180 cm Antre Vestiyer Hattı, 200 cm Komple Mutfak Alt Hattı).
- Modern web standartlarına tam uyum (`hidden="until-found"` ve `beforematch` desteği ile sayfa içi Ctrl+F aramalarında kapalı akordeonların otomatik açılması).

### 2.2. Paket A — Lamello Cabineo 12 & Biesse `.CIX` Post-Processor
- **Saf Z-Ekseni 3-Eksen CNC İşleme:**
  - `fastener_type`: `"minifix_dowel"` vs `"cabineo_12"`.
  - Minifiks yatay delikleri ve kavelalar tamamen iptal edildi.
  - Tablalara üstten Z ekseninde $\varnothing 15\text{ mm}$, $10.8\text{ mm}$ derinliğinde Cabineo cebi (`LAYER_CABINEO_POCKET_Z108`), dikmelere ise $\varnothing 5\text{ mm}$, $12\text{ mm}$ derinliğinde dikey vida deliği (`DRILL_CABINEO_SCREW_D5`) işlendi.
  - Malzeme listesine `HRD-CBN-12` eklendi.
- **Biesse bSolid / BiesseWorks `.CIX` Post-Processor:**
  - `cnc_post_engine.py` ve `clientEngine.ts` içine `.CIX` makro derleyicisi entegre edildi (`BEGIN ID CID3`, `MAINDATA`, `ROUTG`, `BG`).
  - Arayüzde `.DXF`, ISO `.NC`, WoodWOP `.MPR` yanına **Biesse (.CIX)** indirme butonu ve canlı kod önizleme sekmesi eklendi.
  - ZIP paketine `cnc_cix/` klasörü yerleştirildi.

### 2.3. Paket B — Şantiye & Rölöve Tolerans Paketi
- **Kör Çıta (Duvar Alıştırma Payı):** `left_filler_width_mm` ve `right_filler_width_mm` ile şantiyede tıraşlanabilir `KOR_CITA_SOL` ve `KOR_CITA_SAG` parçaları hesaplandı, 3D sahnede, BOM'da ve nesting'de yer aldı.
- **Süpürgelik & Kolon Kertmesi:** Yan dikmelere süpürgelik ($80 \times 15\text{ mm}$) ve kolon/kiriş ($120 \times 120\text{ mm}$) kertmeleri işlendi, `OUTLINE_NOTCH_CUT` katmanı ve BOM `notch_info` bilgisi tanımlandı.
- **Ayarlı Baza Ayağı:** `plinth_type: "adjustable_legs"` seçeneğiyle terazi bozukluğu olan zeminler için 4 adet ayarlı plastik ayak (`HRD-AYK-100`) ve klipsli tek ön baza kaydı mantığı kuruldu.

### 2.4. Paket C — İleri Kesim Ekonomisi & Sanal Artık Plaka Deposu
- **Kesim Modu:** `panel_saw` ($4.0\text{ mm}$ testere kerf) ile `cnc_router` ($10.0\text{ mm}$ çakı kerfi + küçük parçaların vakumdan uçmasını engelleyen `holding_tabs_count = 4` `[4×TAB]` sekmesi) ayrıldı.
- **$\ge 400 \times 600\text{ mm}$ Artık Plaka Tespiti:** Plaka optimizasyonu sonrası arta kalan işe yarar büyük parçalar `REM-S01-R1` koduyla tespit edilip nesting SVG üzerinde yeşil kesikli çizgiyle (`ARTIK DEPO`) gösterildi.
- **Gerçek Çöp Fire Oranı:** Brüt fire yerine artık plakalar düşülmüş net çöp fire (`effective_waste_percentage`) hesaplandı.
- **Sanal Artık Depo (`localStorage`):** Atölyecinin çıkan artıkları sanal deposuna tek tıkla kaydedebileceği arayüz paneli oluşturuldu.

### 2.5. Paket D — QR Kodlu Parça Etiketleri & 4-Kenar PVC Şeması
- `PartLabelsView.tsx` bileşeni inşa edildi.
- Her parça için $100 \times 60\text{ mm}$ endüstriyel termal etiket görünümü hazırlandı:
  - Parça kimliği, iş numarası, net ve kesim ölçüleri.
  - **4-Kenar Renkli PVC Şeması:** Ön, arka, sağ, sol kenarlar için kalınlığa göre renkli çizgiler ve panelin damar (grain) yönü oku.
  - CNC operasyonları (delik, kanal, kertme, vakum sekmesi).
  - Vektörel SVG **QR Kod matrisi** (okutulduğunda parçanın CNC programını ve montaj kimliğini verir).
  - Tek tıkla tarayıcıdan termal yazıcıya yazdırma (`window.print()`).
  - İndirilen ZIP arşivi içerisine `etiketler/parca_etiketleri_qr.html` eklendi.

### 2.6. Paket E — Dinamik Maliyet, CNC Süresi & Müşteri Teklif Motoru
- `CostQuoteView.tsx` bileşeni inşa edildi.
- **Canlı Parametrik Hesaplama:**
  - 18 mm Gövde/Kapak ve 8 mm Arkalık plaka maliyeti.
  - Artık plaka iadesi (depoya giren $\ge 400 \times 600\text{ mm}$ parçaların $\%75$ değerle maliyetten düşülmesi).
  - $\%10$ makine baş-son firesi eklenmiş $2.0\text{ mm}$ ve $0.4\text{ mm}$ PVC kenar bandı maliyeti.
  - Hırdavat ve mekanizma toplamı (Cabineo/Minifiks, kavela, ray, menteşe, piston, kulp, ayak).
  - **CNC İşleme Süresi:** Kesim çevresi metrajı + delik adedi $\times 2.2\text{ sn}$ + kanal süresi + plaka yükleme sürelerinden toplam dakika hesabı.
  - **Atölye Montaj Süresi:** Parça adedi ve çekmece sayısına bağlı işçilik saati (Cabineo'da kavela olmadığı için $\%25$ daha hızlı montaj katsayısı).
  - Kâr marjı ($\%$) ve $\%20$ KDV eklenmiş anahtar teslim müşteri teklifi.
  - Modern web standartlarına uygun responsive tablo ve mobil kart görünümü.

### 2.7. Doğrulama ve Sürüm Kontrolü
- Backend test paketi güncellendi: [`test_engines_and_api.py`](file:///home/selahaddin/Belgeler/Marangoz/apps/api/tests/test_engines_and_api.py) içindeki **8 testin tamamı başarıyla geçti**.
- Frontend TypeScript derlemesi (`tsc -b && vite build`) sıfır hata ile tamamlandı.
- Headless Chrome ile arayüz uçtan uca test edilip ekran görüntüsü alındı ([`five_packages_verified.png`](file:///home/selahaddin/.gemini/antigravity/brain/1fbc3648-8b94-4dbd-aa34-9e660f1de9d0/five_packages_verified.png)).
- Tüm değişiklikler Git'e kaydedilip `origin main` dalına (`6cddf8a`) push edildi.

---

## 3. BÖLÜM: GERÇEKLEŞTİRİLEN İLERİ GELİŞTİRMELER (5 ÖNCELİĞİN TAM ENTEGRASYONU)

Raporun 3. bölümünde hedeflenen 5 büyük öncelikli vizyon maddesi bu oturumda tam kodlama ve mühendislik testleriyle başarıyla tamamlanmıştır:

### 3.1. Öncelik 1: Multimodal Görsel & Eskizden Otomatik CAD Üretimi (Gemini Vision Pipeline)
- **4 Katmanlı Vision Entegrasyonu:**
  - Yerel FastAPI `/api/v1/parse_sketch` uç noktası (`ParseSketchRequest` ile base64 görsel ve MIME türü kabulü).
  - Vercel Serverless `/api/parse` fonksiyonunda `inline_data` multimodal payload desteği.
  - Tarayıcıda saklanan anahtarla doğrudan Gemini Vision API çağrısı (`parseSketchWithGeminiApiDirect`).
  - Çevrimdışı ve bağlantı kesilme senaryoları için güvenli varsayılan geri dönüş mekanizması.
- **Kullanıcı Deneyimi & Modal:**
  - Ana ekrana **"Eskiz / Çizim Yükle"** butonu ve zengin modal eklendi.
  - Kamera ile çekim (`capture="environment"`), sürükle-bırak dosya yükleme (PNG, JPEG, WebP, SVG).
  - Anında test edilebilmesi için 2 adet hazır teknik rölöve krokisi (Buzdolabı Çevreleme & 2 Kapaklı Gardırop Çizimi) sisteme gömüldü.
  - Görsel yüklendiğinde otomatik `CabinetConfig` üretilip 3D CAD sahnesi ve üretim paketi anında oluşturulur.

### 3.2. Öncelik 2: 3D Sahne Etkileşimi (CSG Kertmeler, Dinamik Animasyon, X-Ray)
- **Gerçekçi CSG Kertme Extrude Geometrisi:** Süpürgelik ($80 \times 15\text{ mm}$) ve kolon ($120 \times 120\text{ mm}$) kertmeleri yan dikmelerde artık düz kutu değil, `THREE.Shape` ve `THREE.ExtrudeGeometry` ile milimetrik gerçek kesik geometri olarak render edilmektedir.
- **Dinamik Kapak ve Çekmece Tıklama Animasyonu:** 3D modeldeki herhangi bir kapağa veya çekmeceye tıklandığında yalnızca o elemanın bağımsız olarak menteşesinden 90° açılması veya çekmecenin teleskopik rayla öne kayması sağlandı. Üst kontrol çubuğundan tek tıkla toplu açma/kapama desteği korundu.
- **CNC Röntgen / Delik Modu (X-Ray):** Yeni araç çubuğu butonu ile paneller yarı saydam hale gelirken Sistem 32 delikleri (turkuaz), Cabineo 12 cepleri (parlak kehribar), menteşe delikleri (yeşil) ve arkalık kanalları (turuncu) 3D katı silindir ve prizmalar olarak parlar.

### 3.3. Öncelik 3: Atölye İçi Mobil & Tablet Parça Terminali (QR Tarayıcı)
- `WorkshopScannerView.tsx` bileşeni inşa edildi ve arayüze 6. sekme olarak entegre edildi.
- Tablet/telefon kamerası ile QR okutma veya listeden parça seçildiğinde operatörün karşısına:
  - Büyük puntolarla net ve kesim ölçüleri (PVC düşülmüş imalat ölçüleri).
  - **4-Kenar PVC Bantlama Kılavuzu:** Ön, arka, üst, alt kenar kalınlıkları ve damar yönü.
  - **CNC Operasyon Kılavuzu:** Delik adetleri, kanallar, kertmeler ve vakum güvenlik sekmeleri (`[4×TAB]`).
  - **3D Modelde Konumu Göster Butonu:** Tek tıkla 3D sahneye geçip ilgili parçayı parlatır.
  - **Tezgâh Operatörü İçin Doğrudan CNC Programı İndirme:** Biesse Rover (`.CIX`), Homag Weeke (`.MPR`), ISO G-Code (`.NC`) ve AutoCAD (`.DXF`) dosyalarını tek tıkla tablete/USB'ye indirme.

### 3.4. Öncelik 4: Kurumsal PDF Müşteri Teklif ve Sözleşme Çıktısı
- `CostQuoteView.tsx` içerisine **"Resmi Sözleşme & Teklif PDF'i"** motoru entegre edildi.
- **Resmi Kurumsal A4 Baskı Şablonu:**
  - Firma anteti, teklif/sözleşme takip numarası (`MRG-TKF-...`), düzenleme tarihi ve geçerlilik süresi.
  - Canlı düzenlenebilir müşteri adı, teslimat adresi, teslim süresi ve proje tanımı.
  - 1. Madde: Malzeme, PVC, Cabineo/Minifiks, arkalık ve donanım teknik şartnamesi.
  - 2. Madde: Kalem kalem fiyat döküm tablosu, ara toplam, %20 KDV ve genel toplam.
  - 3. Madde: 2 yıl garanti, imalat şartları ve ödeme planı (%50 - %40 - %10).
  - Çift taraflı müşteri ve yüklenici firma kaşe/imza onay alanları.
  - `window.print()` ile kusursuz A4 çıktısı veya PDF kaydetme.

### 3.5. Öncelik 5: True-Shape (Poligonel / L-Kertme) Nesting Motoru
- `nesting_engine.py` ve `clientEngine.ts` içerisine `is_true_shape` ve `notch_info` entegrasyonu sağlandı.
- CNC Router modunda kertmeli (L şekilli) parçalar tespit edilip SVG üzerinde `[L-KERTME]` etiketiyle ve freze kesim sınırlarıyla işaretlendi.
- Bounding box fireleri yerine gerçek parça poligon alanı hesaba katılarak atölye fire optimizasyonu sağlandı.

---

## 4. BÖLÜM: GÜNCEL SİSTEM MİMARİSİ VE DOSYA DİZİN HARİTASI

```
Marangoz/
├── apps/
│   ├── api/
│   │   ├── app/
│   │   │   ├── core/config.py              # Cabineo, Router Kerf, Remnant sabitleri
│   │   │   ├── schemas/cabinet.py          # ParseSketchRequest, NestedPartPlacement (true-shape)
│   │   │   ├── engines/
│   │   │   │   ├── bom_engine.py           # Cabineo, Ayak, Kör Çıta, Kertme hesapları
│   │   │   │   ├── dxf_engine.py           # DXF R2010 katmanları (Kertme, Cabineo)
│   │   │   │   ├── cnc_post_engine.py      # Biesse CIX, Homag MPR, ISO NC post-processor
│   │   │   │   ├── nesting_engine.py       # True-Shape L-Kertme, Router kerf, Artık Plaka Tespiti
│   │   │   │   └── parser_engine.py        # Gemini Vision parse_sketch + Doğal dil kural motoru
│   │   │   └── routers/cabinet.py          # /parse, /parse_sketch, /generate, /dxf, /cix API uçları
│   │   └── tests/test_engines_and_api.py   # 9/9 Başarılı Pytest paketi
│   └── web/
│       ├── src/
│       │   ├── types/cabinet.ts            # is_true_shape, notch_info tip tanımları
│       │   ├── services/
│       │   │   ├── clientEngine.ts         # Tarayıcı içi CAD/CAM/CIX/Nesting/QR motoru
│       │   │   ├── api.ts                  # parseSketchImage, 4 katmanlı hibrit API istemcisi
│       │   │   └── geminiClient.ts         # Gemini Vision doğrudan tarayıcı multimodal entegrasyonu
│       │   ├── components/
│       │   │   ├── CabinetViewer3D.tsx     # Three.js CSG kertmeler, tıkla-aç animasyonu & X-Ray
│       │   │   ├── BomTableView.tsx        # Detaylı kesim, delik ve CNC kod önizlemesi
│       │   │   ├── NestingView.tsx         # SVG Plaka yerleşimi ve Sanal Artık Depo
│       │   │   ├── PartLabelsView.tsx      # QR Barkodlu parça termal etiketleri
│       │   │   ├── CostQuoteView.tsx       # Maliyet, CNC süresi & A4 Müşteri Sözleşmesi PDF
│       │   │   └── WorkshopScannerView.tsx # Mobil & Tablet Atölye Parça Terminali (QR)
│       │   └── App.tsx                     # Ana arayüz, 6 sekme, Eskiz Yükleme Modalı
│       └── package.json
└── rapor.txt                               # Başlangıç ihtiyaç analizi ve saha raporu
```

