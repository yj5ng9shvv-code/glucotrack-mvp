export const ABOUT_LOCALES = [
  "en", "ru", "pl", "de", "fr", "es", "it", "uk", "pt", "nl",
  "sv", "no", "da", "fi", "cs", "sk", "ro", "bg", "hu", "tr",
  "el", "he", "ar", "hi", "id", "vi", "th", "zh", "ja", "ko"
];

const localized = {
  en: ["About GlukoTrack", "Smart diabetes control in one app.", "GlukoTrack is a multilingual diabetes diary with an AI assistant, SOS card, family monitoring, geolocation, data sync and privacy tools.", "Smart assistant for everyday diabetes self-management"],
  ru: ["О GlukoTrack", "Умный контроль диабета в одном приложении.", "GlukoTrack — многоязычный дневник диабета с ИИ-помощником, SOS-карточкой, семейным мониторингом, геолокацией, синхронизацией данных и инструментами конфиденциальности.", "Умный помощник для ежедневного контроля диабета"],
  pl: ["O GlukoTrack", "Inteligentna kontrola cukrzycy w jednej aplikacji.", "GlukoTrack to wielojęzyczny dziennik cukrzycy z asystentem AI, kartą SOS, monitoringiem rodzinnym, geolokalizacją, synchronizacją danych i narzędziami prywatności.", "Inteligentny pomocnik do codziennej samokontroli cukrzycy"],
  de: ["Über GlukoTrack", "Intelligente Diabeteskontrolle in einer App.", "GlukoTrack ist ein mehrsprachiges Diabetes-Tagebuch mit KI-Assistent, SOS-Karte, Familienmonitoring, Standortfreigabe, Datensynchronisierung und Datenschutzwerkzeugen.", "Intelligenter Begleiter für die tägliche Diabetes-Selbstkontrolle"],
  fr: ["À propos de GlukoTrack", "Le suivi intelligent du diabète dans une seule application.", "GlukoTrack est un journal du diabète multilingue avec assistant IA, carte SOS, suivi familial, géolocalisation, synchronisation des données et outils de confidentialité.", "Assistant intelligent pour l’autosurveillance quotidienne du diabète"],
  es: ["Acerca de GlukoTrack", "Control inteligente de la diabetes en una sola aplicación.", "GlukoTrack es un diario multilingüe de diabetes con asistente de IA, tarjeta SOS, seguimiento familiar, geolocalización, sincronización de datos y herramientas de privacidad.", "Asistente inteligente para el autocontrol diario de la diabetes"],
  it: ["Informazioni su GlukoTrack", "Controllo intelligente del diabete in un’unica app.", "GlukoTrack è un diario del diabete multilingue con assistente AI, scheda SOS, monitoraggio familiare, geolocalizzazione, sincronizzazione dei dati e strumenti per la privacy.", "Assistente intelligente per l’autocontrollo quotidiano del diabete"],
  uk: ["Про GlukoTrack", "Розумний контроль діабету в одному застосунку.", "GlukoTrack — багатомовний щоденник діабету з ШІ-помічником, SOS-карткою, сімейним моніторингом, геолокацією, синхронізацією даних та інструментами приватності.", "Розумний помічник для щоденного самоконтролю діабету"],
  pt: ["Sobre o GlukoTrack", "Controlo inteligente da diabetes numa só aplicação.", "GlukoTrack é um diário multilingue de diabetes com assistente de IA, cartão SOS, monitorização familiar, geolocalização, sincronização de dados e ferramentas de privacidade.", "Assistente inteligente para o autocontrolo diário da diabetes"],
  nl: ["Over GlukoTrack", "Slimme diabetescontrole in één app.", "GlukoTrack is een meertalig diabetesdagboek met AI-assistent, SOS-kaart, gezinsmonitoring, geolocatie, gegevenssynchronisatie en privacytools.", "Slimme assistent voor dagelijkse diabeteszelfzorg"],
  sv: ["Om GlukoTrack", "Smart diabeteskontroll i en app.", "GlukoTrack är en flerspråkig diabetesdagbok med AI-assistent, SOS-kort, familjeövervakning, geolokalisering, datasynkronisering och integritetsverktyg.", "Smart assistent för daglig egenkontroll av diabetes"],
  no: ["Om GlukoTrack", "Smart diabeteskontroll i én app.", "GlukoTrack er en flerspråklig diabetesdagbok med AI-assistent, SOS-kort, familieovervåking, geolokasjon, datasynkronisering og personvernverktøy.", "Smart assistent for daglig egenkontroll av diabetes"],
  da: ["Om GlukoTrack", "Smart diabeteskontrol i én app.", "GlukoTrack er en flersproget diabetesdagbog med AI-assistent, SOS-kort, familieovervågning, geolokation, datasynkronisering og privatlivsværktøjer.", "Smart assistent til daglig egenkontrol af diabetes"],
  fi: ["Tietoa GlukoTrackista", "Älykäs diabeteksen seuranta yhdessä sovelluksessa.", "GlukoTrack on monikielinen diabetespäiväkirja, jossa on AI-avustaja, SOS-kortti, perheseuranta, sijainnin jakaminen, tietojen synkronointi ja tietosuojatyökalut.", "Älykäs apu päivittäiseen diabeteksen omahoitoon"],
  cs: ["O GlukoTrack", "Chytrá kontrola diabetu v jedné aplikaci.", "GlukoTrack je vícejazyčný diabetický deník s AI asistentem, SOS kartou, rodinným sledováním, geolokací, synchronizací dat a nástroji soukromí.", "Chytrý pomocník pro každodenní sebekontrolu diabetu"],
  sk: ["O GlukoTrack", "Inteligentná kontrola diabetu v jednej aplikácii.", "GlukoTrack je viacjazyčný diabetický denník s AI asistentom, SOS kartou, rodinným monitorovaním, geolokáciou, synchronizáciou dát a nástrojmi súkromia.", "Inteligentný pomocník na každodennú sebakontrolu diabetu"],
  ro: ["Despre GlukoTrack", "Control inteligent al diabetului într-o singură aplicație.", "GlukoTrack este un jurnal multilingv pentru diabet cu asistent AI, card SOS, monitorizare familială, geolocație, sincronizare de date și instrumente de confidențialitate.", "Asistent inteligent pentru autocontrolul zilnic al diabetului"],
  bg: ["За GlukoTrack", "Интелигентен контрол на диабета в едно приложение.", "GlukoTrack е многоезичен дневник за диабет с AI асистент, SOS карта, семеен мониторинг, геолокация, синхронизация на данни и инструменти за поверителност.", "Интелигентен помощник за ежедневен самоконтрол на диабета"],
  hu: ["A GlukoTrackről", "Okos diabéteszkontroll egyetlen alkalmazásban.", "A GlukoTrack többnyelvű diabétesznapló AI-asszisztenssel, SOS-kártyával, családi megfigyeléssel, helymegosztással, adatszinkronizálással és adatvédelmi eszközökkel.", "Okos segítő a mindennapi diabétesz-önellenőrzéshez"],
  tr: ["GlukoTrack Hakkında", "Tek uygulamada akıllı diyabet kontrolü.", "GlukoTrack; AI asistanı, SOS kartı, aile takibi, konum paylaşımı, veri senkronizasyonu ve gizlilik araçları olan çok dilli bir diyabet günlüğüdür.", "Günlük diyabet öz yönetimi için akıllı yardımcı"],
  el: ["Σχετικά με το GlukoTrack", "Έξυπνος έλεγχος διαβήτη σε μία εφαρμογή.", "Το GlukoTrack είναι ένα πολύγλωσσο ημερολόγιο διαβήτη με βοηθό AI, κάρτα SOS, οικογενειακή παρακολούθηση, γεωεντοπισμό, συγχρονισμό δεδομένων και εργαλεία απορρήτου.", "Έξυπνος βοηθός για καθημερινή αυτοδιαχείριση διαβήτη"],
  he: ["על GlukoTrack", "ניהול חכם של סוכרת באפליקציה אחת.", "GlukoTrack הוא יומן סוכרת רב-לשוני עם עוזר AI, כרטיס SOS, מעקב משפחתי, שיתוף מיקום, סנכרון נתונים וכלי פרטיות.", "עוזר חכם לניהול יומיומי של סוכרת"],
  ar: ["حول GlukoTrack", "تحكم ذكي بالسكري في تطبيق واحد.", "GlukoTrack يوميات متعددة اللغات للسكري مع مساعد ذكاء اصطناعي وبطاقة SOS ومتابعة عائلية ومشاركة الموقع ومزامنة البيانات وأدوات الخصوصية.", "مساعد ذكي للمتابعة اليومية للسكري"],
  hi: ["GlukoTrack के बारे में", "एक ही ऐप में स्मार्ट डायबिटीज नियंत्रण.", "GlukoTrack AI सहायक, SOS कार्ड, परिवार निगरानी, जियोलोकेशन, डेटा सिंक और गोपनीयता टूल वाला बहुभाषी डायबिटीज डायरी है।", "रोज़ाना डायबिटीज स्व-प्रबंधन के लिए स्मार्ट सहायक"],
  id: ["Tentang GlukoTrack", "Kontrol diabetes cerdas dalam satu aplikasi.", "GlukoTrack adalah buku harian diabetes multibahasa dengan asisten AI, kartu SOS, pemantauan keluarga, geolokasi, sinkronisasi data, dan alat privasi.", "Asisten cerdas untuk kendali diabetes harian"],
  vi: ["Giới thiệu GlukoTrack", "Kiểm soát tiểu đường thông minh trong một ứng dụng.", "GlukoTrack là nhật ký tiểu đường đa ngôn ngữ với trợ lý AI, thẻ SOS, theo dõi gia đình, định vị, đồng bộ dữ liệu và công cụ quyền riêng tư.", "Trợ lý thông minh cho tự quản lý tiểu đường hằng ngày"],
  th: ["เกี่ยวกับ GlukoTrack", "ควบคุมเบาหวานอย่างชาญฉลาดในแอปเดียว", "GlukoTrack คือสมุดบันทึกเบาหวานหลายภาษาพร้อมผู้ช่วย AI การ์ด SOS การติดตามครอบครัว ตำแหน่งที่ตั้ง การซิงค์ข้อมูล และเครื่องมือความเป็นส่วนตัว", "ผู้ช่วยอัจฉริยะสำหรับการดูแลเบาหวานประจำวัน"],
  zh: ["关于 GlukoTrack", "一个应用中的智能糖尿病管理。", "GlukoTrack 是多语言糖尿病日记，包含 AI 助手、SOS 卡、家庭监测、地理位置、数据同步和隐私工具。", "用于日常糖尿病自我管理的智能助手"],
  ja: ["GlukoTrack について", "ひとつのアプリでスマートな糖尿病管理。", "GlukoTrack は、AIアシスタント、SOSカード、家族モニタリング、位置情報、データ同期、プライバシーツールを備えた多言語の糖尿病日記です。", "毎日の糖尿病セルフケアを支えるスマートアシスタント"],
  ko: ["GlukoTrack 소개", "하나의 앱에서 스마트한 당뇨 관리.", "GlukoTrack은 AI 도우미, SOS 카드, 가족 모니터링, 위치 공유, 데이터 동기화 및 개인정보 도구를 갖춘 다국어 당뇨 일지입니다.", "매일의 당뇨 자가 관리를 돕는 스마트 도우미"]
};

