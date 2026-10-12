# Trilocale Milano — 3D Ev Turu

Üst klasördeki `trilocale_via_boncompagni_milano.glb` modelini kullanan, scroll ile gezilen 3D daire turu (Vite + Three.js).

## Çalıştırma

```bash
cd web
npm install
npm run dev      # http://localhost:5173
```

## Özellikler

- **Scroll Turu:** Sayfa kaydırmasından bağımsız sanal scroll — fare tekerleği, touchpad, dokunmatik kaydırma ve ok/PageUp-Down/Space tuşları turu doğrudan sürer. Kaydırmaya başlayınca kamera önce baktığı yöne yakınlaşır, bırakınca kaydırma yönündeki odaya yumuşakça oturur. Odalar arası geçişler kapı boşluklarından yapılır (`src/rooms.js` → `VIAS`).
- **Eşyaya odaklanma:** Odadaki etiketlere (veya alt paneldeki eşya butonlarına) tıklayınca kamera eşyaya uçar, bilgi paneli açılır. `Esc` veya “Tura dön” ile geri dönülür.
- **Serbest Gezinti:** Orbit kontrol; zemine çift tıklayınca o noktaya yürür.

## Renkli dekor (`src/decor.js`)

- Her odaya farklı pastel duvar boyası (konuma göre renk veren shader), oturma alanında terrakota vurgu duvarı
- Mobilyaların yeniden renklendirilmesi: hardal kadife kanepe, terrakota deri sandalyeler, petrol mavisi kitaplık, pembe yatak örtüleri
- Kodla üretilen dekor: monstera bitkileri, yastıklar, şallar, desenli halılar, sehpa, lambader, sarkıt lamba, soyut tablolar, çiçekli vazolar, fesleğen saksıları, meyve kâsesi

## Modelde eksik olan ve kodla tamamlanan parçalar (`src/completion.js`)

| Eksik | Çözüm |
|---|---|
| Tavan yok | Tüm daireyi örten, yalnızca aşağıdan görünen tavan düzlemi (kuş bakışında otomatik görünmez) |
| Aydınlatma yok | Gömme spot armatürleri + oda başına nokta ışıklar, güneş ışığı (gölgeli), hemisfer ışık, ortam (environment) haritası |
| Sadece baseColor dokuları var | Malzeme adına göre PBR pürüzlülük/metallik değerleri (krom, paslanmaz, seramik, ahşap, kumaş…) |
| Cam ve ayna davranışı yok | Şeffaf/yansımalı cam; banyo aynaları için gerçek zamanlı düzlemsel yansıma (`Reflector`) |

Koordinatlar orijinal 3ds santimetre koordinatlarında tutulur ve `P(x, y, z)` ile sahneye çevrilir.

## Lisans

Model: “Trilocale Via Boncompagni Milano” — Fabio Siccardi, CC-BY-4.0
(https://sketchfab.com/3d-models/trilocale-via-boncompagni-milano-dd261cf6c2e647cab915f015230bb15e)
