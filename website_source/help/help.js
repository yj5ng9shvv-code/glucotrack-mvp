const API = `${location.origin}/api/help`;
const SUPPORTED = ["en","ru","pl","de","fr","es","it","uk","pt","nl","sv","no","da","fi","cs","sk","ro","bg","hu","tr","el","he","ar","hi","id","vi","th","zh","ja","ko"];
const I18N = {
  en: {
    "help.center.title": "Help Center",
    "help.subtitle": "Find answers about GlukoTrack",
    "help.search.placeholder": "Search help articles",
    "help.search.button": "Search",
    "help.popular.title": "Popular articles",
    "help.categories.title": "Help categories",
    "help.recent.title": "Recently updated",
    "help.contact.title": "Did not find an answer?",
    "help.contact.description": "Send a message to GlukoTrack support.",
    "help.contact.button": "Contact support",
    "help.contact.email": "Email",
    "help.contact.subject": "Subject",
    "help.contact.message": "Message",
    "help.noResults.title": "No results",
    "help.feedback.title": "Was this article helpful?",
    "help.feedback.yes": "Yes",
    "help.feedback.no": "No",
    "help.sent": "Sent",
    "help.loading": "Loading..."
  },
  ru: {
    "help.center.title": "Справочный центр",
    "help.subtitle": "Найдите ответы на вопросы о GlukoTrack",
    "help.search.placeholder": "Поиск по статьям",
    "help.search.button": "Искать",
    "help.popular.title": "Популярные статьи",
    "help.categories.title": "Категории помощи",
    "help.recent.title": "Последние обновления",
    "help.contact.title": "Не нашли ответ?",
    "help.contact.description": "Отправьте сообщение в поддержку GlukoTrack.",
    "help.contact.button": "Связаться с поддержкой",
    "help.contact.email": "Email",
    "help.contact.subject": "Тема",
    "help.contact.message": "Сообщение",
    "help.noResults.title": "Ничего не найдено",
    "help.feedback.title": "Статья была полезной?",
    "help.feedback.yes": "Да",
    "help.feedback.no": "Нет",
    "help.sent": "Отправлено",
    "help.loading": "Загрузка..."
  },
  pl: {
    "help.center.title": "Centrum pomocy",
    "help.subtitle": "Znajdź odpowiedzi o GlukoTrack",
    "help.search.placeholder": "Szukaj artykułów",
    "help.search.button": "Szukaj",
    "help.popular.title": "Popularne artykuły",
    "help.categories.title": "Kategorie pomocy",
    "help.recent.title": "Ostatnio zaktualizowane",
    "help.contact.title": "Nie znalazłeś odpowiedzi?",
    "help.contact.description": "Wyślij wiadomość do wsparcia GlukoTrack.",
    "help.contact.button": "Kontakt ze wsparciem"
  },
  de: { "help.center.title": "Hilfe-Center", "help.subtitle": "Antworten zu GlukoTrack finden" },
  fr: { "help.center.title": "Centre d’aide", "help.subtitle": "Trouvez des réponses sur GlukoTrack" },
  es: { "help.center.title": "Centro de ayuda", "help.subtitle": "Encuentra respuestas sobre GlukoTrack" },
  it: { "help.center.title": "Centro assistenza", "help.subtitle": "Trova risposte su GlukoTrack" },
  uk: { "help.center.title": "Довідковий центр", "help.subtitle": "Знайдіть відповіді про GlukoTrack" }
};
const UI_LOCALE_TEXT = {
  pl: ["Centrum pomocy","Znajdź odpowiedzi o GlukoTrack","Szukaj artykułów pomocy","Szukaj","Popularne artykuły","Kategorie pomocy","Ostatnio zaktualizowane","Nie znalazłeś odpowiedzi?","Wyślij wiadomość do wsparcia GlukoTrack.","Kontakt ze wsparciem","Temat","Wiadomość","Brak wyników","Czy artykuł był pomocny?","Tak","Nie","Wysłano","Ładowanie..."],
  de: ["Hilfe-Center","Antworten zu GlukoTrack finden","Hilfeartikel suchen","Suchen","Beliebte Artikel","Hilfekategorien","Kürzlich aktualisiert","Keine Antwort gefunden?","Sende eine Nachricht an den GlukoTrack-Support.","Support kontaktieren","Betreff","Nachricht","Keine Ergebnisse","War dieser Artikel hilfreich?","Ja","Nein","Gesendet","Wird geladen..."],
  fr: ["Centre d’aide","Trouvez des réponses sur GlukoTrack","Rechercher des articles d’aide","Rechercher","Articles populaires","Catégories d’aide","Récemment mis à jour","Vous n’avez pas trouvé de réponse ?","Envoyez un message au support GlukoTrack.","Contacter le support","Sujet","Message","Aucun résultat","Cet article vous a-t-il aidé ?","Oui","Non","Envoyé","Chargement..."],
  es: ["Centro de ayuda","Encuentra respuestas sobre GlukoTrack","Buscar artículos de ayuda","Buscar","Artículos populares","Categorías de ayuda","Actualizados recientemente","¿No encontraste respuesta?","Envía un mensaje al soporte de GlukoTrack.","Contactar soporte","Asunto","Mensaje","Sin resultados","¿Este artículo fue útil?","Sí","No","Enviado","Cargando..."],
  it: ["Centro assistenza","Trova risposte su GlukoTrack","Cerca articoli di aiuto","Cerca","Articoli popolari","Categorie assistenza","Aggiornati di recente","Non hai trovato una risposta?","Invia un messaggio al supporto GlukoTrack.","Contatta il supporto","Oggetto","Messaggio","Nessun risultato","Questo articolo è stato utile?","Sì","No","Inviato","Caricamento..."],
  uk: ["Довідковий центр","Знайдіть відповіді про GlukoTrack","Пошук статей довідки","Пошук","Популярні статті","Категорії допомоги","Нещодавно оновлено","Не знайшли відповідь?","Надішліть повідомлення до підтримки GlukoTrack.","Зв’язатися з підтримкою","Тема","Повідомлення","Немає результатів","Чи була стаття корисною?","Так","Ні","Надіслано","Завантаження..."],
  pt: ["Centro de ajuda","Encontre respostas sobre o GlukoTrack","Pesquisar artigos","Pesquisar","Artigos populares","Categorias de ajuda","Atualizados recentemente","Não encontrou a resposta?","Envie uma mensagem ao suporte GlukoTrack.","Contactar suporte","Assunto","Mensagem","Sem resultados","Este artigo foi útil?","Sim","Não","Enviado","A carregar..."],
  nl: ["Helpcentrum","Vind antwoorden over GlukoTrack","Zoek helpartikelen","Zoeken","Populaire artikelen","Helpcategorieën","Recent bijgewerkt","Geen antwoord gevonden?","Stuur een bericht naar GlukoTrack support.","Neem contact op","Onderwerp","Bericht","Geen resultaten","Was dit artikel nuttig?","Ja","Nee","Verzonden","Laden..."],
  sv: ["Hjälpcenter","Hitta svar om GlukoTrack","Sök hjälpartiklar","Sök","Populära artiklar","Hjälpkategorier","Senast uppdaterade","Hittade du inget svar?","Skicka ett meddelande till GlukoTrack-supporten.","Kontakta support","Ämne","Meddelande","Inga resultat","Var artikeln hjälpsam?","Ja","Nej","Skickat","Laddar..."],
  no: ["Hjelpesenter","Finn svar om GlukoTrack","Søk i hjelpeartikler","Søk","Populære artikler","Hjelpekategorier","Nylig oppdatert","Fant du ikke svar?","Send en melding til GlukoTrack-support.","Kontakt support","Emne","Melding","Ingen resultater","Var artikkelen nyttig?","Ja","Nei","Sendt","Laster..."],
  da: ["Hjælpecenter","Find svar om GlukoTrack","Søg i hjælpeartikler","Søg","Populære artikler","Hjælpekategorier","Senest opdateret","Fandt du ikke et svar?","Send en besked til GlukoTrack support.","Kontakt support","Emne","Besked","Ingen resultater","Var artiklen nyttig?","Ja","Nej","Sendt","Indlæser..."],
  fi: ["Ohjekeskus","Löydä vastauksia GlukoTrackista","Etsi ohjeartikkeleita","Etsi","Suositut artikkelit","Ohjekategoriat","Viimeksi päivitetty","Etkö löytänyt vastausta?","Lähetä viesti GlukoTrack-tukeen.","Ota yhteyttä tukeen","Aihe","Viesti","Ei tuloksia","Oliko artikkeli hyödyllinen?","Kyllä","Ei","Lähetetty","Ladataan..."],
  cs: ["Centrum nápovědy","Najděte odpovědi o GlukoTrack","Hledat články nápovědy","Hledat","Populární články","Kategorie nápovědy","Nedávno aktualizováno","Nenašli jste odpověď?","Pošlete zprávu podpoře GlukoTrack.","Kontaktovat podporu","Předmět","Zpráva","Žádné výsledky","Byl článek užitečný?","Ano","Ne","Odesláno","Načítání..."],
  sk: ["Centrum pomoci","Nájdite odpovede o GlukoTrack","Hľadať články pomoci","Hľadať","Populárne články","Kategórie pomoci","Nedávno aktualizované","Nenašli ste odpoveď?","Pošlite správu podpore GlukoTrack.","Kontaktovať podporu","Predmet","Správa","Žiadne výsledky","Bol článok užitočný?","Áno","Nie","Odoslané","Načítava sa..."],
  ro: ["Centru de ajutor","Găsiți răspunsuri despre GlukoTrack","Căutați articole de ajutor","Căutare","Articole populare","Categorii de ajutor","Actualizate recent","Nu ați găsit răspuns?","Trimiteți un mesaj suportului GlukoTrack.","Contactați suportul","Subiect","Mesaj","Fără rezultate","A fost util articolul?","Da","Nu","Trimis","Se încarcă..."],
  bg: ["Помощен център","Намерете отговори за GlukoTrack","Търсене в статии","Търсене","Популярни статии","Категории помощ","Последно обновени","Не намерихте отговор?","Изпратете съобщение до поддръжката на GlukoTrack.","Свържете се с поддръжка","Тема","Съобщение","Няма резултати","Полезна ли беше статията?","Да","Не","Изпратено","Зареждане..."],
  hu: ["Súgóközpont","Válaszok keresése a GlukoTrackről","Súgócikkek keresése","Keresés","Népszerű cikkek","Súgókategóriák","Nemrég frissítve","Nem talált választ?","Küldjön üzenetet a GlukoTrack támogatásnak.","Kapcsolat a támogatással","Tárgy","Üzenet","Nincs találat","Hasznos volt a cikk?","Igen","Nem","Elküldve","Betöltés..."],
  tr: ["Yardım Merkezi","GlukoTrack hakkında yanıtlar bulun","Yardım makalelerinde ara","Ara","Popüler makaleler","Yardım kategorileri","Son güncellenenler","Yanıt bulamadınız mı?","GlukoTrack desteğine mesaj gönderin.","Destekle iletişim","Konu","Mesaj","Sonuç yok","Bu makale yardımcı oldu mu?","Evet","Hayır","Gönderildi","Yükleniyor..."],
  el: ["Κέντρο βοήθειας","Βρείτε απαντήσεις για το GlukoTrack","Αναζήτηση άρθρων βοήθειας","Αναζήτηση","Δημοφιλή άρθρα","Κατηγορίες βοήθειας","Πρόσφατα ενημερωμένα","Δεν βρήκατε απάντηση;","Στείλτε μήνυμα στην υποστήριξη GlukoTrack.","Επικοινωνία με υποστήριξη","Θέμα","Μήνυμα","Κανένα αποτέλεσμα","Ήταν χρήσιμο το άρθρο;","Ναι","Όχι","Στάλθηκε","Φόρτωση..."],
  he: ["מרכז העזרה","מצא תשובות על GlukoTrack","חפש מאמרי עזרה","חיפוש","מאמרים פופולריים","קטגוריות עזרה","עודכן לאחרונה","לא מצאת תשובה?","שלח הודעה לתמיכת GlukoTrack.","צור קשר עם התמיכה","נושא","הודעה","אין תוצאות","האם המאמר היה מועיל?","כן","לא","נשלח","טוען..."],
  ar: ["مركز المساعدة","ابحث عن إجابات حول GlukoTrack","ابحث في مقالات المساعدة","بحث","مقالات شائعة","فئات المساعدة","تم التحديث حديثًا","لم تجد إجابة؟","أرسل رسالة إلى دعم GlukoTrack.","اتصل بالدعم","الموضوع","الرسالة","لا توجد نتائج","هل كانت المقالة مفيدة؟","نعم","لا","تم الإرسال","جار التحميل..."],
  hi: ["सहायता केंद्र","GlukoTrack के बारे में उत्तर खोजें","सहायता लेख खोजें","खोजें","लोकप्रिय लेख","सहायता श्रेणियाँ","हाल ही में अपडेट","उत्तर नहीं मिला?","GlukoTrack सहायता को संदेश भेजें.","सहायता से संपर्क करें","विषय","संदेश","कोई परिणाम नहीं","क्या यह लेख उपयोगी था?","हाँ","नहीं","भेजा गया","लोड हो रहा है..."],
  id: ["Pusat Bantuan","Temukan jawaban tentang GlukoTrack","Cari artikel bantuan","Cari","Artikel populer","Kategori bantuan","Baru diperbarui","Tidak menemukan jawaban?","Kirim pesan ke dukungan GlukoTrack.","Hubungi dukungan","Subjek","Pesan","Tidak ada hasil","Apakah artikel ini membantu?","Ya","Tidak","Terkirim","Memuat..."],
  vi: ["Trung tâm trợ giúp","Tìm câu trả lời về GlukoTrack","Tìm bài viết trợ giúp","Tìm kiếm","Bài viết phổ biến","Danh mục trợ giúp","Cập nhật gần đây","Bạn chưa tìm thấy câu trả lời?","Gửi tin nhắn đến hỗ trợ GlukoTrack.","Liên hệ hỗ trợ","Chủ đề","Tin nhắn","Không có kết quả","Bài viết này có hữu ích không?","Có","Không","Đã gửi","Đang tải..."],
  th: ["ศูนย์ช่วยเหลือ","ค้นหาคำตอบเกี่ยวกับ GlukoTrack","ค้นหาบทความช่วยเหลือ","ค้นหา","บทความยอดนิยม","หมวดหมู่ความช่วยเหลือ","อัปเดตล่าสุด","ไม่พบคำตอบ?","ส่งข้อความถึงฝ่ายสนับสนุน GlukoTrack","ติดต่อฝ่ายสนับสนุน","หัวข้อ","ข้อความ","ไม่พบผลลัพธ์","บทความนี้มีประโยชน์หรือไม่?","ใช่","ไม่","ส่งแล้ว","กำลังโหลด..."],
  zh: ["帮助中心","查找关于 GlukoTrack 的答案","搜索帮助文章","搜索","热门文章","帮助类别","最近更新","没有找到答案？","向 GlukoTrack 支持发送消息。","联系支持","主题","消息","无结果","这篇文章有帮助吗？","是","否","已发送","正在加载..."],
  ja: ["ヘルプセンター","GlukoTrack の回答を探す","ヘルプ記事を検索","検索","人気の記事","ヘルプカテゴリ","最近更新","答えが見つかりませんか？","GlukoTrack サポートにメッセージを送信します。","サポートに連絡","件名","メッセージ","結果がありません","この記事は役に立ちましたか？","はい","いいえ","送信しました","読み込み中..."],
  ko: ["도움말 센터","GlukoTrack에 대한 답변 찾기","도움말 문서 검색","검색","인기 문서","도움말 카테고리","최근 업데이트","답을 찾지 못했나요?","GlukoTrack 지원팀에 메시지를 보내세요.","지원팀에 문의","제목","메시지","결과 없음","이 문서가 도움이 되었나요?","예","아니요","전송됨","로드 중..."]
};
const UI_KEYS = ["help.center.title","help.subtitle","help.search.placeholder","help.search.button","help.popular.title","help.categories.title","help.recent.title","help.contact.title","help.contact.description","help.contact.button","help.contact.subject","help.contact.message","help.noResults.title","help.feedback.title","help.feedback.yes","help.feedback.no","help.sent","help.loading"];
for (const [locale, values] of Object.entries(UI_LOCALE_TEXT)) {
  I18N[locale] = { ...(I18N[locale] || {}) };
  UI_KEYS.forEach((key, index) => { I18N[locale][key] = values[index]; });
  I18N[locale]["help.contact.email"] = "Email";
}
const state = { locale: initialLocale(), categories: [], articles: [] };

