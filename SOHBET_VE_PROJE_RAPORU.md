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

## 3. BÖLÜM: NELER YAPACAĞIZ? (GELECEK VİZYONU VE SONRAKİ ADIMLAR)

Projenin bir sonraki fazında atölye verimliliğini ve kullanıcı deneyimini daha da yukarı taşıyacak öncelikli geliştirme maddeleri:

### 3.1. Öncelik 1: Multimodal Görsel & Eskizden Otomatik CAD Üretimi
- **Kamera ile Çekilen Çizim:** Kullanıcı kağıda çizdiği buzdolabı nişi, gardırop veya mutfak dolabı eskizini telefonla çekip arayüze yükleyecek.
- **Gemini Vision Pipeline:** Görseldeki ölçüler, nişler, kapak yönleri ve notlar doğrudan Vision API ile okunup `CabinetConfig` JSON formatına dönüştürülecek ve 3D sahneye aktarılacak.

### 3.2. Öncelik 2: 3D Sahne Etkileşiminin Geliştirilmesi
- **CSG Kertme Renderı:** Süpürgelik ve kolon kertmelerinin 3D sahnede gerçek panel kesiği olarak görünmesi.
- **Dinamik Kapak / Çekmece Animasyonu:** Kullanıcının 3D sahnedeki kapağa tıkladığında kapağın açılması (menteşeli veya yukarı kalkar gazlı piston hareketi) ve çekmecelerin ileri doğru kayması.
- **Röntgen / Tel Çerçeve Modu:** Birleşimlerdeki Cabineo ceplerinin ve Sistem 32 deliklerinin 3D model üzerinde yarı saydam olarak incelenebilmesi.

### 3.3. Öncelik 3: Atölye İçi Mobil / Tablet Barkod Okuyucu Modu
- Etiketteki QR kod bir telefon kamerası veya el terminaliyle okutulduğunda, ustanın önüne o parçanın 3D montajdaki yeri, kenar bantlama yönü ve tezgâh operatörü için doğrudan `.NC`/`.CIX` dosyasını CNC'ye aktarma seçeneği gelecek.

### 3.4. Öncelik 4: Kurumsal PDF Müşteri Teklif ve Sözleşme Çıktısı
- Teklif motorundaki dökümün profesyonel, antetli, mobilya görseli ve malzeme özelliklerini içeren müşteri onaylı resmi bir PDF sözleşmesine dönüştürülmesi.

### 3.5. Öncelik 5: True-Shape (Poligonel) Yuvalama / Nesting Motoru
- Kertmeli (L şeklindeki) parçaların ve artık plakaların testere dışındaki serbest CNC Router frezesinde iç içe (girintili-çıkıntılı) yerleştirilerek fire oranının $\%5$'in altına çekilmesi.

---

## 4. BÖLÜM: SİSTEM MİMARİSİ VE DOSYA DİZİN HARİTASI

```
Marangoz/
├── apps/
│   ├── api/
│   │   ├── app/
│   │   │   ├── core/config.py              # Cabineo, Router Kerf, Remnant sabitleri
│   │   │   ├── schemas/cabinet.py          # FastenerType, CuttingMode, RemnantStockItem vb.
│   │   │   ├── engines/
│   │   │   │   ├── bom_engine.py           # Cabineo, Ayak, Kör Çıta, Kertme hesapları
│   │   │   │   ├── dxf_engine.py           # DXF R2010 katmanları (Kertme, Cabineo)
│   │   │   │   ├── cnc_post_engine.py      # Biesse CIX, Homag MPR, ISO NC post-processor
│   │   │   │   ├── nesting_engine.py       # 2D Giyotin, Router kerf, Artık Plaka Tespiti
│   │   │   │   └── parser_engine.py        # Doğal dil regex ve kural motoru
│   │   │   └── routers/cabinet.py          # /parse, /generate, /dxf, /cix API uçları
│   │   └── tests/test_engines_and_api.py   # 8/8 Başarılı Pytest paketi
│   └── web/
│       ├── src/
│       │   ├── types/cabinet.ts            # Frontend TypeScript tip tanımları
│       │   ├── services/
│       │   │   ├── clientEngine.ts         # Tarayıcı içi CAD/CAM/CIX/Nesting/QR motoru
│       │   │   ├── api.ts                  # Backend/Vercel/Browser hibrit API istemcisi
│       │   │   └── geminiClient.ts         # Gemini AI doğrudan tarayıcı entegrasyonu
│       │   ├── components/
│       │   │   ├── CabinetViewer3D.tsx     # Three.js 3D parametrik görüntüleyici
│       │   │   ├── BomTableView.tsx        # Detaylı kesim, delik ve CNC kod önizlemesi
│       │   │   ├── NestingView.tsx         # SVG Plaka yerleşimi ve Sanal Artık Depo
│       │   │   ├── PartLabelsView.tsx      # QR Barkodlu parça termal etiketleri
│       │   │   └── CostQuoteView.tsx       # Dinamik maliyet, CNC süresi & teklif
│       │   └── App.tsx                     # Ana arayüz, 29 şablonlu katalog, kontroller
│       └── package.json
└── rapor.txt                               # Başlangıç ihtiyaç analizi ve saha raporu
```