const labels = {
  en: ["What is GlukoTrack", "Main benefits", "AI assistant", "SOS card", "Diabetes diary", "Family monitoring", "Geolocation", "30 languages", "Referral program", "Sync", "Privacy", "Medical notice"],
  ru: ["Что такое GlukoTrack", "Главные преимущества", "ИИ-помощник", "SOS-карточка", "Дневник диабета", "Семейный мониторинг", "Геолокация", "30 языков", "Реферальная программа", "Синхронизация", "Конфиденциальность", "Медицинское предупреждение"],
  pl: ["Czym jest GlukoTrack", "Główne korzyści", "Asystent AI", "Karta SOS", "Dziennik cukrzycy", "Monitoring rodzinny", "Geolokalizacja", "30 języków", "Program poleceń", "Synchronizacja", "Prywatność", "Informacja medyczna"],
  de: ["Was ist GlukoTrack", "Wichtigste Vorteile", "KI-Assistent", "SOS-Karte", "Diabetes-Tagebuch", "Familienmonitoring", "Standortfreigabe", "30 Sprachen", "Empfehlungsprogramm", "Synchronisierung", "Datenschutz", "Medizinischer Hinweis"],
  fr: ["Qu’est-ce que GlukoTrack", "Avantages principaux", "Assistant IA", "Carte SOS", "Journal du diabète", "Suivi familial", "Géolocalisation", "30 langues", "Programme de parrainage", "Synchronisation", "Confidentialité", "Avertissement médical"],
  es: ["Qué es GlukoTrack", "Ventajas principales", "Asistente de IA", "Tarjeta SOS", "Diario de diabetes", "Seguimiento familiar", "Geolocalización", "30 idiomas", "Programa de referidos", "Sincronización", "Privacidad", "Aviso médico"],
  it: ["Che cos’è GlukoTrack", "Vantaggi principali", "Assistente AI", "Scheda SOS", "Diario del diabete", "Monitoraggio familiare", "Geolocalizzazione", "30 lingue", "Programma referral", "Sincronizzazione", "Privacy", "Avviso medico"],
  uk: ["Що таке GlukoTrack", "Головні переваги", "ШІ-помічник", "SOS-картка", "Щоденник діабету", "Сімейний моніторинг", "Геолокація", "30 мов", "Реферальна програма", "Синхронізація", "Приватність", "Медичне попередження"]
};

