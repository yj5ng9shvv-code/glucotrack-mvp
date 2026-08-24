const rtlLocales = new Set(["ar", "he"]);
const languageNames = {
  en: "English", ru: "Русский", pl: "Polski", de: "Deutsch", fr: "Français", es: "Español", it: "Italiano",
  uk: "Українська", pt: "Português", nl: "Nederlands", sv: "Svenska", no: "Norsk", da: "Dansk", fi: "Suomi",
  cs: "Čeština", sk: "Slovenčina", ro: "Română", bg: "Български", hu: "Magyar", tr: "Türkçe", el: "Ελληνικά",
  he: "עברית", ar: "العربية", hi: "हिन्दी", id: "Indonesia", vi: "Tiếng Việt", th: "ไทย", zh: "中文", ja: "日本語", ko: "한국어"
};

const select = document.querySelector("#localeSelect");
const locale = new URLSearchParams(location.search).get("locale") ||
  localStorage.getItem("gt_locale") ||
  navigator.language.split("-")[0] ||
  "en";

load(locale).catch(() => load("en"));

async function load(localeValue) {
  const response = await fetch(`/api/about?locale=${encodeURIComponent(localeValue)}`, { headers: { Accept: "application/json" } });
  if (!response.ok) throw new Error("ABOUT_LOAD_FAILED");
  const data = await response.json();
  const content = data.content;
  const locales = data.locales || Object.keys(languageNames);
  renderLocaleSelect(locales, content.locale);
  render(content);
}

function renderLocaleSelect(locales, current) {
  select.innerHTML = locales.map((item) =>
    `<option value="${escapeHtml(item)}" ${item === current ? "selected" : ""}>${escapeHtml(languageNames[item] || item)}</option>`
  ).join("");
  select.onchange = () => {
    localStorage.setItem("gt_locale", select.value);
    history.replaceState(null, "", `/about/?locale=${encodeURIComponent(select.value)}`);
    load(select.value);
  };
}

function render(content) {
  document.documentElement.lang = content.locale || "en";
  document.documentElement.dir = rtlLocales.has(content.locale) ? "rtl" : "ltr";
  document.title = content.title || "About GlukoTrack";
  setMeta("description", content.shortDescription);
  setMeta("og:title", content.title, true);
  setMeta("og:description", content.shortDescription, true);
  setText("[data-key=title]", content.title);
  setText("[data-field='hero.title']", content.hero?.title);
  setText("[data-field='hero.subtitle']", content.hero?.subtitle);
  setText("[data-field='hero.startButton']", content.hero?.startButton);
  setText("[data-field='hero.featuresButton']", content.hero?.featuresButton);
  setText("[data-field='hero.downloadButton']", content.hero?.downloadButton);
  setText("[data-field='whatIs.title']", content.whatIs?.title);
  setText("[data-field='advantagesTitle']", content.advantagesTitle);
  setText("[data-field='medicalDisclaimer.title']", content.medicalDisclaimer?.title);
  setText("[data-field='medicalDisclaimer.text']", content.medicalDisclaimer?.text);

  document.querySelector("#paragraphs").innerHTML = (content.whatIs?.paragraphs || [])
    .map((item) => `<p>${escapeHtml(item)}</p>`).join("");
  document.querySelector("#advantages").innerHTML = (content.advantages || [])
    .filter((item) => item.isActive !== false)
    .map((item) => `<article class="feature-card"><strong>${escapeHtml(item.title)}</strong><p>${escapeHtml(item.description)}</p></article>`)
    .join("");
  const links = content.links || {};
  document.querySelector("#metaLinks").innerHTML = [
    ["website", links.website, "/"],
    ["support", links.support, "#support"],
    ["helpCenter", links.helpCenter, "/help/"],
    ["privacyPolicy", links.privacyPolicy, "/privacy.html"],
    ["terms", links.terms, "/terms.html"],
    ["consents", links.consents, "/app/#/profile"],
    ["exportData", links.exportData, "/app/#/export"],
    ["deleteAccount", links.deleteAccount, "/app/#/profile"],
    ["openSourceLicenses", links.openSourceLicenses, "/app/#/profile"]
  ].filter(([, label]) => label).map(([key, label, href]) => key === "support"
    ? `<button class="meta-button" type="button" data-support-open>${escapeHtml(label)}</button>`
    : `<a href="${href}">${escapeHtml(label)}</a>`
  ).join("");
  document.querySelector("[data-support-open]")?.addEventListener("click", () => openSupportDialog(content));
}

