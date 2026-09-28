> **Note (English):** This is the original product specification, written in Turkish before implementation.
> The code deviates from it in places, deliberately and with reasons — see [docs/DECISIONS.md](../DECISIONS.md).
> Sections about deployment reflect the author's original plan; see [docs/deployment.md](../deployment.md) for
> current instructions. Native mobile/watch apps are not part of this repository.

# Glukoz Takip Paneli — Teknik Şartname (FreeStyle Libre 2 Plus / LibreLinkUp)

> **Bu doküman Claude Code için yazılmıştır.** Projeyi sıfırdan, bu şartnameye birebir uyarak üret. Belirsiz kalan bir nokta olursa en basit ve güvenli seçeneği uygula ve kararını `docs/DECISIONS.md` dosyasına not et. Bu dosyayı proje köküne `SPEC.md` olarak koy; kısa çalışma kurallarını da `CLAUDE.md` içine özetle (bkz. Bölüm 18).

---

## 0. Önemli uyarılar (koda ve arayüze yansıtılmalı)

1. **LibreLinkUp API resmi değildir.** Abbott tarafından belgelenmemiştir; tersine mühendislikle bilinmektedir ve haber verilmeden değişebilir. Ekim 2025'te zorunlu başlıklar değişti ve eski istemciler 403 almaya başladı. Kod, bu tür değişikliklere karşı **tek bir yerde** (LLU istemci modülü) güncellenebilir olmalıdır.
2. **Tıbbi cihaz değildir.** Panel bilgilendirme amaçlıdır. Arayüzde kalıcı bir not: _"Bu panel tedavi kararları için kullanılmamalıdır. Veriler gecikmeli veya eksik olabilir. Alarmlar için resmi uygulamayı kullanın."_
3. **Sağlık verisi = KVKK kapsamında özel nitelikli kişisel veri.** Şifreleme, erişim kontrolü, saklama süresi ve silme hakkı zorunludur (Bölüm 13).
4. Veri akışı: Sensör → (Bluetooth) → hastanın telefonundaki **FreeStyle LibreLink** uygulaması → LibreView bulutu → **LibreLinkUp takipçi (follower) hesabı** → bizim backend. Hastanın kendi LibreLink hesabı ile giriş yapıldığında bağlantı listesi boş döner; **mutlaka ayrı bir LibreLinkUp takipçi hesabı** kullanılmalıdır.

---

## 1. Proje özeti

Bir veya daha fazla hastanın (takip edilen kişinin) Libre 2 Plus glukoz verilerini LibreLinkUp üzerinden periyodik olarak çeken, kendi veritabanında saklayan, uluslararası CGM konsensüs metriklerini hesaplayan ve bunları **kurulabilir bir PWA** üzerinde canlı gösterge, günlük takip ve detaylı raporlar olarak sunan bir web uygulaması.

### Kapsam

- Canlı değer, trend oku, değişim (delta), son güncelleme süresi, sensör kalan gün.
- Günlük görünüm: gün grafiği, olaylar (hipo/hiper), kullanıcı notları (öğün, insülin, egzersiz vb.).
- Raporlar: AGP (Ambulatory Glucose Profile), aralıkta kalma süreleri (TIR/TBR/TAR), GMI, CV, GRI, olay listesi, saat×gün ısı haritası, dönem karşılaştırma, PDF/CSV dışa aktarma.
- Web Push bildirimleri (düşük/yüksek/hızlı düşüş/veri kesintisi/sensör bitişi).
- Çoklu kullanıcı, roller (admin, bakıcı, salt-okunur/doktor), çoklu hasta.
- Geliştirme için **mock mod** (gerçek hesap olmadan sentetik veri).

### Kapsam dışı

- Sensörden doğrudan NFC/Bluetooth okuma (tarayıcıda mümkün değil).
- LibreView'a veri yazma.
- İnsülin dozu önerisi veya herhangi bir tedavi tavsiyesi.

---

## 2. Mimari

```
┌──────────────┐   BLE   ┌──────────────────┐  HTTPS  ┌──────────────────┐
│ Libre 2 Plus │ ──────▶ │ LibreLink (tel.) │ ──────▶ │ LibreView bulutu │
└──────────────┘         └──────────────────┘         └────────┬─────────┘
                                                               │ LibreLinkUp API (resmi değil)
                                                               ▼
┌─────────────────────────────── Bizim sunucu ───────────────────────────────┐
│  ┌──────────────┐   ┌──────────────────┐   ┌──────────────┐                │
│  │ Collector    │──▶│ PostgreSQL       │◀──│ REST API     │── SSE ──┐       │
│  │ (zamanlayıcı)│   │ (okumalar, notlar│   │ (Fastify)    │         │       │
│  └──────┬───────┘   │  metrik önbellek)│   └──────┬───────┘         │       │
│         │           └──────────────────┘          │                 │       │
│         └──────── Alert engine ──▶ Web Push ──────┘                 │       │
└─────────────────────────────────────────────────────────────────────┼──────┘
                                                                      ▼
                                                      ┌──────────────────────┐
                                                      │ PWA (React + Vite)   │
                                                      │ Canlı / Günlük /     │
                                                      │ Raporlar / Ayarlar   │
                                                      └──────────────────────┘
```

**Kurallar**

- Tarayıcı **asla** LibreLinkUp'a doğrudan istek atmaz (CORS + kimlik bilgisi güvenliği). Tüm LLU trafiği backend'dedir.
- Collector ve API aynı Node süreci içinde çalışabilir (tek konteyner), ama modüller ayrık olmalı; ileride ayrı süreçlere bölünebilmeli.
- Veri kaynağı soyut bir arayüzün arkasında olmalı (`GlucoseSource`), böylece ileride Nightscout/Juggluco kaynağı eklenebilir.

---

## 3. Teknoloji yığını