Object.assign(labels, {
  pt: ["O que é o GlukoTrack", "Principais benefícios", "Assistente de IA", "Cartão SOS", "Diário da diabetes", "Monitorização familiar", "Geolocalização", "30 idiomas", "Programa de referências", "Sincronização", "Privacidade", "Aviso médico"],
  nl: ["Wat is GlukoTrack", "Belangrijkste voordelen", "AI-assistent", "SOS-kaart", "Diabetesdagboek", "Gezinsmonitoring", "Geolocatie", "30 talen", "Verwijzingsprogramma", "Synchronisatie", "Privacy", "Medische waarschuwing"],
  sv: ["Vad är GlukoTrack", "Viktigaste fördelar", "AI-assistent", "SOS-kort", "Diabetesdagbok", "Familjeövervakning", "Geolokalisering", "30 språk", "Värvningsprogram", "Synkronisering", "Integritet", "Medicinsk varning"],
  no: ["Hva er GlukoTrack", "Viktigste fordeler", "AI-assistent", "SOS-kort", "Diabetesdagbok", "Familieovervåking", "Geolokasjon", "30 språk", "Verveprogram", "Synkronisering", "Personvern", "Medisinsk advarsel"],
  da: ["Hvad er GlukoTrack", "Vigtigste fordele", "AI-assistent", "SOS-kort", "Diabetesdagbog", "Familieovervågning", "Geolokation", "30 sprog", "Henvisningsprogram", "Synkronisering", "Privatliv", "Medicinsk advarsel"],
  fi: ["Mikä GlukoTrack on", "Tärkeimmät hyödyt", "AI-avustaja", "SOS-kortti", "Diabetespäiväkirja", "Perheseuranta", "Sijainti", "30 kieltä", "Suositteluohjelma", "Synkronointi", "Tietosuoja", "Lääketieteellinen huomautus"],
  cs: ["Co je GlukoTrack", "Hlavní výhody", "AI asistent", "SOS karta", "Diabetický deník", "Rodinné sledování", "Geolokace", "30 jazyků", "Doporučovací program", "Synchronizace", "Soukromí", "Lékařské upozornění"],
  sk: ["Čo je GlukoTrack", "Hlavné výhody", "AI asistent", "SOS karta", "Diabetický denník", "Rodinné monitorovanie", "Geolokácia", "30 jazykov", "Referenčný program", "Synchronizácia", "Súkromie", "Lekárske upozornenie"],
  ro: ["Ce este GlukoTrack", "Beneficii principale", "Asistent AI", "Card SOS", "Jurnal de diabet", "Monitorizare familială", "Geolocație", "30 de limbi", "Program de recomandări", "Sincronizare", "Confidențialitate", "Avertisment medical"],
  bg: ["Какво е GlukoTrack", "Основни предимства", "AI асистент", "SOS карта", "Дневник за диабет", "Семеен мониторинг", "Геолокация", "30 езика", "Реферална програма", "Синхронизация", "Поверителност", "Медицинско предупреждение"],
  hu: ["Mi a GlukoTrack", "Fő előnyök", "AI-asszisztens", "SOS-kártya", "Diabétesznapló", "Családi megfigyelés", "Helymegosztás", "30 nyelv", "Ajánlói program", "Szinkronizálás", "Adatvédelem", "Orvosi figyelmeztetés"],
  tr: ["GlukoTrack nedir", "Başlıca avantajlar", "AI asistanı", "SOS kartı", "Diyabet günlüğü", "Aile takibi", "Konum paylaşımı", "30 dil", "Referans programı", "Senkronizasyon", "Gizlilik", "Tıbbi uyarı"],
  el: ["Τι είναι το GlukoTrack", "Κύρια οφέλη", "Βοηθός AI", "Κάρτα SOS", "Ημερολόγιο διαβήτη", "Οικογενειακή παρακολούθηση", "Γεωεντοπισμός", "30 γλώσσες", "Πρόγραμμα παραπομπών", "Συγχρονισμός", "Απόρρητο", "Ιατρική προειδοποίηση"],
  he: ["מהו GlukoTrack", "יתרונות מרכזיים", "עוזר AI", "כרטיס SOS", "יומן סוכרת", "מעקב משפחתי", "מיקום", "30 שפות", "תוכנית הפניות", "סנכרון", "פרטיות", "אזהרה רפואית"],
  ar: ["ما هو GlukoTrack", "الفوائد الرئيسية", "مساعد AI", "بطاقة SOS", "يوميات السكري", "المتابعة العائلية", "الموقع الجغرافي", "30 لغة", "برنامج الإحالة", "المزامنة", "الخصوصية", "تنبيه طبي"],
  hi: ["GlukoTrack क्या है", "मुख्य लाभ", "AI सहायक", "SOS कार्ड", "डायबिटीज डायरी", "परिवार निगरानी", "जियोलोकेशन", "30 भाषाएँ", "रेफरल कार्यक्रम", "सिंक", "गोपनीयता", "चिकित्सकीय सूचना"],
  id: ["Apa itu GlukoTrack", "Manfaat utama", "Asisten AI", "Kartu SOS", "Buku harian diabetes", "Pemantauan keluarga", "Geolokasi", "30 bahasa", "Program referensi", "Sinkronisasi", "Privasi", "Peringatan medis"],
  vi: ["GlukoTrack là gì", "Lợi ích chính", "Trợ lý AI", "Thẻ SOS", "Nhật ký tiểu đường", "Theo dõi gia đình", "Định vị", "30 ngôn ngữ", "Chương trình giới thiệu", "Đồng bộ", "Quyền riêng tư", "Cảnh báo y tế"],
  th: ["GlukoTrack คืออะไร", "ประโยชน์หลัก", "ผู้ช่วย AI", "การ์ด SOS", "สมุดบันทึกเบาหวาน", "การติดตามครอบครัว", "ตำแหน่งที่ตั้ง", "30 ภาษา", "โปรแกรมแนะนำ", "การซิงค์", "ความเป็นส่วนตัว", "คำเตือนทางการแพทย์"],
  zh: ["什么是 GlukoTrack", "主要优势", "AI 助手", "SOS 卡", "糖尿病日记", "家庭监测", "地理位置", "30 种语言", "推荐计划", "同步", "隐私", "医疗提示"],
  ja: ["GlukoTrack とは", "主な利点", "AIアシスタント", "SOSカード", "糖尿病日記", "家族モニタリング", "位置情報", "30言語", "紹介プログラム", "同期", "プライバシー", "医療上の注意"],
  ko: ["GlukoTrack이란", "주요 장점", "AI 도우미", "SOS 카드", "당뇨 일지", "가족 모니터링", "위치 정보", "30개 언어", "추천 프로그램", "동기화", "개인정보", "의료 고지"]
});

