import * as THREE from 'three';

/*
 * Model, 3ds kaynağından gelen santimetre birimli ve Z-yukarı koordinatlarla
 * dışa aktarılmış. Tüm kamera / eşya konumlarını orijinal 3ds koordinatlarında
 * (x, y, z — cm) yazıp P() ile dünya koordinatına (metre, Y-yukarı) çeviriyoruz.
 *
 * Kat planı (3ds): x -8941..-7839 (batı→doğu), y -189..532 (güney→kuzey)
 *   Batı:  Yatak Odası I (kuzey), Yatak Odası II (güney)
 *   Orta:  Koridor; kuzeyde ikinci banyo, güneyde ana banyo
 *   Doğu:  Mutfak (kuzey), yemek alanı (güney), oturma alanı (doğu duvarı)
 */
export const ORIGIN = { x: -8390, y: 173 };

export function P(x, y, z) {
  return new THREE.Vector3((x - ORIGIN.x) / 100, z / 100, -(y - ORIGIN.y) / 100);
}

// Göz yüksekliği (cm)
const EYE = 160;

export const ROOMS = [
  {
    id: 'overview',
    title: 'Genel Bakış',
    text: 'Milano’nun Via Boncompagni caddesinde iki yatak odalı, iki banyolu; her odası farklı bir renge boyanmış neşeli bir daire. Aşağı kaydırarak odaları tek tek gezin.',
    cam: [-8330, -560, 920],
    look: [-8440, 150, 0],
    items: [],
  },
  {
    id: 'living',
    title: 'Oturma Alanı',
    text: 'Terrakota vurgu duvarı önünde hardal sarısı kadife kanepe, gökkuşağı halı ve petrol mavisi kitaplık. Açık plan; mutfak ve yemek alanıyla bütünleşiyor.',
    cam: [-8170, -60, EYE],
    look: [-7930, 240, 70],
    items: [
      {
        id: 'sofa', name: 'Hardal Kanepe', pos: [-7920, 253, 75],
        cam: [-8090, 230, 135], look: [-7925, 253, 50],
        text: 'Hardal sarısı kadife, derin oturumlu modüler kanepe; mercan, turkuaz ve pembe yastıklarla.',
        specs: { Malzeme: 'Hardal kadife', Ölçü: '240 × 100 cm', Yükseklik: '85 cm' },
      },
      {
        id: 'shelf', name: 'Petrol Mavisi Kitaplık', pos: [-7900, 50, 120],
        cam: [-8070, 40, 145], look: [-7895, 50, 105],
        text: 'Asimetrik bölmeli, petrol mavisi lake kitaplık; alt çekmeceleri pirinç kulplu. Oturma alanı ile girişi birbirinden ayırıyor.',
        specs: { Malzeme: 'Petrol mavisi lake', Kulp: 'Parlak pirinç', Yükseklik: '200 cm' },
      },
      {
        id: 'door', name: 'Giriş Kapısı', pos: [-7852, -78, 110],
        cam: [-8060, -70, 150], look: [-7850, -78, 105],
        text: 'Daireye doğu cephesinden giriş; sıcak tonlu ahşap kapı.',
        specs: { Malzeme: 'Ahşap', Genişlik: '90 cm' },
      },
      {
        id: 'rug-l', name: 'Gökkuşağı Halı & Sehpa', pos: [-8040, 255, 45],
        cam: [-8180, 170, 150], look: [-8040, 255, 25],
        text: 'Halka desenli pastel halı ve üzerinde pembe tablalı, pirinç ayaklı yuvarlak sehpa; renkli kitaplar ve çiçekli vazo.',
        specs: { Halı: 'Ø 190 cm', Sehpa: 'Ø 76 cm, pembe lake', Ayak: 'Pirinç' },
      },
      {
        id: 'art-l', name: 'Tablo Üçlüsü', pos: [-7872, 253, 165],
        cam: [-8070, 253, 160], look: [-7872, 253, 150],
        text: 'Kemer, güneş ve dalga motifli soyut tablo serisi; terrakota duvarla sıcak bir kontrast.',
        specs: { Ölçü: '3 × 44 × 56 cm', Çerçeve: 'Krem' },
      },
      {
        id: 'lamp-l', name: 'Lambader', pos: [-7905, 410, 150],
        cam: [-8060, 330, 140], look: [-7905, 410, 110],
        text: 'Pirinç gövdeli, hardal kubbe başlıklı lambader; akşamları kanepe köşesine sıcak ışık.',
        specs: { Yükseklik: '160 cm', Işık: 'Sıcak beyaz' },
      },
    ],
  },
  {
    id: 'dining',
    title: 'Yemek Alanı',
    text: 'Yuvarlak beton tablalı masa, terrakota deri sandalyeler, mercan sarkıt lamba ve halka desenli halı. Güney pencereleri masayı gün boyu aydınlatıyor.',
    cam: [-8080, 70, EYE],
    look: [-8268, -58, 55],
    items: [
      {
        id: 'table', name: 'Yuvarlak Masa', pos: [-8268, -58, 80],
        cam: [-8150, 30, 150], look: [-8268, -58, 65],
        text: 'Siyah ahşap ayaklar üzerinde mikro beton kaplamalı yuvarlak yemek masası.',
        specs: { Yüzey: 'Mikro beton', Çap: '120 cm', Kişi: '4' },
      },
      {
        id: 'chairs', name: 'Deri Sandalyeler', pos: [-8196, -55, 55],
        cam: [-8110, 10, 115], look: [-8205, -58, 45],
        text: 'Terrakota deri oturumlu, siyah çerçeveli Windsor tipi sandalyeler.',
        specs: { Kaplama: 'Terrakota deri', Çerçeve: 'Siyah meşe', Adet: '4' },
      },
      {
        id: 'rug', name: 'Halka Desenli Halı', pos: [-8268, -148, 4],
        cam: [-8180, 80, 210], look: [-8268, -70, 0],
        text: 'Yemek alanını tanımlayan, mercan-hardal-turkuaz halkalı yuvarlak halı.',
        specs: { Doku: 'Dimi (twill)', Çap: '190 cm' },
      },
      {
        id: 'pendant', name: 'Sarkıt Lamba', pos: [-8268, -58, 172],
        cam: [-8140, 40, 135], look: [-8268, -58, 155],
        text: 'Masanın üzerinde alçak asılan mercan kubbe sarkıt; içi sıcak ışıkla parlıyor.',
        specs: { Çap: '48 cm', Renk: 'Mercan' },
      },
    ],
  },
  {
    id: 'kitchen',
    title: 'Mutfak',
    text: 'Bordo zeminli koridor tipi mutfak: ankastre ocak, fırın ve evye tek bir tezgâh hattında; yanında boy dolapları.',
    cam: [-8330, 160, EYE],
    look: [-8232, 340, 95],
    items: [
      {
        id: 'cooktop', name: 'Ocak & Fırın', pos: [-8233, 354, 96],
        cam: [-8330, 300, 165], look: [-8233, 354, 80],
        text: 'Paslanmaz çelik çerçeveli seramik ocak ve altında dijital saatli ankastre fırın.',
        specs: { Ocak: 'Seramik, 4 göz', Fırın: 'Ankastre, dijital', Malzeme: 'Paslanmaz çelik' },
      },
      {
        id: 'sink-k', name: 'Evye', pos: [-8233, 247, 96],
        cam: [-8330, 200, 160], look: [-8233, 247, 85],
        text: 'Tezgâh altı siyah granit evye ve krom batarya.',
        specs: { Evye: 'Granit kompozit', Batarya: 'Krom' },
      },
      {
        id: 'herbs', name: 'Fesleğen Saksıları', pos: [-8240, 296, 115],
        cam: [-8320, 285, 145], look: [-8240, 296, 100],
        text: 'Tezgâhta mercan ve hardal saksılarda taze fesleğen; yanında meyve kâsesi.',
        specs: { Saksı: 'Seramik' },
      },
    ],
  },
  {
    id: 'bath1',
    title: 'Ana Banyo',
    text: 'Mozaik zemin, granit karo duvarlar, küvet ve asma vitrifiye. Ayna gerçek zamanlı yansıma ile hesaplanıyor.',
    cam: [-8470, 20, EYE + 5],
    look: [-8520, -110, 70],
    items: [
      {
        id: 'sink1', name: 'Lavabo & Ayna', pos: [-8551, -27, 95],
        cam: [-8445, -27, 150], look: [-8565, -27, 110],
        text: 'Seramik çanak lavabo, krom batarya ve aynalı duvar.',
        specs: { Lavabo: 'Seramik', Batarya: 'Krom', Ayna: '90 × 120 cm' },
      },
      {
        id: 'tub', name: 'Küvet', pos: [-8520, -120, 60],
        cam: [-8430, 0, 170], look: [-8520, -125, 40],
        text: 'Cam panelli, duvar boyu küvet ve duş.',
        specs: { Cam: 'Füme temperli', Zemin: 'Mozaik' },
      },
      {
        id: 'wc1', name: 'Klozet & Bide', pos: [-8410, -40, 45],
        cam: [-8500, 10, 140], look: [-8410, -60, 35],
        text: 'Duvara asma, gizli rezervuarlı klozet ve bide.',
        specs: { Tip: 'Asma vitrifiye' },
      },
    ],
  },
  {
    id: 'bath2',
    title: 'İkinci Banyo',
    text: 'Mavi-beyaz dama zeminli ikinci banyo. Koridordaki çamaşır makinesi ile hizmet alanı burada toplanıyor.',
    cam: [-8510, 290, EYE + 5],
    look: [-8500, 450, 80],
    items: [
      {
        id: 'sink2', name: 'Lavabo', pos: [-8551, 394, 95],
        cam: [-8460, 394, 150], look: [-8565, 394, 110],
        text: 'İkinci banyodaki asma lavabo ve ayna.',
        specs: { Lavabo: 'Seramik', Batarya: 'Krom' },
      },
      {
        id: 'washer', name: 'Çamaşır Makinesi', pos: [-8413, 218, 55],
        cam: [-8510, 160, 125], look: [-8413, 218, 45],
        text: 'Koridorda, ön yüklemeli füme cam kapaklı çamaşır makinesi.',
        specs: { Tip: 'Önden yüklemeli', Kapasite: '8 kg' },
      },
    ],
  },
  {
    id: 'bed1',
    title: 'Yatak Odası I',
    text: 'Lila duvarlı, pembe yatak örtüsü, çizgili pastel halı ve bitkiyle tatlı bir yatak odası.',
    cam: [-8625, 190, EYE],
    look: [-8850, 380, 60],
    items: [
      {
        id: 'bed-a', name: 'Yatak', pos: [-8852, 400, 60],
        cam: [-8700, 300, 150], look: [-8852, 400, 45],
        text: 'Gül pembesi örtü, hardal çizgili şal ve turkuaz-şeftali yastıklarla açık meşe yatak.',
        specs: { Ölçü: '107 × 186 cm', Çerçeve: 'Açık meşe' },
      },
      {
        id: 'desk-a', name: 'Çalışma Masası', pos: [-8885, 207, 80],
        cam: [-8720, 220, 150], look: [-8885, 207, 70],
        text: 'Pencere kenarında antrasit çalışma masası.',
        specs: { Renk: 'Antrasit' },
      },
      {
        id: 'wardrobe', name: 'Gömme Dolap', pos: [-8610, 370, 150],
        cam: [-8780, 360, 150], look: [-8610, 370, 120],
        text: 'Tavana yakın yükseklikte, beyaz meşe kaplama gömme dolap.',
        specs: { Kaplama: 'Beyaz meşe', Yükseklik: '210 cm' },
      },
    ],
  },
  {
    id: 'bed2',
    title: 'Yatak Odası II',
    text: 'Adaçayı yeşili duvarlar, Memphis desenli halı ve turkuaz şalla ferah bir yatak odası.',
    cam: [-8810, 40, EYE],
    look: [-8650, -70, 55],
    items: [
      {
        id: 'bed-b', name: 'Yatak', pos: [-8660, -37, 60],
        cam: [-8790, 20, 150], look: [-8660, -40, 45],
        text: 'Pembe örtü, turkuaz çizgili şal ve hardal-mercan yastıklarla açık meşe yatak.',
        specs: { Ölçü: '107 × 146 cm', Çerçeve: 'Açık meşe' },
      },
      {
        id: 'desk-b', name: 'Çalışma Köşesi', pos: [-8850, -110, 75],
        cam: [-8760, 20, 150], look: [-8850, -120, 60],
        text: 'Güney penceresinin önünde sandalyeli çalışma köşesi.',
        specs: { Konum: 'Güney penceresi' },
      },
    ],
  },
];

// Odalar arası geçişlerde kameranın duvarlardan geçmemesi için ara noktalar (kapı boşlukları).
export const VIAS = {
  'kitchen>bath1': [[-8345, 100, EYE], [-8390, 88, EYE], [-8470, 95, EYE], [-8500, 55, EYE]],
  'bath1>bath2': [[-8495, 60, EYE], [-8490, 150, EYE], [-8515, 245, EYE]],
  'bath2>bed1': [[-8515, 245, EYE], [-8540, 205, EYE], [-8590, 205, EYE]],
  'bed1>bed2': [[-8575, 205, EYE], [-8540, 150, EYE], [-8545, 90, EYE], [-8610, 85, EYE], [-8720, 65, EYE]],
};