document.addEventListener("DOMContentLoaded", init);
window.addEventListener("hashchange", route);

async function init() {
  setupLocale();
  applyI18n();
  bindForms();
  await loadHome();
  await route();
}

function setupLocale() {
  const select = $("#localeSelect");
  select.innerHTML = SUPPORTED.map((code) => `<option value="${code}">${code.toUpperCase()}</option>`).join("");
  select.value = state.locale;
  select.addEventListener("change", async () => {
    state.locale = select.value;
    localStorage.setItem("glukotrack-language", state.locale);
    applyI18n();
    await loadHome();
    await route();
  });
}

function applyI18n() {
  document.documentElement.lang = state.locale;
  $$("[data-key]").forEach((node) => { node.textContent = t(node.dataset.key); });
  $$("[data-placeholder]").forEach((node) => { node.placeholder = t(node.dataset.placeholder); });
}

async function loadHome() {
  $("#popularArticles").innerHTML = t("help.loading");
  const [categories, popular, recent] = await Promise.all([
    api(`/categories?locale=${state.locale}`),
    api(`/popular?locale=${state.locale}&limit=8`),
    api(`/articles?locale=${state.locale}&limit=8`)
  ]);
  state.categories = categories.rows || [];
  state.articles = recent.rows || [];
  renderCategories(state.categories);
  renderArticleList($("#popularArticles"), popular.rows || []);
  renderArticleList($("#recentArticles"), recent.rows || []);
}