const fallbackLabels = labels.en;
const starts = {
  en: ["Start using", "Explore features", "Download app"],
  ru: ["Начать использовать", "Узнать о возможностях", "Скачать приложение"],
  pl: ["Zacznij używać", "Poznaj funkcje", "Pobierz aplikację"],
  de: ["Jetzt starten", "Funktionen ansehen", "App herunterladen"],
  fr: ["Commencer", "Voir les fonctions", "Télécharger l’application"],
  es: ["Empezar", "Ver funciones", "Descargar la app"],
  it: ["Inizia", "Scopri le funzioni", "Scarica l’app"],
  uk: ["Почати", "Дізнатися про функції", "Завантажити застосунок"]
};

Object.assign(starts, {
  pt: ["Começar a usar", "Ver funcionalidades", "Transferir aplicação"],
  nl: ["Beginnen", "Functies bekijken", "App downloaden"],
  sv: ["Börja använda", "Se funktioner", "Ladda ner appen"],
  no: ["Kom i gang", "Se funksjoner", "Last ned app"],
  da: ["Kom i gang", "Se funktioner", "Hent app"],
  fi: ["Aloita käyttö", "Tutustu toimintoihin", "Lataa sovellus"],
  cs: ["Začít používat", "Zobrazit funkce", "Stáhnout aplikaci"],
  sk: ["Začať používať", "Zobraziť funkcie", "Stiahnuť aplikáciu"],
  ro: ["Începeți", "Vedeți funcțiile", "Descărcați aplicația"],
  bg: ["Започнете", "Вижте функциите", "Изтеглете приложението"],
  hu: ["Használat kezdése", "Funkciók megtekintése", "Alkalmazás letöltése"],
  tr: ["Kullanmaya başla", "Özellikleri gör", "Uygulamayı indir"],
  el: ["Ξεκινήστε", "Δείτε τις λειτουργίες", "Λήψη εφαρμογής"],
  he: ["התחל להשתמש", "הצג תכונות", "הורד אפליקציה"],
  ar: ["ابدأ الاستخدام", "استكشف الميزات", "حمّل التطبيق"],
  hi: ["उपयोग शुरू करें", "सुविधाएँ देखें", "ऐप डाउनलोड करें"],
  id: ["Mulai gunakan", "Lihat fitur", "Unduh aplikasi"],
  vi: ["Bắt đầu sử dụng", "Xem tính năng", "Tải ứng dụng"],
  th: ["เริ่มใช้งาน", "ดูคุณสมบัติ", "ดาวน์โหลดแอป"],
  zh: ["开始使用", "查看功能", "下载应用"],
  ja: ["使い始める", "機能を見る", "アプリをダウンロード"],
  ko: ["사용 시작", "기능 보기", "앱 다운로드"]
});

