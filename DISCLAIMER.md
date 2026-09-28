# Disclaimer

**Please read this before installing, running or relying on Glukoz Panel.**
_Türkçesi aşağıdadır — [Türkçe](#sorumluluk-reddi-türkçe)._

## 1. Not a medical device

Glukoz Panel is **not a medical device** and has **not been reviewed, cleared or approved** by any regulatory
authority (such as the FDA, the EU notified bodies under MDR, or the Turkish Medicines and Medical Devices
Agency, TİTCK).

- It is intended for **informational and educational purposes only**.
- **Do not use it to make treatment decisions** (e.g. insulin dosing, food intake, driving) and do not use it
  as a replacement for your official CGM app, its alarms, or a fingerstick blood glucose meter.
- Values can be **delayed, missing, duplicated or wrong**. They depend on the patient's phone uploading to the
  manufacturer's cloud, on an unofficial API (see §2), on your server and on your network.
- **Alerts and push notifications can be late or never arrive.** They are not a substitute for the official
  app's alarms.
- The trend, "projection" and "trend between two points" features are simple **mathematical (linear)
  extrapolations** of past values. They ignore meals, insulin, exercise, illness and sensor lag.
- Report metrics (TIR, GMI, CV, GRI, AGP …) follow published consensus definitions (see
  [docs/metrics.md](docs/metrics.md)) but are **not validated clinical tools**. Discuss results with your
  healthcare professional.

**If you feel unwell, or a reading does not match how you feel, check with a fingerstick meter and follow your
healthcare professional's instructions. In an emergency, call your local emergency number.**

## 2. Unofficial LibreLinkUp API

- This project reads data through the **LibreLinkUp** service using an **undocumented, unofficial API** that the
  community has reverse-engineered. It is not provided, documented, endorsed or supported by Abbott.
- The API may **change or stop working at any time without notice** (this has happened before, e.g. mandatory
  header changes in October 2025).
- Using an unofficial API **may conflict with Abbott's / LibreView's terms of use**. You are responsible for
  checking the terms that apply to you and for using the software only with accounts you own or are explicitly
  authorised to use (e.g. a family member who invited you as a LibreLinkUp follower).
- Do not use this project to offer a commercial or multi-tenant service without obtaining your own legal advice.
- Excessive polling can get accounts rate-limited or locked. The software enforces a minimum polling interval
  of 60 seconds; do not remove that safeguard.

## 3. Trademarks and affiliation

FreeStyle Libre, LibreLink, LibreLinkUp and LibreView are trademarks of **Abbott** (or its affiliates).
All other product names, logos and brands are the property of their respective owners.

**This project is independent and is not affiliated with, endorsed by, sponsored by or connected to Abbott,
Nightscout, or any other company or project mentioned in this repository.** Names are used only to describe
compatibility.

## 4. Privacy, data protection and your responsibility as an operator

Glucose readings are **health data** — a special category of personal data under the EU GDPR (Art. 9) and the
Turkish Personal Data Protection Law (KVKK, No. 6698, Art. 6).

If you run an instance, **you are the data controller** for the data it processes. You are responsible for:
lawful basis and explicit consent, informing users, securing the server, backups, retention and deletion,
cross-border transfer rules, and answering data-subject requests. The software provides tools that help
(encryption of stored credentials, access control, consent tracking, retention job, export and deletion), but
**using them correctly is your responsibility**. See [docs/privacy.md](docs/privacy.md).

The KVKK notice in [docs/kvkk-aydinlatma.md](docs/kvkk-aydinlatma.md) is a **template, not legal advice**.

## 5. No warranty

This software is licensed under the GNU Affero General Public License v3.0 or later. As stated in the license
(sections 15 and 16), it is provided **"AS IS", WITHOUT WARRANTY OF ANY KIND**, and in no event shall the
authors or copyright holders be liable for any damages arising from its use. You use it **at your own risk**.

---

## Sorumluluk reddi (Türkçe)

**Glukoz Paneli'ni kurmadan, çalıştırmadan veya ona güvenmeden önce lütfen okuyun.**

### 1. Tıbbi cihaz değildir

Glukoz Paneli bir **tıbbi cihaz değildir**; hiçbir düzenleyici kurum (FDA, AB MDR onaylanmış kuruluşları, Türkiye
İlaç ve Tıbbi Cihaz Kurumu — TİTCK vb.) tarafından **incelenmemiş veya onaylanmamıştır**.

- Yalnızca **bilgilendirme ve eğitim amaçlıdır**.
- **Tedavi kararları için kullanmayın** (insülin dozu, yemek, araç kullanma vb.); resmî CGM uygulamasının, onun
  alarmlarının veya parmak ucu kan şekeri ölçüm cihazının yerine kullanmayın.
- Değerler **gecikmeli, eksik, tekrarlı veya hatalı** olabilir. Hastanın telefonunun üreticinin bulutuna veri
  göndermesine, resmî olmayan bir API'ye (bkz. §2), sunucunuza ve ağınıza bağlıdır.
- **Uyarılar ve anlık bildirimler gecikebilir ya da hiç gelmeyebilir.** Resmî uygulamanın alarmlarının yerini
  tutmaz.
- Eğilim, "öngörü" ve "iki nokta arası eğilim" özellikleri geçmiş değerlerin basit **matematiksel (doğrusal)
  uzatmasıdır**; öğün, insülin, egzersiz, hastalık ve sensör gecikmesini hesaba katmaz.
- Rapor metrikleri (TIR, GMI, CV, GRI, AGP …) yayımlanmış konsensüs tanımlarını izler (bkz.
  [docs/metrics.md](docs/metrics.md)) ancak **doğrulanmış klinik araçlar değildir**. Sonuçları sağlık
  profesyonelinizle değerlendirin.

**Kendinizi iyi hissetmiyorsanız veya bir değer hissettiğinizle uyuşmuyorsa parmak ucu ölçümüyle kontrol edin ve
sağlık profesyonelinizin talimatlarına uyun. Acil durumda 112'yi arayın.**

### 2. Resmî olmayan LibreLinkUp API'si

- Bu proje verileri **LibreLinkUp** hizmetinden, topluluğun tersine mühendislikle çözdüğü **belgelenmemiş, resmî
  olmayan bir API** üzerinden okur. Abbott tarafından sağlanmaz, belgelenmez, onaylanmaz veya desteklenmez.
- API **her an haber verilmeden değişebilir veya çalışmayı bırakabilir** (daha önce oldu; ör. Ekim 2025'teki
  zorunlu başlık değişikliği).
- Resmî olmayan bir API'nin kullanımı **Abbott / LibreView kullanım koşullarıyla çelişebilir**. Size uygulanan
  koşulları kontrol etmek ve yazılımı yalnızca size ait ya da açıkça kullanma yetkiniz olan hesaplarla (ör. sizi
  LibreLinkUp takipçisi olarak davet eden bir aile üyesi) kullanmak sizin sorumluluğunuzdadır.
- Kendi hukuki değerlendirmenizi yaptırmadan bu projeyle ticari veya çok kiracılı bir hizmet sunmayın.
- Aşırı sık sorgulama hesapların kısıtlanmasına veya kilitlenmesine yol açabilir. Yazılım en az 60 saniyelik
  sorgulama aralığını zorunlu kılar; bu korumayı kaldırmayın.

### 3. Markalar ve bağlantı

FreeStyle Libre, LibreLink, LibreLinkUp ve LibreView, **Abbott**'un (veya iştiraklerinin) ticari markalarıdır. Diğer
tüm ürün adları, logolar ve markalar sahiplerine aittir.

**Bu proje bağımsızdır; Abbott, Nightscout veya bu depoda adı geçen başka herhangi bir şirket ya da projeyle
bağlantılı değildir, onlar tarafından onaylanmamış veya desteklenmemiştir.** Adlar yalnızca uyumluluğu
açıklamak için kullanılır.

### 4. Gizlilik, veri koruma ve işletmeci olarak sorumluluğunuz

Glukoz ölçümleri **sağlık verisidir**: AB GDPR (md. 9) ve 6698 sayılı KVKK (md. 6) kapsamında özel nitelikli kişisel
veridir.

Bir kurulum işletiyorsanız, işlenen veriler için **veri sorumlusu sizsiniz**. Hukuki dayanak ve açık rıza,
aydınlatma, sunucu güvenliği, yedekleme, saklama ve silme, yurt dışına aktarım kuralları ve ilgili kişi
başvuruları sizin sorumluluğunuzdadır. Yazılım yardımcı araçlar sunar (kayıtlı kimlik bilgilerinin şifrelenmesi,
erişim kontrolü, onay kaydı, saklama süresi işi, dışa aktarma ve silme), ancak **bunları doğru kullanmak sizin
sorumluluğunuzdadır**. Bkz. [docs/privacy.md](docs/privacy.md).

[docs/kvkk-aydinlatma.md](docs/kvkk-aydinlatma.md) içindeki KVKK metni bir **şablondur, hukuki tavsiye değildir**.

### 5. Garanti yoktur

Bu yazılım GNU Affero Genel Kamu Lisansı v3.0 veya sonraki sürümleriyle lisanslanmıştır. Lisansta belirtildiği
gibi (15. ve 16. bölümler) **"OLDUĞU GİBİ", HİÇBİR GARANTİ OLMAKSIZIN** sunulur ve yazarlar ya da telif hakkı
sahipleri kullanımından doğan hiçbir zarardan sorumlu tutulamaz. **Kullanım riski size aittir.** (Bağlayıcı olan
lisansın İngilizce metnidir.)