async function route() {
  const hash = decodeURIComponent(location.hash.replace(/^#/, ""));
  $("#articleView").classList.add("hidden");
  if (!hash) return;
  if (hash.startsWith("/article/")) return openArticle(hash.split("/").pop());
  if (hash.startsWith("/category/")) return openCategory(hash.split("/").pop());
}

async function openArticle(slug) {
  const data = await api(`/articles/${encodeURIComponent(slug)}?locale=${state.locale}`);
  const article = data.article;
  $("#articleView").classList.remove("hidden");
  $("#articleView").innerHTML = `
    <a class="muted" href="/help/">GlukoTrack / ${escapeHtml(article.categoryTitle || "")}</a>
    <h2>${escapeHtml(article.title)}</h2>
    <p class="meta">${escapeHtml(article.summary || "")}</p>
    <div class="article-content">${article.content || ""}</div>
    <div class="feedback">
      <strong>${t("help.feedback.title")}</strong>
      <button type="button" class="secondary" data-helpful="true">${t("help.feedback.yes")}</button>
      <button type="button" class="danger" data-helpful="false">${t("help.feedback.no")}</button>
      <span id="feedbackStatus" class="muted"></span>
    </div>`;
  $$("[data-helpful]").forEach((button) => {
    button.addEventListener("click", async () => {
      const buttons = $$("[data-helpful]");
      buttons.forEach((item) => { item.disabled = true; });
      $("#feedbackStatus").textContent = t("help.loading");
      try {
        await api("/feedback", { method: "POST", body: { slug: article.slug, locale: state.locale, helpful: button.dataset.helpful === "true" } });
        $("#feedbackStatus").textContent = t("help.sent");
        toast(t("help.sent"));
      } catch (error) {
        $("#feedbackStatus").textContent = error.message || "Error";
        buttons.forEach((item) => { item.disabled = false; });
      }
    });
  });
  $("#articleView").scrollIntoView({ behavior: "smooth", block: "start" });
}

async function openCategory(slug) {
  const data = await api(`/categories/${encodeURIComponent(slug)}?locale=${state.locale}`);
  $("#searchResults").classList.remove("hidden");
  $("#searchResults").innerHTML = `<div class="panel-head"><h2>${escapeHtml(data.category.title)}</h2></div><div class="article-list"></div>`;
  renderArticleList($("#searchResults .article-list"), data.articles || []);
  $("#searchResults").scrollIntoView({ behavior: "smooth", block: "start" });
}

function bindForms() {
  $("#searchForm").addEventListener("submit", async (event) => {
    event.preventDefault();
    const q = $("#searchInput").value.trim();
    if (!q) return;
    const data = await api(`/search?locale=${state.locale}&q=${encodeURIComponent(q)}`);
    $("#searchResults").classList.remove("hidden");
    $("#searchResults").innerHTML = `<div class="panel-head"><h2>${escapeHtml(q)}</h2></div><div class="article-list"></div>`;
    renderArticleList($("#searchResults .article-list"), data.rows || []);
  });
  $("#contactForm").addEventListener("submit", async (event) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    await api("/contact", {
      method: "POST",
      body: {
        locale: state.locale,
        email: form.get("email"),
        subject: form.get("subject"),
        message: form.get("message")
      }
    });
    event.currentTarget.reset();
    toast(t("help.sent"));
  });
}

function renderCategories(rows) {
  $("#categories").innerHTML = rows.map((row) => `
    <a class="category-card" href="#/category/${encodeURIComponent(row.slug)}">
      <i>${escapeHtml((row.title || "?").slice(0, 1).toUpperCase())}</i>
      <strong>${escapeHtml(row.title)}</strong>
      <span>${escapeHtml(row.description || "")}</span>
    </a>`).join("");
}

function renderArticleList(container, rows) {
  container.innerHTML = rows.length ? rows.map((row) => `
    <a class="article-link" href="#/article/${encodeURIComponent(row.slug)}">
      <strong>${escapeHtml(row.title)}</strong>
      <span>${escapeHtml(row.summary || row.categoryTitle || "")}</span>
    </a>`).join("") : `<p class="muted">${t("help.noResults.title")}</p>`;
}

async function api(path, options = {}) {
  const response = await fetch(`${API}${path}`, {
    method: options.method || "GET",
    headers: options.body ? { "Content-Type": "application/json; charset=utf-8" } : {},
    body: options.body ? JSON.stringify(options.body) : undefined
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.code || response.statusText);
  return data;
}

function t(key) {
  return I18N[state.locale]?.[key] || I18N.en[key] || key;
}

function initialLocale() {
  const saved = localStorage.getItem("glukotrack-language") || localStorage.getItem("gt_language") || "";
  const browser = navigator.language || "en";
  const code = (saved || browser).toLowerCase().split("-")[0];
  return SUPPORTED.includes(code) ? code : "en";
}

function toast(message) {
  const node = $("#toast");
  node.textContent = message;
  node.classList.add("show");
  setTimeout(() => node.classList.remove("show"), 2600);
}

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, (char) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;"
  }[char]));
}

function $(selector) { return document.querySelector(selector); }
function $$(selector) { return [...document.querySelectorAll(selector)]; }

