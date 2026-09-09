# 📱 LowBrowser Mobile (Android) - Kapsamlı Sürüm Güncelleme Notları & Özellik Kataloğu

**Sürüm:** `v1.2.0-Mobile (Latest)`  
**Geliştirici:** `billythestudent`  
**Mimari:** Capacitor + Native Android WebView + HTML5/ES6 Ultra Performans Motoru

---

## 🌟 1. Öne Çıkan Ana Yenilikler & Mobil Özellikler (v1.2.0)

### ☄️ 1. Çevrimdışı Siber Göktaşı Avcısı (Asteroid Blaster Mobile)
* İnternet bağlantısı koptuğunda veya menüden açılabilen dokunmatik kontrollü retro uzay savaşı oyunu.

### 🍪 2. Otomatik Çerez ve GDPR Reddedici (*"I Don't Care About Cookies"*)
* Web sitelerindeki can sıkıcı çerez onay pencerelerini otomatik reddedip kapatan akıllı mobil kalkan.

### 📖 3. Temiz Kitap Okuma Modu (Distraction-Free Reader)
* Makale ve haber sayfalarını reklamsız, menüsüz, AMOLED karanlık ve ferah kitap formatına dönüştürme.

### 🔄 4. Uygulama İçi Otomatik Güncelleme Sistemi
* Menüden tek dokunuşla en son APK paketini denetleme ve doğrudan indirme desteği.

### 👆 1. Alt Çubuğu Kaydırarak Sekme Geçişi (Swipe Tab Switching)
* Alt gezinme çubuğu üzerinde parmağınızı sağa veya sola kaydırarak açık sekmeler arasında animasyonlu ve anında geçiş yapma.
* Hızlı sekme geçişlerinde anlık bildirim balonu (*Toast*) ile sayfa başlığını gösterme.

### 🔄 2. Aşağı Çekip Yenileme (Pull to Refresh)
* Sayfanın en üstündeyken aşağı doğru kaydırarak modern neon halka animasyonuyla sayfayı yenileme.
* Yatay ve çapraz parmak hareketlerini ayırt eden yön hassasiyet filtresi (`distY > distX`).
* Modallar veya menüler açıkken yanlışlıkla tetiklenmeyi engelleyen akıllı çakışma önleyici.

### 🔊 3. Yapay Zeka Sesli Makale Okuyucu (Text-to-Speech Web Reader)
* Web makalelerini ve haberlerini yerleşik Türkçe ses motoruyla sesli okuma.
* Alt tarafa yerleşen mini kontrol paneli: Oynat, Duraklat, Durdur ve Kapat butonları.
* Sekme kapatıldığında veya sayfa değiştiğinde otomatik temizleme ve bellek tasarrufu.

### 📷 4. Dahili QR Kod Tarayıcı
* Menüden tek tıkla kamera akışını açarak QR kod okutma ve siteye doğrudan gitme.
* Arka plana atıldığında kamera donanımını otomatik kapatan pil ve gizlilik koruyucu.

### 🔒 5. Gizli Sekme PIN Kilidi & Tuş Takımı
* Gizli sekmeleri parola korumasına alma.
* 4 haneli dinamik PIN tuş takımı, dot animasyonları ve şifre doğrulama (Varsayılan: `0000`).

### ➕ 6. Ana Sayfada Hızlı Sekme Açma Butonları
* Başlangıç ekranında arama kutusunun hemen altında yer alan iki ergonomik buton:
  * **`+ Yeni Sekme`**: Hızlıca yeni bir normal sekme açar.
  * **`🕶️ Gizli Sekme`**: Anında iz bırakmayan yeni bir gizli sekme başlatır.

### 🕒 7. Gelişmiş Tarama Geçmişi (History) & Tekil Silme
* Ziyaret edilen tüm web sitelerini ve yapılan aramaları zaman damgasıyla (`17:10`) saklar.
* Tekil kayıt silme kırmızı **`✕`** butonu ve tek tıkla **"Tümünü Temizle"** desteği.
* Geçmişteki herhangi bir kayda dokunarak doğrudan o adrese gitme.

### 🦁 8. Mobil Veri İçe Aktarma Sihirbazı
* Brave, Chrome veya Edge tarayıcılarından dışa aktarılmış `.html` yer imi dosyalarını doğrudan telefona yükleme ve kaydetme.

---

## 🎨 2. Mobil Ergonomi & Arayüz İyileştirmeleri

* **Geniş ve Rahat 3 Nokta Menüsü:**
  * Üst kısma sabitlenen **"Menü & Hızlı Araçlar"** başlığı ve **`✕`** kapatma butonu.
  * *Yeni Sekme, Gizli Sekme, Yer İmleri, Geçmiş, İndirilenler, Sayfada Bul* butonları **3'lü geniş, başparmakla kolay dokunulabilir** kart düzenine yükseltildi.
  * Menü içeriği telefonun ana ekranından bağımsız, son derece akıcı şekilde aşağı-yukarı kaydırılabilir (`.sheet-scroll-body`).
* **Büyük & Net Dokunmatik Simgeler:**
  * Alt gezinme çubuğu simgeleri **`22px`** netliğe yükseltildi; dokunmatik geri bildirimler optimize edildi.
* **Android Donanım Geri Tuşu Önceliği:**
  * Telefonun altındaki geri tuşuna basıldığında önce açık olan modallar (QR Kamera, PIN Kilidi, Menü, Geçmiş, TTS Çubuğu) kapatılır; modal yoksa web sayfasında geri gidilir.

---

## 🛡️ 3. Mobil Güvenlik & Performans

* 🛡️ **Mobil Reklam Engelleyici:** Mobil veri tasarrufu sağlayan gömülü reklam filtresi.
* 🌙 **Zorunlu AMOLED Karanlık Mod:** Tüm web sitelerini gerçek siyah arka plana dönüştürerek pil tasarrufu sağlar.
* ⚡ **RAM & Pil Tasarrufu Modu:** Boştaki sekmeleri uyutur ve bellek çöpünü temizler.
* 💻 **Masaüstü Sitesi İste:** Web sitelerini bilgisayar görünümünde açma toggle'ı.
