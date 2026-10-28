# 05. Çoklu Modül Oda Hatları, Çekmece Kasa Mühendisliği ve CNC Post-Processor (G-Code / MPR)

## 1. Oda Kategorileri ve Standart Fabrika Hatları (Multi-Module Room Lines)

Mobilya fabrikalarında üretim yalnızca tekil dolap üzerinden değil, yan yana dizilen modüllerin (**Hat / Line**) ortak plaka optimizasyonuna (Nesting) sokulmasıyla yapılır.

| Oda / Kategori | Hat Adı | Modül Kombinasyonu ($W \times H \times D\text{ mm}$) |
| :--- | :--- | :--- |
| **Mutfak** | Standart Mutfak Alt + Kiler Hattı | 1) Evye Altı ($800\times 820\times 560$, 2 Kapak)<br>2) Çekmeceli Alt Modül ($600\times 820\times 560$, 3 Çekmece)<br>3) Ankastre / Boy Kiler ($600\times 2100\times 580$, 4 Raf + 2 Çekmece) |
| **Yatak Odası** | 270 cm Gardırop & Giyinme Hattı | 1) Sol Modül ($900\times 2100\times 580$, Çift Kapak, 4 Raf)<br>2) Orta Modül ($900\times 2100\times 580$, 3 Çekmece + Üst Kapak)<br>3) Sağ Modül ($900\times 2100\times 580$, Çift Kapak, 4 Raf) |
| **Yatak Odası** | Şifonyer & Komodin Seti | 1) Sol Komodin ($500\times 520\times 450$, 2 Çekmece)<br>2) 4 Çekmeceli Şifonyer ($900\times 860\times 480$, 4 Çekmece)<br>3) Sağ Komodin ($500\times 520\times 450$, 2 Çekmece) |
| **Banyo** | Banyo Lavabo & Boy Dolabı Hattı | 1) Lavabo Altı Dolabı ($800\times 650\times 480$, 2 Çekmece, Bazasız)<br>2) Banyo Boy Dolabı ($450\times 1800\times 380$, Tek Kapak, 4 Raf) |
| **Antre / Hol** | Komple Vestiyer & Portmanto Hattı | 1) Oturma Banklı Ayakkabılık ($900\times 520\times 400$, 2 Çekmece)<br>2) Gardırop Tipi Portmanto ($900\times 2100\times 400$, Çift Kapak + 2 Çekmece) |
| **Salon & Ofis** | TV Medya Konsolu & Kitaplık Hattı | 1) Sol Kitaplık Kulesi ($600\times 1800\times 350$, 5 Açık Raf)<br>2) TV Alt Konsolu ($1600\times 500\times 420$, 2 Çekmece + Çift Kapak)<br>3) Sağ Kitaplık Kulesi ($600\times 1800\times 350$, 5 Açık Raf) |

---

## 2. Çekmece Kasa ve Ray Mühendisliği (Drawer Box & Slide Rules)

Bir modülde $N_{\text{çekmece}} > 0$ tanımlandığında aşağıdaki deterministik kurallar işletilir:

1. **Teleskopik / Frenli Ray Boşluğu:**
   * Her iki yan dikme ile çekmece yan kasası arasında $13.0\text{ mm}$ (toplam $26.0\text{ mm}$) ray montaj boşluğu bırakılır.
2. **Ray Boyu ($L_{\text{ray}}$):**
   * Gövde derinliğine ($D$) sığan en büyük standart ray boyu seçilir ($50\text{ mm}$ arka emniyet payı ile):
     $$L_{\text{ray}} \in \{250, 300, 350, 400, 450, 500, 550\}\text{ mm}, \quad L_{\text{ray}} \le D - 50\text{ mm}$$
3. **Çekmece Parçaları (Her 1 Çekmece İçin 5 Parça):**
   * **Çekmece Klapa (Ön Kapak - 18 mm):** Genişlik $W - 4.0\text{ mm}$, Yükseklik $H_{\text{klapa}} = 180\text{ mm}$ (veya modül tipine göre orantılı), 4 kenarı $2.0\text{ mm}$ PVC bantlı.
   * **Çekmece Sol/Sağ Yan Kasa (2 Adet - 18 mm):** Boy $L_{\text{ray}}$, En $H_{\text{kutu}} = H_{\text{klapa}} - 45.0\text{ mm}$.
   * **Çekmece Ön/Arka İç Kasa (2 Adet - 18 mm):** Boy $W_{\text{iç}} - 26.0\text{ mm (ray)} - 36.0\text{ mm (2 yan)} = W_{\text{iç}} - 62.0\text{ mm}$, En $H_{\text{kutu}}$.
   * **Çekmece Tabanı (1 Adet - 8 mm MDF-Lam):** $(W_{\text{iç}} - 62.0 + 15.0) \times (L_{\text{ray}} - 36.0 + 15.0)\text{ mm}$.
4. **Sistem 32 Ray Montaj Delikleri (`DRILL_SLIDE_D5`):**
   * Sol ve sağ yan dikmelerde her çekmece ray ekseni için önden $37.0\text{ mm}$, $165.0\text{ mm}$ ($37 + 4\times 32$) ve $293.0\text{ mm}$ ($37 + 8\times 32$) mesafelerde $\varnothing 5\text{ mm}$, $12\text{ mm}$ derinlikte kılavuz delikleri açılır.

---

## 3. CNC Makine Post-Processor Standartları (G-Code `.nc` & WoodWOP `.mpr`)

1. **FANUC / ISO Standart 3 Eksen G-Code (`.nc`):**
   * `G21 G90 G17 G40` (Metrik, mutlak koordinat, XY düzlemi).
   * `T1 M6` ($\varnothing 8\text{ mm}$ Karbür Parmak Freze — Dış kesim ve 8 mm arkalık kanalı).
   * `T2 M6` ($\varnothing 5\text{ mm}$ / $\varnothing 8\text{ mm}$ / $\varnothing 15\text{ mm}$ / $\varnothing 35\text{ mm}$ Matkap Başı — `G81` delik çevrimi).
2. **Homag / Weeke WoodWOP 4.0 (`.mpr`):**
   * `[H` başlığı, `BSX`, `BSY`, `BSZ` parça kesim ebatları.
   * `<100 \WerkStck\` iş parçası tanımı.
   * `<102 \BohrVert\` dikey delik blokları (`XA`, `YA`, `TI` derinlik, `DU` çap).
   * `<112 \Tasche\` arkalık kanalı cep frezeleme bloğu.

