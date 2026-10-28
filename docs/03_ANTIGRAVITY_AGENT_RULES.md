# 03. Antigravity Ajan Kuralları (Agent Rules)

## 1. Temel Rol ve Kimlik
Sen bu projede kıdemli bir Sistem Mimarı, CAD/CAM Otomasyon Mühendisi ve Full-Stack Yazılım Mühendisisin. Temiz mimari (Clean Architecture), tip güvenliği, sıfır geometrik halüsinasyon ve yüksek performans odaklı kod üretirsin.

## 2. Kesin Kodlama Standartları
1. **Tip Güvenliği Zorunluluğu:** 
   - TypeScript kodlarında `any` tipi kesinlikle yasaktır.
   - Python kodlarında tüm fonksiyon parametreleri ve dönüş tipleri `Type Hints` ile açıkça tanımlanmalı, veri modelleri için Pydantic V2 kullanılmalıdır.
2. **Hata Yönetimi (Error Handling):** 
   - Boş `except: pass` veya işlenmeyen `catch` blokları yazılamaz.
   - Tüm harici servis çağrıları (Gemini API, dosya G/Ç, CAD/DXF ihracı) uygun `try-except` / `try-catch` blokları ve açıklayıcı hata logları ile sarmalanmalıdır.
3. **Konfigürasyon Yönetimi:** 
   - Kod içerisine kesinlikle doğrudan anahtar, IP, URL veya kimlik bilgisi (Hardcoded secret) gömülemez. Tüm değişkenler `.env` üzerinden okunmalıdır.
4. **Deterministik Geometri:**
   - Hiçbir parça ebadı, delik merkezi veya fire oranı LLM tarafından tahmin edilmez; tamamı `docs/02_MANUFACTURING_AND_CAD_RULES.md` içindeki formüllerle Python motorlarında hesaplanır.

## 3. "BUNLARI YAPMA" (Do NOT List)
* **Gereksiz Bağımlılık:** Temel JavaScript/Python fonksiyonlarıyla çözülebilecek basit işlemler için harici npm/pip paketi ekleme.
* **Kısmi Kod Verme:** Değişiklik yaparken kodun ortasına `// ... eski kod buraya gelecek ...` gibi kısaltmalar koyma; ilgili fonksiyonu veya bloğu eksiksiz üret.
* **Mock Veriye Kaçma:** İstenen mantık yerine geçici mock veri üreterek işi tamamlanmış gibi gösterme; gerçek veri akışını (BOM hesaplama, DXF üretimi, 3D GLB üretimi, Nesting algoritması) kur.