function phrase(locale, index) {
  return (labels[locale] || fallbackLabels)[index] || fallbackLabels[index];
}

function cta(locale, index) {
  return (starts[locale] || starts.en)[index] || starts.en[index];
}

function localizedParagraphs(locale, item) {
  if (locale === "en") {
    return [
      item[2],
      "Users can keep glucose, insulin, carbohydrate, food and note records, review history, prepare exports and use the information when speaking with a medical professional.",
      "The AI assistant helps log data by voice, recognize commands, structure entered information and explain it in plain language. It does not diagnose or change treatment by itself.",
      "The SOS card can show emergency details approved by the user, a QR code and a trusted contact. Geolocation is shared only after user permission and within device capabilities.",
      "GlukoTrack applies organizational and technical measures for data protection, including authentication, device management, export, account deletion, consents and logging of critical operations."
    ];
  }
  if (locale === "ru") {
    return [
      item[2],
      "Пользователь может вести дневник глюкозы, инсулина, углеводов, питания и заметок, просматривать историю, готовить экспорт и использовать данные для разговора с медицинским специалистом.",
      "ИИ-помощник помогает записывать данные голосом, распознавать команды, структурировать введённую информацию и объяснять её простым языком. Он не ставит диагноз и не меняет лечение самостоятельно.",
      "SOS-карточка может показывать разрешённые пользователем экстренные сведения, QR-код и контакт для связи. Геолокация передаётся только после разрешения пользователя и в пределах возможностей устройства.",
      "GlukoTrack применяет организационные и технические меры защиты данных: авторизацию, управление устройствами, экспорт, удаление аккаунта, согласия и журналирование критических операций."
    ];
  }
  return [
    item[2],
    `${phrase(locale, 4)}. ${item[1]}`,
    `${phrase(locale, 2)}. ${phrase(locale, 3)}. ${phrase(locale, 5)}.`,
    `${phrase(locale, 6)}. ${phrase(locale, 10)}.`,
    `${phrase(locale, 11)}. GlukoTrack.`
  ];
}

