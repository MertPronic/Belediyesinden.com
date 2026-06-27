/**
 * Kurumsal / Yardım / Yasal statik sayfa içerikleri (footer linkleri).
 * /[bolum]/[sayfa] dynamic route buradan içerik çeker.
 */
export interface StatikSayfa {
  bolum: string;
  baslik: string;
  breadcrumb: string;
  paragraflar: string[];
}

export const SAYFALAR: Record<string, StatikSayfa> = {
  // Kurumsal
  'kurumsal/hakkimizda': {
    bolum: 'Kurumsal',
    baslik: 'Hakkımızda',
    breadcrumb: 'Hakkımızda',
    paragraflar: [
      'Belediyesinden.com, belediyelerin satış, kiralama, işletme hakkı devri ve gelir getirici varlıklarını dijital ortamda yönettiği; elektronik açık artırma ve varlık yönetimi platformudur.',
      'Platformumuz, 2886 sayılı Devlet İhale Kanunu çerçevesinde şeffaf, erişilebilir ve denetlenebilir ihale süreçleri sunar. Her belediye kendi markalı portalında yayın yapar; vatandaşlar ve yatırımcılar tek çatı altında tüm ilanlara erişir.',
      'Amacımız; kamu kaynaklarının etkin kullanımını sağlamak, ihale süreçlerini dijitalleştirerek şeffaflığı artırmak ve vatandaş ile belediye arasında güvenli, izlenebilir bir köprü kurmaktır.',
    ],
  },
  'kurumsal/vizyon': {
    bolum: 'Kurumsal',
    baslik: 'Vizyon & Misyon',
    breadcrumb: 'Vizyon & Misyon',
    paragraflar: [
      'Vizyonumuz: Türkiye genelindeki tüm belediyelerin ihale ve varlık süreçlerini dijitalleştiren, tek standart ve şeffaflıkta bir ulusal e-ihale altyapısı olmak.',
      'Misyonumuz: 2886 ve KVKK mevzuatına tam uyumlu, güvenli ve erişilebilir bir platformla belediyelere operational verimlilik, vatandaşa kolaylık ve güven sağlamak.',
      'Değerlerimiz: şeffaflık, erişilebilirlik, güvenlik ve süreklilik.',
    ],
  },
  'kurumsal/iletisim': {
    bolum: 'Kurumsal',
    baslik: 'İletişim',
    breadcrumb: 'İletişim',
    paragraflar: [
      'Platformla ilgili sorularınız için belediyenizin iletişim bilgilerini kullanabilir veya aşağıdaki kanallardan bize ulaşabilirsiniz.',
      'E-posta: destek@belediyesinden.com',
      'İhale içerikleri ve başvurular belediyenin kendi portalı üzerinden yürütülür; her belediyenin iletişim bilgileri kendi alt alanında yayındadır.',
    ],
  },
  // Yardım
  'yardim/sss': {
    bolum: 'Yardım',
    baslik: 'Sıkça Sorulan Sorular',
    breadcrumb: 'SSS',
    paragraflar: [
      'İhaleye nasıl katılırım? — İlan detayından "Teklif Ver"e tıklayın; Keycloak ile giriş yapın, KVKK onayı ile başvurun, teminat e-dekontunu yükleyin ve encümen onayından sonra teklif verebilirsiniz.',
      'Teminat nasıl iade edilir? — İhale sonuçlandıktan sonra, katılmayanlar ve kazanan hariç katılımcıların teminatı otomatik olarak iade planlanır.',
      'Canlı teklif nasıl çalışır? — Teklifler sunucu üzerinden doğrulanır (server-authoritative); son ana yakın tekliflerde süre otomatik uzatılır (anti-snipping).',
    ],
  },
  'yardim/sikayet': {
    bolum: 'Yardım',
    baslik: 'Şikayet & Öneri',
    breadcrumb: 'Şikayet & Öneri',
    paragraflar: [
      'İhale süreçleriyle ilgili şikayet ve itirazlarınızı ilgili belediyenin encümenine iletebilirsiniz. Platform üzerinden açılan tüm işlemler denetlenebilir audit kayıtlarıyla izlenir.',
      'Teknik sorunlar için destek@belediyesinden.com adresine yazabilirsiniz.',
    ],
  },
  'yardim/destek': {
    bolum: 'Yardım',
    baslik: 'Canlı Destek',
    breadcrumb: 'Canlı Destek',
    paragraflar: [
      'Çalışma saatleri içinde platformla ilgili teknik destek sağlanmaktadır. İhale içerikleri ve belediye işlemleri için ilgili belediyenin kendi iletişim kanallarını kullanınız.',
      'E-posta: destek@belediyesinden.com',
    ],
  },
  // Yasal
  'yasal/kullanim': {
    bolum: 'Yasal',
    baslik: 'Kullanım Koşulları',
    breadcrumb: 'Kullanım Koşulları',
    paragraflar: [
      'Bu platformu kullanarak, elektronik ihale süreçlerine katılım kurallarını kabul etmiş olursunuz. Tüm teklifler bağlayıcıdır ve 2886 sayılı Kanun kapsamındadır.',
      'Platforma sağlanan bilgilerin doğruluğundan kullanıcı sorumludur. Hileli veya yanıltıcı bilgi verilmesi yasal işlem doğurur.',
    ],
  },
  'yasal/kvkk': {
    bolum: 'Yasal',
    baslik: 'KVKK Aydınlatma Metni',
    breadcrumb: 'KVKK',
    paragraflar: [
      '6698 sayılı Kişisel Verilerin Korunması Kanunu kapsamında, kimlik ve iletişim bilgileriniz; başvuru, teminat ve ihale sürecinin yürütülmesi ile denetimi amacıyla işlenir.',
      'Verileriniz mevzuat gereği saklanır ve ilgili süre sonunda imha edilir. Açık rıza vermediğiniz takdirde verileriniz yalnızca zorunlu hallerde işlenir.',
      'KVKK kapsamındaki haklarınız (erişim, düzeltme, silme) için ilgili belediyeye veya kvkk@belediyesinden.com adresine başvurabilirsiniz.',
    ],
  },
  'yasal/gizlilik': {
    bolum: 'Yasal',
    baslik: 'Gizlilik Politikası',
    breadcrumb: 'Gizlilik',
    paragraflar: [
      'Kişisel verileriniz KVKK ve gizlilik politikamız kapsamında korunur. Veriler üçüncü taraflarla paylaşılmaz, yalnızca ihale süreci için gerekli servis sağlayıcılarla (ödeme, kimlik doğrulama) mevzuat ölçüsünde paylaşılır.',
    ],
  },
  'yasal/cerez': {
    bolum: 'Yasal',
    baslik: 'Çerez Politikası',
    breadcrumb: 'Çerez',
    paragraflar: [
      'Platform, oturum yönetimi ve kullanıcı deneyimi için çerezler kullanır. Kimlik doğrulama (oturum) çerezleri zorunludur; analitik çerezler yalnızca açık rızanızla kullanılır.',
    ],
  },
};