| Katman         | Seçim                                                                   | Not                                                          |
| -------------- | ----------------------------------------------------------------------- | ------------------------------------------------------------ |
| Runtime        | Node.js 22 LTS, TypeScript (strict)                                     |                                                              |
| Paket yönetimi | pnpm workspaces (monorepo)                                              |                                                              |
| Backend        | Fastify 5, Zod (şema/validasyon), pino (log)                            | `fastify-type-provider-zod`                                  |
| ORM / DB       | Prisma + PostgreSQL 16                                                  | Tüm zamanlar `timestamptz` (UTC)                             |
| Zamanlayıcı    | `croner` veya basit `setInterval` tabanlı scheduler                     | Tek instance varsayımı; çoklu instance için PG advisory lock |
| Auth           | Argon2id (şifre), httpOnly cookie içinde oturum (DB'de session tablosu) | JWT yerine sunucu tarafı oturum tercih edilir                |
| Push           | `web-push` (VAPID)                                                      |                                                              |
| Frontend       | React 19 + Vite + TypeScript                                            |                                                              |
| Routing / veri | TanStack Router, TanStack Query                                         |                                                              |
| Stil           | Tailwind CSS 4                                                          | Tasarım token'ları CSS değişkeni olarak                      |
| Grafik         | Apache ECharts (`echarts-for-react`)                                    | AGP bantları ve ısı haritası için uygun                      |
| Tarih          | dayjs (utc, timezone, customParseFormat eklentileri)                    |                                                              |
| PWA            | `vite-plugin-pwa` (Workbox, `injectManifest` stratejisi)                | Push için özel SW gerekir                                    |
| i18n           | `i18next` — varsayılan `tr`, ek olarak `en`                             |                                                              |
| Test           | Vitest, MSW (LLU mock), Playwright (e2e)                                |                                                              |
| Dağıtım        | Docker Compose + Caddy (otomatik HTTPS)                                 |                                                              |

---

## 4. Monorepo yapısı

```
glukoz-panel/
├─ apps/
│  ├─ api/                    # Fastify + collector + alert engine
│  │  ├─ src/
│  │  │  ├─ config/           # env okuma (zod ile doğrulama)
│  │  │  ├─ llu/              # LibreLinkUp istemcisi (TEK yer)
│  │  │  │  ├─ client.ts
│  │  │  │  ├─ types.ts
│  │  │  │  ├─ parse.ts       # zaman damgası, trend eşlemeleri
│  │  │  │  └─ mock.ts        # sentetik veri üreten sahte istemci
│  │  │  ├─ sources/          # GlucoseSource arayüzü + LLU implementasyonu
│  │  │  ├─ collector/        # polling, dedupe, backfill
│  │  │  ├─ metrics/          # saf fonksiyonlar (paylaşılan paketten import)
│  │  │  ├─ alerts/           # kural motoru + web push
│  │  │  ├─ routes/           # REST uçları
│  │  │  ├─ auth/
│  │  │  ├─ crypto/           # AES-256-GCM yardımcıları
│  │  │  └─ server.ts
│  │  └─ prisma/schema.prisma
│  └─ web/                    # React PWA
│     ├─ src/
│     │  ├─ routes/           # sayfalar
│     │  ├─ components/       # grafikler, göstergeler
│     │  ├─ hooks/
│     │  ├─ lib/              # api istemcisi, birim dönüşümü
│     │  ├─ sw.ts             # service worker (Workbox + push)
│     │  └─ i18n/
│     └─ public/icons/
├─ packages/
│  ├─ metrics/                # glukoz metrikleri — saf TS, %100 test kapsamı hedefi
│  └─ shared/                 # ortak tipler, zod şemaları, sabitler
├─ docker/
│  ├─ Caddyfile
│  └─ docker-compose.yml
├─ docs/DECISIONS.md
├─ .env.example
├─ CLAUDE.md
└─ SPEC.md (bu dosya)
```

---

## 5. LibreLinkUp entegrasyonu (KRİTİK)

### 5.1 Sunucular (bölgeler)

Varsayılan olarak global sunucuya giriş yapılır; yanıt bölgesel yönlendirme dönerse ilgili bölgeye tekrar giriş yapılır ve bölge hesaba kaydedilir.

```ts
export const LLU_HOSTS = {
  global: 'https://api.libreview.io',
  us: 'https://api-us.libreview.io',
  eu: 'https://api-eu.libreview.io',
  eu2: 'https://api-eu2.libreview.io',
  de: 'https://api-de.libreview.io',
  fr: 'https://api-fr.libreview.io',
  jp: 'https://api-jp.libreview.io',
  ap: 'https://api-ap.libreview.io',
  au: 'https://api-au.libreview.io',
  ae: 'https://api-ae.libreview.io',
  ca: 'https://api-ca.libreview.io',
  la: 'https://api-la.libreview.io',
} as const;
// Bilinmeyen bir bölge kodu gelirse: `https://api-${region}.libreview.io` dene.
```

### 5.2 Zorunlu başlıklar (Ekim 2025 sonrası)

Tüm isteklerde:

```
accept: application/json
accept-encoding: gzip
cache-control: no-cache
connection: Keep-Alive
content-type: application/json
product: llu.android
version: 4.16.0
```

Kimlik doğrulaması gerektiren isteklerde ek olarak:

```
Authorization: Bearer <authTicket.token>
Account-Id: <sha256(user.id) — 64 karakter küçük harf hex>
```

- `product` ve `version` değerleri **env değişkeninden** okunmalı (`LLU_PRODUCT`, `LLU_VERSION`), varsayılanlar yukarıdaki gibi. API minimum sürümü yükseltirse sadece env değişir.
- Sunucu `status: 920` ve `data.minimumVersion` dönerse: hatayı `LLU_VERSION_TOO_OLD` olarak sınıflandır, `minimumVersion` değerini logla, sistem durum sayfasında ve admin'e bildirimle göster. **Otomatik olarak sürümü yükseltip tekrar dene** (bir kez), başarılı olursa DB'deki ayara yaz.

### 5.3 Uç noktalar

| Metot | Yol                                    | Amaç                                                                                                     |
| ----- | -------------------------------------- | -------------------------------------------------------------------------------------------------------- |
| POST  | `/llu/auth/login`                      | Giriş. Gövde: `{ "email": "...", "password": "..." }`                                                    |
| GET   | `/llu/connections`                     | Takip edilen hastalar + her birinin **son ölçümü** (`glucoseMeasurement`), hedef aralığı, sensör bilgisi |
| GET   | `/llu/connections/{patientId}/graph`   | Son ~12 saatlik geçmiş (`data.graphData[]`), aktif sensörler (`data.activeSensors`), bağlantı detayı     |
| GET   | `/llu/connections/{patientId}/logbook` | Son ~2 haftalık manuel tarama ve alarm kayıtları                                                         |

### 5.4 Giriş akışı

```
login(global)
 ├─ data.redirect === true && data.region  → login(LLU_HOSTS[region]) ; bölgeyi kaydet
 ├─ status === 0 && data.authTicket        → token, expires (unix sn), user.id sakla
 ├─ status === 2                            → LLU_BAD_CREDENTIALS (tekrar deneme YOK)
 ├─ status === 4 (data.step var)            → LLU_ACTION_REQUIRED (ör. kullanım koşulları onayı;
 │                                            yalnızca LibreLinkUp mobil uygulamasından çözülür)
 ├─ status === 920                          → LLU_VERSION_TOO_OLD (5.2)
 └─ HTTP 429 / kilitlenme                   → LLU_RATE_LIMITED (üstel geri çekilme, min 5 dk)
```

- `authTicket` DB'de **şifreli** saklanır; `expires` dolmadan 1 gün önce yeniden giriş yapılır.
- Bazı yanıtlar gövdede yeni bir `ticket` döndürür; varsa token'ı güncelle.
- HTTP 401 alınırsa: bir kez yeniden giriş yap, sonra isteği tekrarla.
- Başarısız girişler art arda **3 kez** olursa hesabı `paused` durumuna al ve admin'e bildir (hesap kilitlenmesini önlemek için).

### 5.5 Referans istemci iskeleti

```ts
import { createHash } from 'node:crypto';

export class LluClient {
  private host: string;
  private token?: string;
  private accountId?: string;

  constructor(
    private opts: {
      email: string;
      password: string;
      region?: string;
      product: string;
      version: string;
    },
  ) {
    this.host = opts.region ? hostFor(opts.region) : LLU_HOSTS.global;
  }

  private baseHeaders() {
    return {
      accept: 'application/json',
      'accept-encoding': 'gzip',
      'cache-control': 'no-cache',
      connection: 'Keep-Alive',
      'content-type': 'application/json',
      product: this.opts.product,
      version: this.opts.version,
    };
  }

  async login(): Promise<LoginResult> {
    const res = await fetch(`${this.host}/llu/auth/login`, {
      method: 'POST',
      headers: this.baseHeaders(),
      body: JSON.stringify({ email: this.opts.email, password: this.opts.password }),
    });
    const json = await res.json();
    if (json?.data?.redirect && json?.data?.region) {
      this.host = hostFor(json.data.region);
      return this.login();
    }
    // status 2/4/920 → tipli hatalar fırlat (5.4)
    this.token = json.data.authTicket.token;
    this.accountId = createHash('sha256').update(json.data.user.id).digest('hex');
    return {
      region: regionOf(this.host),
      userId: json.data.user.id,
      token: this.token!,
      expires: json.data.authTicket.expires,
    };
  }

  private async authed<T>(path: string): Promise<T> {
    const res = await fetch(`${this.host}${path}`, {
      headers: {
        ...this.baseHeaders(),
        authorization: `Bearer ${this.token}`,
        'account-id': this.accountId!,
      },
    });
    // 401 → login + retry once ; 429 → LLU_RATE_LIMITED ; json.status 920 → LLU_VERSION_TOO_OLD
    return res.json() as Promise<T>;
  }

  connections() {
    return this.authed<ConnectionsResponse>('/llu/connections');
  }
  graph(pid: string) {
    return this.authed<GraphResponse>(`/llu/connections/${pid}/graph`);
  }
  logbook(pid: string) {
    return this.authed<LogbookResponse>(`/llu/connections/${pid}/logbook`);
  }
}
```

Tüm yanıtlar **Zod ile doğrulanmalı**, bilinmeyen alanlara tolerans gösterilmeli (`.passthrough()`), kritik alan eksikse hata loglanıp o döngü atlanmalı.

### 5.6 Yanıt alanları (kullanılacak olanlar)

`/llu/connections` → `data[]` öğesi:

```jsonc
{
  "patientId": "uuid",
  "firstName": "…",
  "lastName": "…",
  "targetLow": 70,
  "targetHigh": 180, // hastanın LibreLink'teki hedefleri (mg/dL)
  "uom": 1,
  "sensor": { "sn": "…", "a": 1652400270, "pt": 4 }, // a = aktivasyon (unix saniye)
  "glucoseMeasurement": {
    "FactoryTimestamp": "5/21/2022 1:38:50 PM", // UTC
    "Timestamp": "5/21/2022 3:38:50 PM", // cihazın yerel saati
    "ValueInMgPerDl": 91,
    "TrendArrow": 3,
    "MeasurementColor": 1,
    "GlucoseUnits": 1,
    "Value": 91,
    "isHigh": false,
    "isLow": false,
  },
}
```

`/graph` → `data.graphData[]` aynı ölçüm şeklinde (TrendArrow olmayabilir), `data.activeSensors[]`.
`/logbook` → `data[]` ölçüm şekli + `alarmType`.

### 5.7 Ayrıştırma kuralları (`llu/parse.ts`)

- **Zaman:** `FactoryTimestamp` biçimi `M/D/YYYY h:mm:ss A` (ABD biçimi, İngilizce AM/PM) ve **UTC**'dir. `dayjs.utc(str, 'M/D/YYYY h:mm:ss A', 'en')` ile ayrıştır. Birincil zaman her zaman `FactoryTimestamp`'tır. `Timestamp` sadece bilgi amaçlı `device_local_ts` olarak saklanır.
- **Değer:** Her zaman `ValueInMgPerDl` kullan (tamsayı olarak sakla). `Value` hastanın birimine göredir, kullanma.
- **Trend eşlemesi:**
  | TrendArrow | Kod               | Ok  | Anlam                         |
  | ---------- | ----------------- | --- | ----------------------------- |
  | 1          | `SINGLE_DOWN`     | ↓   | Hızlı düşüş (> 2 mg/dL/dk)    |
  | 2          | `FORTY_FIVE_DOWN` | ↘   | Düşüş (1–2 mg/dL/dk)          |
  | 3          | `FLAT`            | →   | Sabit (< 1 mg/dL/dk)          |
  | 4          | `FORTY_FIVE_UP`   | ↗   | Yükseliş (1–2 mg/dL/dk)       |
  | 5          | `SINGLE_UP`       | ↑   | Hızlı yükseliş (> 2 mg/dL/dk) |
  | 0 / yok    | `NOT_COMPUTABLE`  | –   | Hesaplanamadı                 |
- `MeasurementColor` ve `isHigh/isLow` alanlarına **güvenme**; renklendirme ve sınıflandırmayı kendi eşiklerimizle yap.
- **Sensör ömrü:** Libre 2 Plus için varsayılan **15 gün**. `sensor.a + ömür` ile bitiş zamanını hesapla. Ömür hasta ayarında değiştirilebilir olmalı (Libre 2 için 14).
- `graphData` aralığı ürüne göre değişebilir; **sabit aralık varsayma**. Tüm hesaplamalar 5 dakikalık yeniden örneklemeye dayanır (Bölüm 8.1).

### 5.8 İstek bütçesi (rate limit'e takılmamak için)

| İş                       | Sıklık                                | Not                                         |
| ------------------------ | ------------------------------------- | ------------------------------------------- |
| `connections`            | 60 sn                                 | Tüm hastaların son değeri tek istekte gelir |
| `graph` (hasta başına)   | 15 dk                                 | Geçmiş boşlukları doldurmak için            |
| `graph`                  | Başlangıçta + veri boşluğu tespitinde | Backfill                                    |
| `logbook` (hasta başına) | 6 saatte bir                          |                                             |
| Login                    | Sadece gerekince                      | Asla döngü içinde değil                     |

- Her istekte ±5 sn rastgele kayma (jitter) ekle.
- 429 veya ağ hatasında üstel geri çekilme: 1 dk → 2 → 4 → … → en fazla 30 dk.
- Minimum polling aralığı env ile 60 sn'nin altına **indirilemez** (koda sabit alt sınır koy).

---

## 6. Veri toplama (Collector)

### 6.1 Döngü

1. Aktif her `LluAccount` için geçerli token yoksa giriş yap.
2. `connections` çağır. Her bağlantı için:
   - `Patient` kaydı yoksa oluştur (patientId, ad, hedefler); varsa ad/hedef değişikliklerini güncelle.
   - Sensör seri no değiştiyse yeni `Sensor` kaydı aç, eskisini `ended_at` ile kapat.
   - `glucoseMeasurement` değerini `readings` tablosuna `source='current'` olarak **upsert** et.
3. Yeni okumaları **alert engine**'e ilet (Bölüm 10).
4. Yeni okuma varsa SSE ile bağlı istemcilere yayınla.
5. `collector_runs` tablosuna sonuç, süre ve hata kodunu yaz.

### 6.2 Tekilleştirme

- Benzersiz anahtar: `(patient_id, ts)`; `ts` = `FactoryTimestamp` saniyeye yuvarlanmış UTC.
- Aynı `ts` için birden fazla kaynak gelirse öncelik: `current` > `graph` > `logbook`. Değer farklıysa üst öncelikli kaynağı tut.
- ±30 sn içindeki okumalar aynı okuma sayılabilir (yakın-kopya kontrolü, aynı değer ise atla).

### 6.3 Backfill ve boşluk tespiti

- Uygulama ilk açıldığında veya hasta yeni eklendiğinde `graph` ile son 12 saati çek.
- Son okumadan bu yana > 15 dk geçtiyse ve yeni `current` değer geldiyse `graph` çağırıp aradaki boşluğu doldur.
- 12 saatten uzun kesintiler geri doldurulamaz; bu aralıklar raporda "veri yok" olarak görünür (veri yeterliliği metriğine yansır).
- **Geçmiş veri içe aktarma:** LibreView web sitesinden indirilen CSV dosyasını yüklemek için bir uç nokta ve arayüz sağla (Bölüm 9, `POST /api/patients/:id/import/libreview-csv`). CSV başlık satırı dile göre değişebilir; sütunları esnek eşle (cihaz zaman damgası, kayıt tipi, geçmiş glukoz mg/dL, tarama glukoz mg/dL). İçe aktarılan kayıtlar `source='import'`, öncelik en düşük.

### 6.4 Eşzamanlılık

- Aynı hesap için iki döngü üst üste binmemeli (in-memory mutex + PG advisory lock).
- Uygulama kapanırken (SIGTERM) açık döngünün bitmesini bekle (en fazla 10 sn).

---

## 7. Veritabanı şeması (Prisma taslağı)

```prisma
generator client { provider = "prisma-client-js" }
datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

enum Role { ADMIN CAREGIVER VIEWER }
enum ReadingSource { current graph logbook import }
enum AccountStatus { active paused error }
enum NoteType { meal insulin_rapid insulin_basal exercise medication illness sleep other }

model User {
  id           String   @id @default(uuid())
  email        String   @unique
  passwordHash String
  displayName  String
  role         Role     @default(VIEWER)
  locale       String   @default("tr")
  unit         String   @default("mgdl")    // "mgdl" | "mmol"
  createdAt    DateTime @default(now())
  sessions     Session[]
  access       PatientAccess[]
  pushSubs     PushSubscription[]
  consents     Consent[]
}

model Session {
  id        String   @id            // rastgele 256 bit, cookie'de
  userId    String
  user      User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  expiresAt DateTime
  userAgent String?
  ip        String?
  createdAt DateTime @default(now())
}

model LluAccount {
  id              String        @id @default(uuid())
  label           String
  emailEnc        String        // AES-256-GCM
  passwordEnc     String        // AES-256-GCM
  region          String?
  lluUserId       String?
  tokenEnc        String?
  tokenExpiresAt  DateTime?
  status          AccountStatus @default(active)
  lastError       String?
  failCount       Int           @default(0)
  createdAt       DateTime      @default(now())
  patients        Patient[]
}

model Patient {
  id              String   @id @default(uuid())
  lluPatientId    String
  accountId       String
  account         LluAccount @relation(fields: [accountId], references: [id], onDelete: Cascade)
  firstName       String
  lastName        String
  displayName     String?              // panelde gösterilecek takma ad
  timezone        String   @default("Europe/Istanbul")
  targetLow       Int      @default(70)   // panelin kullandığı hedef (LLU'dan bağımsız düzenlenebilir)
  targetHigh      Int      @default(180)
  lluTargetLow    Int?
  lluTargetHigh   Int?
  sensorLifeDays  Int      @default(15)
  readings        Reading[]
  sensors         Sensor[]
  notes           Note[]
  access          PatientAccess[]
  alertRules      AlertRule[]
  @@unique([accountId, lluPatientId])
}

model PatientAccess {
  userId    String
  patientId String
  user      User    @relation(fields: [userId], references: [id], onDelete: Cascade)
  patient   Patient @relation(fields: [patientId], references: [id], onDelete: Cascade)
  canEdit   Boolean @default(false)     // not ekleme, ayar değiştirme
  @@id([userId, patientId])
}

model Reading {
  id            BigInt        @id @default(autoincrement())
  patientId     String
  patient       Patient       @relation(fields: [patientId], references: [id], onDelete: Cascade)
  ts            DateTime      @db.Timestamptz(3)
  deviceLocalTs String?
  mgdl          Int
  trend         Int?          // 0-5
  source        ReadingSource
  createdAt     DateTime      @default(now())
  @@unique([patientId, ts])
  @@index([patientId, ts(sort: Desc)])
}

model Sensor {
  id          String    @id @default(uuid())
  patientId   String
  patient     Patient   @relation(fields: [patientId], references: [id], onDelete: Cascade)
  serial      String
  productType Int?
  activatedAt DateTime
  expectedEnd DateTime
  endedAt     DateTime?
  @@unique([patientId, serial])
}

model Note {
  id        String   @id @default(uuid())
  patientId String
  patient   Patient  @relation(fields: [patientId], references: [id], onDelete: Cascade)
  authorId  String
  ts        DateTime @db.Timestamptz(3)
  type      NoteType
  carbsG    Int?
  insulinU  Decimal? @db.Decimal(5,2)
  durationMin Int?
  text      String?
  createdAt DateTime @default(now())
  @@index([patientId, ts])
}

model AlertRule {
  id          String  @id @default(uuid())
  patientId   String
  patient     Patient @relation(fields: [patientId], references: [id], onDelete: Cascade)
  kind        String  // urgent_low | low | high | rapid_fall | rapid_rise | stale | sensor_ending
  enabled     Boolean @default(true)
  thresholdMgdl Int?
  sustainMin  Int     @default(0)
  cooldownMin Int     @default(30)
  quietStart  String? // "23:00"
  quietEnd    String? // "07:00" ; urgent_low sessiz saatlerden ETKİLENMEZ
}

model AlertEvent {
  id        String   @id @default(uuid())
  ruleId    String
  patientId String
  firedAt   DateTime @default(now())
  mgdl      Int?
  message   String
  ackBy     String?
  ackAt     DateTime?
  @@index([patientId, firedAt])
}

model PushSubscription {
  id        String  @id @default(uuid())
  userId    String
  user      User    @relation(fields: [userId], references: [id], onDelete: Cascade)
  endpoint  String  @unique
  p256dh    String
  auth      String
  createdAt DateTime @default(now())
}

model CollectorRun {
  id         BigInt   @id @default(autoincrement())
  accountId  String
  startedAt  DateTime
  durationMs Int
  ok         Boolean
  errorCode  String?
  newReadings Int     @default(0)
  @@index([accountId, startedAt(sort: Desc)])
}

model AuditLog {
  id        BigInt   @id @default(autoincrement())
  userId    String?
  action    String   // login, view_report, export_csv, delete_patient_data ...
  targetId  String?
  meta      Json?
  ip        String?
  createdAt DateTime @default(now())
}

model Consent {
  id        String   @id @default(uuid())
  userId    String
  user      User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  version   String
  acceptedAt DateTime @default(now())
}

model Setting {
  key   String @id     // "llu.version", "llu.product" vb. çalışma zamanı ayarları
  value String
}
```

Veri hacmi: dakikada 1 okuma ≈ hasta başına yılda ~525 bin satır; PostgreSQL için sorun değil. İleride gerekirse TimescaleDB hypertable'a geçiş kolay olsun diye `Reading` tablosunu sade tut.

---

## 8. Metrikler (`packages/metrics`) — saf fonksiyonlar

Bu paket I/O yapmaz; girdi `Array<{ ts: number /*ms UTC*/, mgdl: number }>` ve seçenekler alır. **Her fonksiyon için birim testi zorunlu** (bilinen girdi → bilinen çıktı).

### 8.1 Ön işleme: 5 dakikalık yeniden örnekleme

Okuma yoğunluğu değişken (dakikalık `current` + 15 dk'lık `graph` karışık). Doğrudan ortalama almak yoğun dönemleri fazla ağırlıklandırır. Bu yüzden:

1. Zamanı hastanın saat dilimine göre değil, UTC'de 5 dk'lık dilimlere böl.
2. Her dilimdeki okumaların ortalamasını al → dilim değeri.
3. Boş dilimler **doldurulmaz** (interpolasyon yok); sadece grafik çiziminde ≤ 20 dk'lık boşluklar çizgiyle birleştirilebilir, daha uzun boşluklarda çizgi kesilir.
4. Tüm yüzdeler dolu dilim sayısına göre hesaplanır.

### 8.2 Temel istatistikler

| Metrik               | Formül                             | Hedef (bilgi amaçlı gösterim) |
| -------------------- | ---------------------------------- | ----------------------------- |
| Ortalama glukoz      | dilim değerlerinin ortalaması      | –                             |
| SD                   | örneklem standart sapması          | –                             |
| CV (%)               | SD / ortalama × 100                | ≤ %36 (stabil)                |
| GMI (%)              | 3,31 + 0,02392 × ortalama(mg/dL)   | –                             |
| GMI (mmol/mol)       | 12,71 + 4,70587 × ortalama(mmol/L) | –                             |
| Veri yeterliliği (%) | dolu dilim / beklenen dilim × 100  | 14 günde ≥ %70                |
| Min / Maks / Medyan  | –                                  | –                             |

Veri yeterliliği < %70 ise rapor başlığında belirgin bir uyarı göster: "Bu dönemde veri yetersiz; metrikler yanıltıcı olabilir."

### 8.3 Aralıkta kalma (uluslararası konsensüs aralıkları, mg/dL)

| Kod                     | Aralık  | Tip 1/2 genel hedef           |
| ----------------------- | ------- | ----------------------------- |
| `veryLow`               | < 54    | < %1                          |
| `low`                   | 54–69   | < %4 (veryLow dahil toplam)   |
| `inRange` (TIR)         | 70–180  | > %70                         |
| `high`                  | 181–250 | < %25 (veryHigh dahil toplam) |
| `veryHigh`              | > 250   | < %5                          |
| `tightRange` (TITR, ek) | 70–140  | bilgi amaçlı                  |

- Eşikler sabit sabitler olarak `packages/shared` içinde tutulur. Hasta ayarındaki `targetLow/targetHigh` yalnızca **grafikteki hedef bandı** ve "hedefte" sayacı için kullanılır; standart rapor her zaman konsensüs aralıklarıyla da gösterilir.
- Yüzdelerin yanında günlük süre karşılığını da göster (ör. %4 ≈ 58 dk/gün).
- Hedefler "hamilelik", "yaşlı/yüksek risk" profilleri için ayarda seçilebilir önayar (preset) olarak sunulabilir; varsayılan genel profil.

### 8.4 Olay tespiti

- **Hipo seviye 1:** < 70 mg/dL, ardışık ≥ 15 dk. Bitiş: ≥ 70 mg/dL ardışık ≥ 15 dk.
- **Hipo seviye 2:** < 54 mg/dL, ardışık ≥ 15 dk (aynı bitiş kuralı, eşik 54).
- **Uzamış hipo:** < 54 mg/dL, ≥ 120 dk.
- **Hiper:** > 250 mg/dL, ardışık ≥ 15 dk. Bitiş: ≤ 250 ardışık ≥ 15 dk. **Uzamış hiper:** ≥ 120 dk.
- Her olay: başlangıç, bitiş, süre, en uç değer (nadir/zirve), gece mi (00:00–06:00 hasta saatine göre).
- Tüm eşikler/süreler fonksiyon parametresi (varsayılanlar yukarıdaki).

### 8.5 Risk indeksleri

- **GRI (Glycemia Risk Index):** `hipoBileşen = veryLow + 0,8 × low`, `hiperBileşen = veryHigh + 0,5 × high`, `GRI = min(100, 3 × hipoBileşen + 1,6 × hiperBileşen)` (yüzdeler 0–100 cinsinden). Bölgeler: A 0–20, B 20–40, C 40–60, D 60–80, E 80–100. Hipo ve hiper bileşenle birlikte bir GRI ızgarası (x: hipo, y: hiper) grafiği çiz.
- **LBGI / HBGI (Kovatchev):** `f = 1,509 × ((ln mgdl)^1,084 − 5,381)`, `r = 10 × f²`; `LBGI = ortalama(f<0 ? r : 0)`, `HBGI = ortalama(f>0 ? r : 0)`. "Gelişmiş metrikler" bölümünde göster.

### 8.6 AGP (Ambulatory Glucose Profile)

- Seçilen dönemdeki tüm dilim değerlerini **hasta saat dilimine göre günün saatine** yerleştir (15 dk'lık 96 kova).
- Her kova için %5, %25, %50, %75, %95 yüzdelikleri.
- Yüzdelik eğrilerini hafif yumuşat (merkezli 3 kovalık hareketli ortalama, uçlar dairesel).
- Grafik: %5–95 açık bant, %25–75 koyu bant, %50 kalın çizgi, 70 ve 180 yatay referans çizgileri, hedef bandı arka plan.
- Bir kovada < 5 değer varsa o kova için yüzdelik çizme (boşluk bırak).

### 8.7 Diğer analizler

- **Günlük özet:** her gün için ortalama, min, maks, TIR dağılımı, olay sayısı, veri yeterliliği.
- **Günün dilimleri:** Gece (00–06), Sabah (06–12), Öğleden sonra (12–18), Akşam (18–24) için ortalama, TIR, hipo sayısı.
- **Saat × gün ısı haritası:** satır = gün, sütun = saat, hücre = ortalama veya "aralık dışı süre".
- **Haftanın günü:** Pzt–Paz ortalama ve TIR.
- **Dönem karşılaştırma:** seçili dönem vs. önceki eşit dönem; her metrik için fark ve yön (iyileşme yeşil, kötüleşme turuncu; renk tek başına anlam taşımasın, ok/ikon ve metin de kullan).
- **Öğün sonrası analiz:** `meal` tipindeki notlar için öğün öncesi değer (−15..0 dk), 1. ve 2. saat değerleri, zirve ve zirveye kadar geçen süre. Öğün tipine göre (kahvaltı/öğle/akşam — saat aralığından tahmin) ortalamalar.
- **Değişim hızı:** ardışık dilimlerden mg/dL/dk; canlı ekranda delta (son değer − 5 dk önceki) ve 15 dk'lık kaba projeksiyon **gösterme** (tedavi kararına yol açabilir); sadece trend oku ve delta.

### 8.8 Birimler

- Veritabanı ve hesaplamalar daima mg/dL. Gösterimde `mmol/L = mg/dL / 18,0182`, bir ondalık.
- Türkçe sayı biçimi: ondalık ayırıcı virgül (`Intl.NumberFormat('tr-TR')`).

---

## 9. Backend REST API

Tüm uçlar `/api` altında, JSON, Zod ile doğrulanmış. Kimlik: httpOnly + Secure + SameSite=Lax oturum çerezi. Durum değiştiren isteklerde CSRF token (double-submit) zorunlu. Hasta bazlı uçlarda `PatientAccess` kontrolü **her istekte** yapılır.

### Kimlik ve kullanıcı

| Metot                 | Yol                   | Açıklama                                         |
| --------------------- | --------------------- | ------------------------------------------------ |
| POST                  | `/api/auth/login`     | e-posta + şifre; rate limit: IP başına 5/dk      |
| POST                  | `/api/auth/logout`    |                                                  |
| GET                   | `/api/auth/me`        | kullanıcı, rol, tercihler, erişilebilir hastalar |
| PATCH                 | `/api/me/preferences` | birim, dil, tema                                 |
| POST                  | `/api/me/consent`     | KVKK aydınlatma/açık rıza onayı                  |
| GET/POST/PATCH/DELETE | `/api/admin/users`    | sadece ADMIN                                     |

İlk kurulum: DB'de hiç kullanıcı yoksa `/setup` sayfası ilk ADMIN hesabını oluşturur, sonra kapanır.

### LibreLinkUp hesapları (ADMIN)

| Metot  | Yol                            | Açıklama                                         |
| ------ | ------------------------------ | ------------------------------------------------ |
| GET    | `/api/llu-accounts`            | liste (e-posta maskeli: `a***@g***.com`)         |
| POST   | `/api/llu-accounts`            | ekle → hemen test girişi yap, bağlantıları getir |
| POST   | `/api/llu-accounts/:id/test`   | bağlantı testi                                   |
| POST   | `/api/llu-accounts/:id/resume` | `paused` → `active`                              |
| DELETE | `/api/llu-accounts/:id`        | hesap + (onayla) tüm hasta verisi silinir        |

### Hastalar ve veri

| Metot                 | Yol                                                     | Açıklama                                                          |
| --------------------- | ------------------------------------------------------- | ----------------------------------------------------------------- |
| GET                   | `/api/patients`                                         | erişilebilir hastalar + son değer özeti                           |
| PATCH                 | `/api/patients/:id`                                     | takma ad, hedefler, saat dilimi, sensör ömrü                      |
| GET                   | `/api/patients/:id/current`                             | son okuma, trend, delta, yaş (sn), sensör kalan süre, bugünkü TIR |
| GET                   | `/api/patients/:id/readings?from&to&resolution=raw\|5m` | ham veya 5 dk; maks. 31 gün raw                                   |
| GET                   | `/api/patients/:id/day?date=YYYY-MM-DD`                 | günlük görünüm için okumalar + notlar + olaylar + özet            |
| GET                   | `/api/patients/:id/report?from&to`                      | Bölüm 8'deki tüm metrikler tek yanıtta (sunucu hesaplar)          |
| GET                   | `/api/patients/:id/report/compare?from&to`              | önceki eşit dönemle karşılaştırma                                 |
| GET                   | `/api/patients/:id/events?from&to&type`                 | hipo/hiper olay listesi                                           |
| GET                   | `/api/patients/:id/sensors`                             | sensör geçmişi                                                    |
| GET/POST/PATCH/DELETE | `/api/patients/:id/notes`                               | kullanıcı notları                                                 |
| GET                   | `/api/patients/:id/export.csv?from&to`                  | okumalar + notlar CSV (UTF-8 BOM, `;` ayırıcı — Excel TR uyumu)   |
| POST                  | `/api/patients/:id/import/libreview-csv`                | geçmiş veri içe aktarma (multipart, maks. 20 MB)                  |
| DELETE                | `/api/patients/:id/data`                                | KVKK silme — iki aşamalı onay                                     |

### Gerçek zamanlı ve bildirim

| Metot   | Yol                                                  | Açıklama                                                        |
| ------- | ---------------------------------------------------- | --------------------------------------------------------------- |
| GET     | `/api/stream?patientId=`                             | SSE: `reading`, `alert`, `status` olayları; 25 sn'de bir `ping` |
| GET     | `/api/push/vapid-public-key`                         |                                                                 |
| POST    | `/api/push/subscribe` / `DELETE /api/push/subscribe` |                                                                 |
| GET/PUT | `/api/patients/:id/alert-rules`                      | kural listesi/güncelleme                                        |
| POST    | `/api/alerts/:id/ack`                                | uyarıyı onayla                                                  |

### Sistem

| Metot | Yol                  | Açıklama                                                                                     |
| ----- | -------------------- | -------------------------------------------------------------------------------------------- |
| GET   | `/api/health`        | liveness (DB bağlantısı)                                                                     |
| GET   | `/api/system/status` | ADMIN: hesap başına son başarılı çekim, hata kodu, son 24 saat başarı oranı, LLU sürüm ayarı |

Rapor yanıtları `(patientId, from, to, lastReadingTs)` anahtarıyla bellekte 5 dk önbelleğe alınır.

---

## 10. Uyarı motoru ve bildirimler

Her yeni okuma sonrası çalışır. Varsayılan kurallar (hasta eklendiğinde oluşturulur):

| Tür             | Koşul                         | Varsayılan                                                        |
| --------------- | ----------------------------- | ----------------------------------------------------------------- |
| `urgent_low`    | değer < 54                    | açık, bekleme 0 dk, cooldown 15 dk, sessiz saatleri **yok sayar** |
| `low`           | değer < 70, ≥ 10 dk sürerse   | açık, cooldown 30 dk                                              |
| `high`          | değer > 250, ≥ 30 dk sürerse  | açık, cooldown 60 dk                                              |
| `rapid_fall`    | TrendArrow = 1 ve değer < 120 | açık                                                              |
| `rapid_rise`    | TrendArrow = 5                | kapalı                                                            |
| `stale`         | son okumadan beri > 20 dk     | açık, cooldown 60 dk                                              |
| `sensor_ending` | bitişe < 24 saat              | açık, günde 1 kez                                                 |

- Değer normale döndüğünde isteğe bağlı "düzeldi" bildirimi.
- Bildirim: Web Push (başlık: hasta adı + değer + ok; gövde: kısa açıklama; `tag` ile aynı tür tekrarları birleştir; `renotify` sadece `urgent_low` için).
- Push aboneliği 404/410 dönerse DB'den sil.
- Uygulama içi: üstte kırmızı/turuncu şerit, `AlertEvent` listesi, "Onayla" düğmesi.
- **iOS notu:** Web Push yalnızca uygulama ana ekrana eklenmişse (iOS 16.4+) çalışır; ayarlar sayfasında bunu açıklayan yönerge göster.
- Arayüzde açık not: bildirimler buluta ve internet bağlantısına bağlıdır, gecikebilir; resmi uygulamanın alarmlarının yerine geçmez.

---

## 11. Frontend (PWA)

### 11.1 Genel

- Mobil öncelikli, duyarlı (360 px → masaüstü). Masaüstünde sol menü, mobilde alt sekme çubuğu.
- Açık/koyu tema (sistem tercihine uy + manuel seçim).
- Erişilebilirlik: WCAG 2.2 AA kontrast, klavye odak görünür, `prefers-reduced-motion`'a uy, grafiklerin metin özeti (ekran okuyucu için `aria-describedby` ile istatistik özeti).
- Renk anlamları sabit ve tutarlı; **renk tek başına bilgi taşımaz** (ok, etiket, desen de kullan):
  - Çok düşük (< 54): koyu kırmızı · Düşük (54–69): kırmızı · Hedef (70–180): yeşil · Yüksek (181–250): sarı/amber · Çok yüksek (> 250): turuncu.
- Tasarım dili: sade, klinik okunurluk; büyük rakamlar için tabular (eşit genişlikli) rakam özelliği olan bir yazı tipi (ör. Inter veya IBM Plex Sans, `font-variant-numeric: tabular-nums`). Süs amaçlı gradyan, gölge, animasyon yok; tek vurgu canlı değer göstergesi.
- Tüm metinler i18n dosyasında; Türkçe varsayılan, sade dil ("Hedefte kalma süresi" gibi; teknik kısaltmaların yanında açıklaması).

### 11.2 Sayfalar

**`/login`, `/setup`** — Standart form. Hata mesajları ne olduğunu ve ne yapılacağını söyler.

**`/` Canlı (Şimdi)** — hasta seçici (birden fazla hasta varsa üstte)

- Büyük değer + birim + trend oku + delta (`+4 mg/dL / 5 dk`).
- Son güncelleme: "2 dk önce". > 5 dk amber, > 15 dk kırmızı "Veri gecikiyor" şeridi.
- Grafik: 3 / 6 / 12 / 24 saat seçimi; hedef bandı; eşik çizgileri; notlar grafikte ikon olarak; dokunma/üzerine gelince değer ipucu.
- Bugün kartları: TIR yığılmış yatay çubuk, ortalama, hipo sayısı, en düşük/en yüksek.
- Sensör kartı: seri no, başlangıç, kalan süre ilerleme çubuğu ("11 gün 4 saat kaldı").
- Hızlı not ekle düğmesi (öğün/insülin/egzersiz).
- SSE ile anlık güncellenir; SSE koparsa 60 sn'lik polling'e düş.

**`/gunluk` Günlük takip**

- Tarih seçici (önceki/sonraki gün okları, takvim).
- 00:00–24:00 gün grafiği; olay aralıkları gölgeli; notlar zaman çizelgesi.
- Günlük özet: ortalama, TIR dağılımı, olaylar, veri yeterliliği, GMI (tek gün için "gösterge amaçlı" etiketiyle).
- "Başka bir günle karşılaştır": ikinci günün eğrisini kesikli çizgiyle üst üste çiz.
- Not listesi: ekle/düzenle/sil (yetkiye göre).

**`/raporlar` Raporlar**

- Dönem: 7 / 14 (varsayılan) / 30 / 90 gün / özel aralık.
- Üstte uyarı alanı (veri yeterliliği < %70).
- Bölümler (sırayla):
  1. **Özet**: ortalama, GMI, CV, veri yeterliliği, sensör kullanım günü; önceki döneme göre fark okları.
  2. **Aralıkta kalma**: 5 segmentli dikey yığılmış çubuk (AGP raporu stili) + her segment için yüzde, süre/gün ve hedef karşılaştırması (✓/✗ ikonlu).
  3. **AGP grafiği** (Bölüm 8.6).
  4. **Günlük profiller**: dönemdeki her gün için küçük çoklu grafikler (14 günlük ızgara), her birinin altında TIR mini çubuğu.
  5. **Olaylar**: hipo/hiper tablosu (tarih, başlangıç, süre, en uç değer, gece mi); filtre ve sıralama. Özet: toplam, gece hipoları, ortalama süre.
  6. **Günün dilimleri** ve **haftanın günü** karşılaştırma çubukları.
  7. **Saat × gün ısı haritası**.
  8. **Öğün sonrası analiz** (not girilmişse).
  9. **Gelişmiş**: GRI ızgarası, LBGI/HBGI, SD, medyan, IQR, TITR.
- Dışa aktarma: **PDF** ve **CSV**. PDF için ayrı bir yazdırma rotası `/raporlar/yazdir?patient&from&to` oluştur: A4 dikey, yazdırma CSS'i, başlıkta hasta adı + dönem + oluşturma tarihi + uyarı notu. Kullanıcı "PDF indir" dediğinde bu sayfa açılır ve `window.print()` tetiklenir (sunucuda headless tarayıcı bağımlılığı olmadan). İsteğe bağlı faz 2: sunucuda Playwright ile PDF üretimi (`REPORT_PDF_SERVER=true`).

**`/kayitlar` Notlar & Logbook** — Kullanıcı notları ve LLU logbook taramaları tek zaman çizelgesinde; filtreler.

**`/sensorler`** — Sensör geçmişi tablosu, her sensör için kullanım süresi, veri yeterliliği, erken biten sensör işareti.

**`/uyarilar`** — Uyarı geçmişi + kural ayarları (eşik, süre, cooldown, sessiz saatler) + "Bildirimleri aç" (izin iste, abone ol, test bildirimi gönder).

**`/ayarlar`** — Birim, dil, tema; hasta ayarları (takma ad, hedef aralık, saat dilimi, sensör ömrü); ADMIN için: kullanıcılar ve erişimler, LibreLinkUp hesapları, sistem durumu, veri silme, CSV içe aktarma.

**Kalıcı alt bilgi** — "Tedavi kararları için kullanılmamalıdır" notu + son veri çekme zamanı.

### 11.3 Grafik bileşenleri (ECharts)

- `GlucoseLineChart` (zaman serisi, hedef bandı, eşikler, boşlukta kesilen çizgi, not işaretçileri, olay gölgeleri)
- `AgpChart` (yüzdelik bantları)
- `TirStackedBar` (dikey ve yatay varyant)
- `DailySmallMultiples`
- `HourDayHeatmap`
- `GriGrid`
- `ComparisonBars`
  Hepsi birim (mg/dL ↔ mmol/L) ve temaya duyarlı; mobilde dokunma ile ipucu.

### 11.4 Durum yönetimi

- Sunucu durumu TanStack Query ile; `current` sorgusu SSE olaylarıyla `setQueryData` üzerinden güncellenir.
- Seçili hasta ve dönem URL arama parametrelerinde (paylaşılabilir/yer imi eklenebilir bağlantılar).

---

## 12. PWA gereksinimleri

- `manifest.webmanifest`: `name: "Glukoz Paneli"`, `short_name`, `lang: "tr"`, `display: "standalone"`, `start_url: "/"`, tema/arka plan renkleri, 192/512 px ikonlar + **maskable** ikon, `shortcuts` (Canlı, Not ekle).
- Service worker (`injectManifest`):
  - Uygulama kabuğu ön belleğe alınır (precache).
  - `GET /api/patients/*/current` ve `/day`, `/report`: **NetworkFirst**, 5 sn zaman aşımı, önbellekte son yanıt. Çevrimdışıyken üstte "Çevrimdışı — son veriler HH:mm itibarıyla" şeridi.
  - Kimlik ve POST/PATCH/DELETE istekleri **asla** önbelleğe alınmaz.
  - `push` ve `notificationclick` işleyicileri (tıklayınca ilgili hastanın Canlı sayfasını aç/odakla).
  - Yeni sürüm hazır olduğunda "Güncelleme var — yenile" bildirimi (`registerType: 'prompt'`).
- Kurulum teşviki: `beforeinstallprompt` ile Ayarlar'da "Uygulamayı yükle"; iOS için "Paylaş → Ana Ekrana Ekle" yönergesi.
- Lighthouse PWA kontrolleri geçmeli; performans ≥ 90 (mobil).

---

## 13. Güvenlik ve KVKK

- **Kimlik bilgisi şifreleme:** LLU e-posta, şifre ve token → AES-256-GCM, rastgele 12 bayt IV, `v1:iv:tag:ciphertext` (base64) biçimi. Ana anahtar `ENCRYPTION_KEY` (32 bayt, base64) env'den; anahtar rotasyonu için sürüm öneki kullanılır. Anahtar asla DB'de veya logda olmaz.
- **Şifreler:** Argon2id (memoryCost ≥ 19 MiB, timeCost ≥ 2). Minimum 10 karakter.
- **Oturum:** 256 bit rastgele ID, 14 gün kayar süre, çıkışta ve şifre değişiminde tüm oturumlar silinir.
- **HTTP güvenliği:** `@fastify/helmet` (sıkı CSP: `default-src 'self'`), `@fastify/rate-limit`, CORS kapalı (aynı origin), HSTS (Caddy).
- **Log hijyeni:** pino `redact` ile `password`, `token`, `authorization`, `account-id`, `email` alanları maskelenir. Glukoz değerleri loglanmaz (sadece sayılar/istatistikler).
- **Yetkilendirme:** Her hasta uç noktasında `PatientAccess` kontrolü; VIEWER not ekleyemez ve ayar değiştiremez. IDOR testleri yazılmalı.
- **Denetim kaydı:** giriş, rapor görüntüleme, dışa aktarma, veri silme, hesap değişiklikleri `AuditLog`'a.
- **KVKK:**
  - İlk girişte aydınlatma metni + açık rıza onayı (sürümlü, `Consent` tablosu). Metin `docs/kvkk-aydinlatma.md` şablonu olarak oluşturulsun; hukuki metin kullanıcı tarafından doldurulacak (yer tutucularla).
  - Saklama süresi env ile (`DATA_RETENTION_DAYS`, varsayılan 730); günlük bir iş eski okumaları siler.
  - Hasta verisini tam dışa aktarma (CSV) ve tam silme.
  - Sunucunun Türkiye'de (veya yurtdışı aktarım şartları karşılanarak) barındırılması önerisi README'de belirtilsin.
- **Yedekleme:** `pg_dump` günlük, şifreli, 14 gün saklama (compose içinde ayrı bir servis veya cron betiği).

---

## 14. Yapılandırma (`.env.example`)

```dotenv
NODE_ENV=production
APP_URL=https://glukoz.example.com
PORT=3000
DATABASE_URL=postgresql://glukoz:CHANGE_ME@db:5432/glukoz

# 32 bayt base64:  openssl rand -base64 32
ENCRYPTION_KEY=
SESSION_SECRET=

# LibreLinkUp
LLU_PRODUCT=llu.android
LLU_VERSION=4.16.0
LLU_POLL_SECONDS=60            # koddaki alt sınır: 60
LLU_GRAPH_MINUTES=15
LLU_LOGBOOK_HOURS=6
LLU_MOCK=false                 # true: sentetik veri, gerçek API çağrısı yok

# Web Push (npx web-push generate-vapid-keys)
VAPID_PUBLIC_KEY=
VAPID_PRIVATE_KEY=
VAPID_SUBJECT=mailto:admin@example.com

DEFAULT_TIMEZONE=Europe/Istanbul
DATA_RETENTION_DAYS=730
REPORT_PDF_SERVER=false
LOG_LEVEL=info
```

Uygulama açılışta env'i Zod ile doğrular; eksik/yanlışsa açık bir hata mesajıyla başlamaz.

---

## 15. Mock mod (geliştirme için zorunlu)

`LLU_MOCK=true` olduğunda `llu/mock.ts` gerçek istemciyle **aynı arayüzü** uygular:

- 2 sahte hasta (ör. "Deneme Hasta A", "Deneme Hasta B").
- Gerçekçi sentetik eğri: 110 mg/dL taban + öğün tepeleri (08:00, 13:00, 19:30; +60..+120, 2–3 saatte sönümlenen), gece hafif düşüş, rastgele gürültü (±5), haftada 2–3 hipo olayı, ara sıra 30–90 dk veri boşluğu.
- Trend oku son 15 dk eğimden türetilir.
- Sensör 15 günlük; biri 1 gün içinde bitecek şekilde (uyarı testi için).
- Başlangıçta 90 günlük geçmiş veriyi DB'ye yükleyen bir seed betiği (`pnpm seed:mock`).
- Hata simülasyonu için env: `LLU_MOCK_FAIL=none|401|429|920|network`.

---

## 16. Test stratejisi

- **`packages/metrics`:** Vitest; her metrik için elle hesaplanmış küçük veri setleri; sınır durumları (boş dizi, tek değer, tümü aralık dışı, gece yarısını kesen olaylar, Europe/Istanbul dışında saat dilimi olan hasta). Hedef kapsama ≥ %95.
- **LLU istemcisi:** MSW ile kaydedilmiş örnek yanıtlar (`fixtures/llu/*.json`): başarılı giriş, bölge yönlendirmesi, status 2, status 4, status 920, 401 sonrası yeniden giriş, 429. Başlıkların (özellikle `Account-Id` = sha256(user.id) hex ve `version`) doğru gönderildiği doğrulanmalı.
- **Ayrıştırma:** `FactoryTimestamp` biçimleri (tek/çift haneli ay-gün-saat, AM/PM, 12:xx AM/PM uç durumları).
- **Collector:** tekilleştirme, backfill, sensör değişimi, eşzamanlılık kilidi.
- **API:** yetkilendirme (başka hastanın verisine erişim 403), CSRF, rate limit.
- **E2E (Playwright, mock modda):** kurulum → giriş → canlı ekranda değer görünür → rapor sayfası AGP çizilir → PDF yazdırma sayfası açılır → not ekleme.
- CI: GitHub Actions — lint (ESLint + Prettier), typecheck, unit, e2e (Postgres servis konteyneri ile).

---

## 17. Dağıtım

`docker/docker-compose.yml`:

- `db`: postgres:16-alpine, kalıcı volume, healthcheck.
- `app`: çok aşamalı Dockerfile; web derlemesi statik dosya olarak API tarafından (`@fastify/static`) sunulur; başlangıçta `prisma migrate deploy`. Root olmayan kullanıcı.
- `caddy`: otomatik HTTPS, `APP_URL` alan adı, gzip/zstd, HSTS; SSE için tamponlamayı kapat (`flush_interval -1`).
- `backup`: günlük `pg_dump` + şifreleme.

README'de: sunucu gereksinimleri (1 vCPU / 1 GB RAM yeterli), kurulum adımları, VAPID ve şifreleme anahtarı üretimi, LibreLinkUp takipçi hesabı nasıl açılır (hastanın LibreLink uygulamasından "Bağlantılı uygulamalar/Paylaş" ile davet → takipçi LibreLinkUp uygulamasında kabul ve kullanım koşullarını onaylama), sorun giderme tablosu (Bölüm 19).

---

## 18. Geliştirme fazları ve kabul kriterleri

Claude Code her fazı bitirince testleri çalıştırsın, `docs/DECISIONS.md`'yi güncellesin ve bir sonraki faza geçsin.

| Faz                             | İçerik                                                                             | Kabul kriteri                                                         |
| ------------------------------- | ---------------------------------------------------------------------------------- | --------------------------------------------------------------------- |
| **1. İskelet**                  | monorepo, lint/format, env doğrulama, Prisma şeması, Docker Compose, `/api/health` | `docker compose up` ile sistem ayağa kalkar, health 200               |
| **2. Metrik paketi**            | Bölüm 8 tümü + testler                                                             | kapsama ≥ %95, tüm testler yeşil                                      |
| **3. LLU istemcisi + mock**     | Bölüm 5 ve 15                                                                      | MSW testleri yeşil; mock modda 2 hasta ve 90 gün veri                 |
| **4. Collector**                | Bölüm 6                                                                            | mock modda her dakika yeni okuma; tekrar yok; boşluk backfill çalışır |
| **5. Auth + API**               | Bölüm 9, 13                                                                        | yetkilendirme testleri yeşil; setup akışı çalışır                     |
| **6. Frontend: Canlı + Günlük** | Bölüm 11.2 ilk iki sayfa, SSE                                                      | canlı değer ≤ 70 sn içinde güncellenir                                |
| **7. Raporlar + dışa aktarma**  | Raporlar sayfası, yazdırma rotası, CSV                                             | 14 günlük mock raporda tüm bölümler çizilir; PDF A4'te taşmasız       |
| **8. PWA + bildirimler**        | Bölüm 10, 12                                                                       | Lighthouse PWA geçer; test bildirimi Android Chrome'da ulaşır         |
| **9. Sertleştirme**             | yedekleme, saklama işi, audit, e2e, README                                         | tüm e2e yeşil; README'deki adımlarla temiz kurulum başarılı           |

### `CLAUDE.md` içeriği (özet olarak oluştur)

- Paket yöneticisi pnpm; komutlar: `pnpm dev`, `pnpm test`, `pnpm lint`, `pnpm typecheck`, `pnpm seed:mock`.
- LibreLinkUp ile ilgili her şey yalnızca `apps/api/src/llu/` içinde; başka yerden doğrudan `fetch` ile LLU çağrısı yapılmaz.
- Metrik hesapları yalnızca `packages/metrics` içinde ve saf fonksiyon; frontend metrik hesaplamaz, API'den alır (istisna: grafik için birim dönüşümü).
- Veritabanında glukoz daima mg/dL tamsayı, zaman daima UTC.
- Geliştirmede daima `LLU_MOCK=true`; gerçek hesapla test sadece manuel ve kısa süreli.
- Kişisel/sağlık verisini, token'ları, şifreleri asla loglama veya test fixture'larına gerçek veri koyma.
- Kullanıcıya görünen metinler i18n dosyalarında, Türkçe.

---

## 19. Sorun giderme tablosu (README'ye ve sistem durum sayfasına)

| Belirti / kod                             | Olası neden                                                                                | Çözüm                                                                            |
| ----------------------------------------- | ------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------- |
| HTTP 403, `status: 920`, `minimumVersion` | `LLU_VERSION` eski                                                                         | Env/ayar sürümünü `minimumVersion` değerine yükselt (otomatik deneme de yapılır) |
| HTTP 400 `RequiredHeaderMissing`          | `Account-Id` başlığı yok                                                                   | İstemcinin sha256(user.id) başlığını gönderdiğini kontrol et                     |
| `status: 2`                               | Yanlış e-posta/şifre                                                                       | Bilgileri LibreLinkUp mobil uygulamasında doğrula                                |
| `status: 4` / `step`                      | Bekleyen kullanım koşulları/gizlilik onayı                                                 | LibreLinkUp mobil uygulamasına girip onayla                                      |
| Bağlantı listesi boş                      | Hastanın kendi hesabı girilmiş ya da davet kabul edilmemiş                                 | Ayrı takipçi hesabı kullan, daveti kabul et                                      |
| HTTP 429 / kilitlenme                     | Çok sık istek veya çok fazla hatalı giriş                                                  | Geri çekilme bekle; polling aralığını artır                                      |
| Veri 15+ dk gecikiyor                     | Hastanın telefonu çevrimdışı, LibreLink kapalı/pil optimizasyonu, sensör Bluetooth kopması | Hastanın telefonunu kontrol et; LibreLink için pil optimizasyonunu kapat         |
| Sensör değerleri boşluklu                 | Telefon–sensör mesafesi, Bluetooth kesintisi                                               | Geçmiş 12 saate kadar otomatik doldurulur; daha uzunsa CSV içe aktarma           |

---

## 20. Bilinen riskler

1. **API değişikliği:** Abbott başlıkları/uç noktaları yeniden değiştirebilir. Azaltma: tek modül, env'den sürüm, otomatik 920 algılama, admin bildirimi, sistem durum sayfası. Topluluk projelerini (nightscout-connect, pylibrelinkup, libre-link-up-api-client vb.) takip et.
2. **Kullanım koşulları:** Resmi olmayan API kullanımı Abbott koşullarıyla çelişebilir; kişisel/aile kullanımı dışında (ticari, çok kullanıcılı hizmet) hukuki değerlendirme gerekir.
3. **Veri gecikmesi:** Değerler hastanın telefonunun buluta yükleme sıklığına bağlıdır; birkaç dakikalık gecikme normaldir.
4. **Tıbbi sorumluluk:** Panel bir tıbbi cihaz değildir; ticari dağıtımda tıbbi cihaz yazılımı mevzuatı değerlendirilmelidir.