function openSupportDialog(content) {
  const copy = supportCopy(content.locale);
  const existing = document.querySelector("#supportDialog");
  if (existing) existing.remove();
  document.body.insertAdjacentHTML("beforeend", `
    <dialog id="supportDialog" class="support-dialog" aria-labelledby="supportTitle">
      <button class="support-close" type="button" data-support-close aria-label="${escapeHtml(copy.close)}">×</button>
      <h2 id="supportTitle">${escapeHtml(content.links?.support || copy.title)}</h2>
      <form id="supportForm" class="support-form">
        <label>${escapeHtml(copy.email)}<input name="email" type="email" autocomplete="email" required></label>
        <label>${escapeHtml(copy.subject)}<input name="subject" maxlength="160" required></label>
        <label>${escapeHtml(copy.message)}<textarea name="message" rows="6" maxlength="4000" required></textarea></label>
        <p id="supportStatus" class="support-status" role="status"></p>
        <button class="button primary" type="submit">${escapeHtml(copy.send)}</button>
      </form>
    </dialog>
  `);
  const dialog = document.querySelector("#supportDialog");
  dialog.querySelector("[data-support-close]").addEventListener("click", () => dialog.close());
  dialog.addEventListener("close", () => dialog.remove());
  dialog.querySelector("#supportForm").addEventListener("submit", async (event) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const status = dialog.querySelector("#supportStatus");
    const button = dialog.querySelector("button[type=submit]");
    button.disabled = true;
    status.textContent = copy.sending;
    try {
      const response = await fetch("/api/help/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json; charset=utf-8" },
        body: JSON.stringify({
          locale: content.locale || "en",
          email: form.get("email"),
          subject: form.get("subject"),
          message: form.get("message")
        })
      });
      if (!response.ok) throw new Error("SUPPORT_FAILED");
      status.textContent = copy.sent;
      event.currentTarget.reset();
    } catch {
      status.textContent = copy.error;
    } finally {
      button.disabled = false;
    }
  });
  dialog.showModal();
}

function supportCopy(locale) {
  const lang = String(locale || "en").split("-")[0];
  const copies = {
    ru: { title: "Связаться с поддержкой", email: "Email", subject: "Тема", message: "Сообщение", send: "Отправить", sending: "Отправка...", sent: "Сообщение отправлено", error: "Не удалось отправить. Попробуйте ещё раз.", close: "Закрыть" },
    en: { title: "Contact support", email: "Email", subject: "Subject", message: "Message", send: "Send", sending: "Sending...", sent: "Message sent", error: "Could not send. Try again.", close: "Close" },
    pl: { title: "Kontakt z pomocą", email: "Email", subject: "Temat", message: "Wiadomość", send: "Wyślij", sending: "Wysyłanie...", sent: "Wiadomość wysłana", error: "Nie udało się wysłać.", close: "Zamknij" },
    de: { title: "Support kontaktieren", email: "Email", subject: "Betreff", message: "Nachricht", send: "Senden", sending: "Senden...", sent: "Nachricht gesendet", error: "Senden fehlgeschlagen.", close: "Schließen" },
    fr: { title: "Contacter le support", email: "Email", subject: "Sujet", message: "Message", send: "Envoyer", sending: "Envoi...", sent: "Message envoyé", error: "Échec de l’envoi.", close: "Fermer" },
    es: { title: "Contactar soporte", email: "Email", subject: "Asunto", message: "Mensaje", send: "Enviar", sending: "Enviando...", sent: "Mensaje enviado", error: "No se pudo enviar.", close: "Cerrar" },
    ar: { title: "اتصل بالدعم", email: "البريد الإلكتروني", subject: "الموضوع", message: "الرسالة", send: "إرسال", sending: "جارٍ الإرسال...", sent: "تم إرسال الرسالة", error: "تعذر الإرسال.", close: "إغلاق" },
    he: { title: "צור קשר עם התמיכה", email: "Email", subject: "נושא", message: "הודעה", send: "שלח", sending: "שולח...", sent: "ההודעה נשלחה", error: "לא ניתן לשלוח.", close: "סגור" }
  };
  return copies[lang] || copies.en;
}

function setText(selector, value) {
  document.querySelectorAll(selector).forEach((node) => {
    node.textContent = value || "";
  });
}

function setMeta(name, value, property = false) {
  const selector = property ? `meta[property="${name}"]` : `meta[name="${name}"]`;
  const node = document.querySelector(selector);
  if (node && value) node.setAttribute("content", value);
}

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, (char) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;"
  })[char]);
}