function advantageDescription(locale, index) {
  const ru = {
    2: "Добавляйте записи голосом, анализируйте данные и получайте понятные информационные подсказки.",
    3: "Предоставьте доступ к важной информации в экстренной ситуации через заблокированный экран и QR-код.",
    4: "Храните показатели глюкозы, дозы инсулина, углеводы, питание и примечания в одном месте.",
    5: "Предоставляйте доверенным людям доступ к выбранным данным и уведомлениям.",
    6: "Передавайте своё местоположение доверенному контакту в пределах предоставленных разрешений.",
    7: "Используйте интерфейс, SOS-карточку и справочные материалы на удобном для вас языке.",
    8: "Приглашайте других пользователей и получайте предусмотренные программой Premium-награды.",
    9: "Получайте доступ к своим данным на поддерживаемых мобильных, веб- и настольных платформах.",
    10: "Управляйте доступом, подключёнными устройствами, экспортом и удалением персональных данных."
  };
  const en = {
    2: "Log entries by voice, analyze data and receive clear informational hints.",
    3: "Share important emergency information through the lock screen and QR code.",
    4: "Keep glucose readings, insulin doses, carbohydrates, meals and notes in one place.",
    5: "Give trusted people access to selected data and notifications.",
    6: "Share your location with a trusted contact only within granted permissions.",
    7: "Use the interface, SOS card and help materials in your preferred language.",
    8: "Invite other users and receive Premium rewards defined by the current program terms.",
    9: "Access your data on supported mobile, web and desktop platforms.",
    10: "Manage access, connected devices, export and personal data deletion."
  };
  if (locale === "ru") return ru[index];
  if (locale === "en") return en[index];
  return `${phrase(locale, index)}. ${localized[locale]?.[1] || localized.en[1]}`;
}

