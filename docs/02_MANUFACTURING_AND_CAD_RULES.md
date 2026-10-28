# 02. Fabrika Üretim ve Ahşap İşleme Kuralları

Bu kurallar sistemdeki tüm parametrik Python sınıflarına değişmez sabitler (hard constraints) olarak gömülecektir.

## 1. Malzeme ve Tolerans Standartları
* **Gövde Malzemesi:** $t_{\text{gövde}} = 18.0\text{ mm}$ Suntalam veya MDF-Lam.
* **Arkalık Malzemesi:** 
  * $t_{\text{arkalık}} = 8.0\text{ mm}$ MDF-Lam (Kanal içi geçme - varsayılan).
  * Alternatif: $3.0\text{ mm}$ Duralit (Çakma).
* **Standart Plaka Ebatları:**
  * $2800\text{ mm} \times 2100\text{ mm}$ (Varsayılan standart plaka)
  * $3660\text{ mm} \times 1830\text{ mm}$
* **Plaka Kenar Temizlik Payı (Trim):** Ham plakanın dört kenarından $10.0\text{ mm}$ temizlik kesimi düşülür (net kullanılabilir alan: $2780\text{ mm} \times 2080\text{ mm}$).
* **Testere Talaş Payı (Kerf):** $4.0\text{ mm}$ (Her kesim hattında düşülecek testere kalınlığı).

## 2. Kenar Bandı (PVC) Matematiksel Düşümü
* $0.4\text{ mm}$ PVC kullanıldığında testere payından düşüm yapılmaz (ihmal edilir: $0.0\text{ mm}$).
* $1.0\text{ mm}$ ve $2.0\text{ mm}$ PVC kullanıldığında parça ebatlama (kesim) ölçüsü bant kalınlığı kadar küçültülür:
  $$L_{\text{kesim}} = L_{\text{net}} - \left(\text{PVC}_{\text{üst}} + \text{PVC}_{\text{alt}}\right)$$
  $$W_{\text{kesim}} = W_{\text{net}} - \left(\text{PVC}_{\text{ön}} + \text{PVC}_{\text{arka}}\right)$$
  *(İhmal eşiği: $\text{PVC} < 1.0\text{ mm} \implies 0.0\text{ mm}$ düşüm).*

## 3. Gövde Konstrüksiyonu ve Parça Ölçülendirme Kuralları
Dış ölçüleri $W$ (Genişlik), $H$ (Yükseklik), $D$ (Derinlik) olan standart bir modülde:
1. **Sol ve Sağ Yan Dikmeler (2 Adet):**
   * Net Ölçü: $H \times D \times 18\text{ mm}$
   * PVC: Ön kenar $2.0\text{ mm}$ (veya seçilen ön PVC), üst/alt/arka kenarlar $0.4\text{ mm}$.
2. **Alt ve Üst Tabla (2 Adet - İçten Bağlantılı):**
   * Net Ölçü: $(W - 2 \times 18) \times D \times 18\text{ mm}$
   * Bazalı (plinth) modüllerde alt tabla baza yüksekliği ($H_{\text{baza}}$, varsayılan $80\text{ mm}$ veya $100\text{ mm}$) kadar yukarıdan bağlanır ve altına ön/arka baza kayıtları eklenir.
3. **Arkalık Kanalı ve 8 mm Arkalık:**
   * Yan dikmeler ile alt/üst tablaların iç yüzeylerinde, arka kenardan $10.0\text{ mm}$ içeride, $8.5\text{ mm}$ genişliğinde ve $8.0\text{ mm}$ derinliğinde testere/frezeli kanal açılır.
   * **Arkalık Net Ölçüsü:** Her iki yönde kanala $7.5\text{ mm}$ (toplam $+15.0\text{ mm}$) girer:
     $$W_{\text{arkalık}} = (W - 2 \times 18) + 15.0\text{ mm}$$
     $$H_{\text{arkalık}} = (H_{\text{iç}}) + 15.0\text{ mm}$$
4. **Hareketli Raflar:**
   * Net Genişlik: $(W - 2 \times 18) - 2.0\text{ mm}$ (Montaj toleransı: sağ/sol $1\text{ mm}$ boşluk).
   * Net Derinlik: $D - 10.0\text{ mm (arka boşluk)} - 8.5\text{ mm (kanal)} - 20.0\text{ mm (ön gerileme)} = D - 38.5\text{ mm}$.
5. **Kapaklar (Dıştan Basma / Overlay):**
   * Çevre boşluğu (fuga) her kenardan $1.5\text{ mm}$ - $2.0\text{ mm}$ olarak hesaplanır.
   * Tek kapak genişliği: $W - 4.0\text{ mm}$.
   * Çift kapak (her biri) genişliği: $\frac{W - 6.0}{2}\text{ mm}$ (kenarlardan $2\text{ mm}$, ortada $2\text{ mm}$ fuga).
   * Kapak tüm kenarları $2.0\text{ mm}$ PVC bantlıdır.

## 4. CNC Delik Sistemi (Sistem 32) ve DXF Katman Standartları
Tüm CNC operasyonları `ezdxf` ile **DXF R2010** formatında ve aşağıdaki endüstriyel katman (layer) isimleriyle üretilir:
* `OUTLINE_CUT` (Renk: 7 - Beyaz): Parça kesim dış konturu (`LWPOLYLINE`, kapalı).
* `GROOVE_BACK_8MM` (Renk: 3 - Yeşil): Arkalık kanalı dikdörtgen konturu (Derinlik: $8.0\text{ mm}$, Genişlik: $8.5\text{ mm}$).
* `DRILL_MINIFIX_CAM_D15` (Renk: 1 - Kırmızı): Minifiks gövde (eksantrik) yuvası ($\varnothing 15\text{ mm}$, Derinlik: $13.5\text{ mm}$, birleşim kenarından merkez mesafesi: $34.0\text{ mm}$).
* `DRILL_MINIFIX_BOLT_D8` (Renk: 2 - Sarı): Minifiks mil / kavela karşılık deliği ($\varnothing 8\text{ mm}$, Derinlik: $11.0\text{ mm}$).
* `DRILL_DOWEL_D8` (Renk: 4 - Camgöbeği): Ahşap kavela deliği ($\varnothing 8\text{ mm}$, Minifiks deliğinden $32.0\text{ mm}$ mesafede).
* `DRILL_SHELF_PIN_D5` (Renk: 5 - Mavi): $\varnothing 5\text{ mm}$ raf pimi delikleri (Önden $37.0\text{ mm}$, arkadan $50.0\text{ mm}$ içeride, dikeyde $32.0\text{ mm}$ adımlı 3'lü grup delikler).
* `DRILL_HINGE_CUP_D35` (Renk: 6 - Macenta): Kapak tas menteşe yuvası ($\varnothing 35\text{ mm}$, Derinlik: $13.0\text{ mm}$, kapak kenarından merkez: $22.5\text{ mm}$, üst/alt kenardan $100.0\text{ mm}$ içeride).