function medicalText(locale, item) {
  if (locale === "ru") {
    return "GlukoTrack предназначен для хранения, организации и отображения пользовательских данных. Приложение не ставит диагнозы, не заменяет врача и не должно использоваться как единственное основание для изменения дозировки инсулина, лекарств или назначенного лечения. При ухудшении состояния обратитесь к медицинскому специалисту или в экстренную службу.";
  }
  if (locale === "en") {
    return "GlukoTrack is intended to store, organize and display user data. The app does not diagnose, replace a doctor or serve as the only basis for changing insulin, medication or prescribed treatment. If your condition worsens, contact a medical professional or emergency service.";
  }
  return `${phrase(locale, 11)}. ${item[1]} GlukoTrack.`;
}

function content(locale) {
  const item = localized[locale] || localized.en;
  const paragraphs = localizedParagraphs(locale, item);
  return {
    locale,
    title: item[0],
    tagline: item[1],
    shortDescription: item[2],
    hero: {
      title: item[3],
      subtitle: item[2],
      startButton: cta(locale, 0),
      featuresButton: cta(locale, 1),
      downloadButton: cta(locale, 2)
    },
    whatIs: {
      title: phrase(locale, 0),
      paragraphs
    },
    advantagesTitle: phrase(locale, 1),
    advantages: [
      { key: "ai", title: phrase(locale, 2), description: advantageDescription(locale, 2) },
      { key: "sos", title: phrase(locale, 3), description: advantageDescription(locale, 3) },
      { key: "diary", title: phrase(locale, 4), description: advantageDescription(locale, 4) },
      { key: "family", title: phrase(locale, 5), description: advantageDescription(locale, 5) },
      { key: "location", title: phrase(locale, 6), description: advantageDescription(locale, 6) },
      { key: "localization", title: phrase(locale, 7), description: advantageDescription(locale, 7) },
      { key: "referral", title: phrase(locale, 8), description: advantageDescription(locale, 8) },
      { key: "sync", title: phrase(locale, 9), description: advantageDescription(locale, 9) },
      { key: "privacy", title: phrase(locale, 10), description: advantageDescription(locale, 10) }
    ],
    medicalDisclaimer: {
      title: phrase(locale, 11),
      text: medicalText(locale, item)
    },
    links: linkLabels(locale)
  };
}

function linkLabels(locale) {
  const map = {
    en: ["App version", "Build number", "Last updated", "Official website", "Contact support", "Help Center", "Privacy Policy", "Terms of Use", "Manage consents", "Request data export", "Delete account", "Open-source licenses"],
    ru: ["Версия приложения", "Номер сборки", "Дата последнего обновления", "Официальный сайт", "Связаться с поддержкой", "Справочный центр", "Политика конфиденциальности", "Условия использования", "Управление согласиями", "Запросить экспорт данных", "Удалить аккаунт", "Лицензии открытого ПО"],
    pl: ["Wersja aplikacji", "Numer kompilacji", "Ostatnia aktualizacja", "Oficjalna strona", "Kontakt z pomocą", "Centrum pomocy", "Polityka prywatności", "Warunki korzystania", "Zarządzaj zgodami", "Eksport danych", "Usuń konto", "Licencje open source"],
    de: ["App-Version", "Build-Nummer", "Zuletzt aktualisiert", "Offizielle Website", "Support kontaktieren", "Hilfecenter", "Datenschutzrichtlinie", "Nutzungsbedingungen", "Einwilligungen verwalten", "Datenexport anfordern", "Konto löschen", "Open-Source-Lizenzen"],
    fr: ["Version de l’application", "Numéro de build", "Dernière mise à jour", "Site officiel", "Contacter le support", "Centre d’aide", "Politique de confidentialité", "Conditions d’utilisation", "Gérer les consentements", "Exporter les données", "Supprimer le compte", "Licences open source"],
    es: ["Versión de la aplicación", "Número de compilación", "Última actualización", "Sitio oficial", "Contactar soporte", "Centro de ayuda", "Política de privacidad", "Condiciones de uso", "Gestionar consentimientos", "Exportar datos", "Eliminar cuenta", "Licencias de código abierto"],
    it: ["Versione app", "Numero build", "Ultimo aggiornamento", "Sito ufficiale", "Contatta supporto", "Centro assistenza", "Informativa privacy", "Termini d’uso", "Gestisci consensi", "Esporta dati", "Elimina account", "Licenze open source"],
    uk: ["Версія застосунку", "Номер збірки", "Останнє оновлення", "Офіційний сайт", "Зв’язатися з підтримкою", "Довідковий центр", "Політика приватності", "Умови використання", "Керування згодами", "Експорт даних", "Видалити акаунт", "Ліцензії відкритого ПЗ"]
  };
  const generic = map[locale] || [
    phrase(locale, 9), phrase(locale, 9), phrase(locale, 9), "GlukoTrack",
    phrase(locale, 10), "GlukoTrack", phrase(locale, 10), phrase(locale, 10),
    phrase(locale, 10), phrase(locale, 10), phrase(locale, 10), "Open source"
  ];
  return {
    versionLabel: "",
    buildNumberLabel: "",
    lastUpdateLabel: "",
    website: "",
    support: generic[4],
    helpCenter: "",
    privacyPolicy: generic[6],
    terms: generic[7],
    consents: "",
    exportData: "",
    deleteAccount: generic[10],
    openSourceLicenses: generic[11]
  };
}

export const ABOUT_CONTENT = Object.fromEntries(ABOUT_LOCALES.map((locale) => [locale, content(locale)]));

export function aboutLocale(value) {
  const normalized = String(value || "en").trim().toLowerCase().split("-")[0];
  return ABOUT_LOCALES.includes(normalized) ? normalized : "en";
}
