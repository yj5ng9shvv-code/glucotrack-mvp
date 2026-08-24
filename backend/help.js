import { pool } from "./db.js";
import { HELP_LOCALES } from "./help-content.js";

const DEFAULT_LOCALE = "en";
const ARTICLE_STATUSES = new Set(["draft", "review", "published", "archived"]);
const TRANSLATION_STATUSES = new Set(["missing", "machine_translated", "needs_review", "approved", "outdated"]);

export function registerHelpPublicRoutes(app, { asyncHandler }) {
  app.get("/help/categories", asyncHandler(helpCategories));
  app.get("/help/categories/:slug", asyncHandler(helpCategory));
  app.get("/help/articles", asyncHandler(helpArticles));
  app.get("/help/articles/:slug", asyncHandler(helpArticle));
  app.get("/help/search", asyncHandler(helpSearch));
  app.get("/help/popular", asyncHandler(helpPopular));
  app.post("/help/feedback", asyncHandler(helpFeedback));
  app.post("/help/contact", asyncHandler(helpContact));
}

export function sanitizeHelpHtml(value) {
  return cleanText(value, 100000)
    .replace(/<\s*(script|iframe|object|embed|link|meta)[\s\S]*?<\s*\/\s*\1\s*>/gi, "")
    .replace(/<\s*(script|iframe|object|embed|link|meta)[^>]*>/gi, "")
    .replace(/\son[a-z]+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, "")
    .replace(/\s(href|src)\s*=\s*("[^"]*javascript:[^"]*"|'[^']*javascript:[^']*'|[^\s>]*javascript:[^\s>]*)/gi, "")
    .replace(/\s(href|src)\s*=\s*("[^"]*data:text\/html[^"]*"|'[^']*data:text\/html[^']*'|[^\s>]*data:text\/html[^\s>]*)/gi, "");
}

export function helpLocale(value) {
  const locale = cleanText(value, 16).toLowerCase();
  if (HELP_LOCALES.includes(locale)) return locale;
  const base = locale.split("-")[0];
  return HELP_LOCALES.includes(base) ? base : DEFAULT_LOCALE;
}

export function helpStatus(value, fallback = "draft") {
  const status = cleanText(value, 32).toLowerCase();
  return ARTICLE_STATUSES.has(status) ? status : fallback;
}

export function helpTranslationStatus(value, fallback = "needs_review") {
  const status = cleanText(value, 32).toLowerCase();
  return TRANSLATION_STATUSES.has(status) ? status : fallback;
}

export function cleanHelpSlug(value) {
  return cleanText(value, 96).toLowerCase().replace(/[^a-z0-9_-]+/g, "-").replace(/^-+|-+$/g, "");
}

async function helpCategories(req, res) {
  const locale = helpLocale(req.query.locale);
  const rows = await pool.query(
    `SELECT c.id, c.slug, c.icon, c.sort_order sortOrder,
       COALESCE(t.title, fallback.title) title,
       COALESCE(t.description, fallback.description) description,
       COUNT(a.id) articleCount
     FROM help_categories c
     LEFT JOIN help_category_translations t ON t.category_id = c.id AND t.locale = $1
     LEFT JOIN help_category_translations fallback ON fallback.category_id = c.id AND fallback.locale = 'en'
     LEFT JOIN help_articles a ON a.category_id = c.id AND a.status = 'published'
     WHERE c.is_active = TRUE
     GROUP BY c.id, c.slug, c.icon, c.sort_order, title, description
     ORDER BY c.sort_order, c.slug`,
    [locale]
  );
  res.json({ locale, rows: rows.rows });
}

async function helpCategory(req, res) {
  const locale = helpLocale(req.query.locale);
  const slug = cleanHelpSlug(req.params.slug);
  const category = await pool.query(
    `SELECT c.id, c.slug, c.icon, c.sort_order sortOrder,
       COALESCE(t.title, fallback.title) title,
       COALESCE(t.description, fallback.description) description
     FROM help_categories c
     LEFT JOIN help_category_translations t ON t.category_id = c.id AND t.locale = $1
     LEFT JOIN help_category_translations fallback ON fallback.category_id = c.id AND fallback.locale = 'en'
     WHERE c.slug = $2 AND c.is_active = TRUE`,
    [locale, slug]
  );
  if (!category.rowCount) return res.status(404).json({ code: "HELP_CATEGORY_NOT_FOUND" });
  const articles = await articlesByWhere(locale, "a.category_id = $2", [category.rows[0].id], 100);
  res.json({ locale, category: category.rows[0], articles });
}

async function helpArticles(req, res) {
  const locale = helpLocale(req.query.locale);
  const category = cleanHelpSlug(req.query.category);
  const featured = req.query.featured === "true";
  const limit = limitParam(req.query.limit, 50);
  const conditions = [];
  const params = [];
  if (category) {
    params.push(category);
    conditions.push(`c.slug = $${params.length + 1}`);
  }
  if (featured) conditions.push("a.is_featured = TRUE");
  const where = conditions.length ? conditions.join(" AND ") : "1=1";
  const rows = await articlesByWhere(locale, where, params, limit);
  res.json({ locale, rows });
}

async function helpArticle(req, res) {
  const locale = helpLocale(req.query.locale);
  const slug = cleanHelpSlug(req.params.slug);
  const rows = await pool.query(
    articleSelectSql("a.slug = $2"),
    [locale, slug]
  );
  if (!rows.rowCount) return res.status(404).json({ code: "HELP_ARTICLE_NOT_FOUND" });
  await pool.query("UPDATE help_articles SET view_count = view_count + 1 WHERE id = $1", [rows.rows[0].id]);
  res.json({ locale, article: rows.rows[0] });
}

async function helpSearch(req, res) {
  const locale = helpLocale(req.query.locale);
  const q = cleanText(req.query.q, 120);
  if (!q) return res.json({ locale, rows: [] });
  const rows = await pool.query(
    `${articleSelectSql(
      `(COALESCE(t.title, fallback.title) LIKE $2 OR COALESCE(t.summary, fallback.summary) LIKE $2 OR COALESCE(t.content, fallback.content) LIKE $2)`
    )} LIMIT 30`,
    [locale, `%${q}%`]
  );
  await pool.query("INSERT INTO help_search_logs(locale, query, result_count) VALUES($1, $2, $3)", [locale, q, rows.rowCount]);
  res.json({ locale, rows: rows.rows });
}

async function helpPopular(req, res) {
  const locale = helpLocale(req.query.locale);
  const rows = await articlesByWhere(locale, "1=1", [], limitParam(req.query.limit, 8), "a.is_featured DESC, a.view_count DESC, a.updated_at DESC");
  res.json({ locale, rows });
}

async function helpFeedback(req, res) {
  const slug = cleanHelpSlug(req.body?.slug);
  const locale = helpLocale(req.body?.locale);
  const helpful = req.body?.helpful === true || req.body?.helpful === "true";
  const comment = cleanText(req.body?.comment, 1000);
  const article = await pool.query("SELECT id FROM help_articles WHERE slug = $1 AND status = 'published'", [slug]);
  if (!article.rowCount) return res.status(404).json({ code: "HELP_ARTICLE_NOT_FOUND" });
  await pool.query(
    "INSERT INTO help_article_feedback(article_id, locale, helpful, comment, ip_address, user_agent) VALUES($1, $2, $3, $4, $5, $6)",
    [article.rows[0].id, locale, helpful, comment || null, requestIp(req), cleanText(req.headers["user-agent"], 512)]
  );
  res.json({ ok: true });
}

async function helpContact(req, res) {
  const email = cleanText(req.body?.email, 255).toLowerCase();
  const subject = cleanText(req.body?.subject, 255);
  const message = cleanText(req.body?.message, 5000);
  const locale = helpLocale(req.body?.locale);
  if (!email || !subject || !message || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return res.status(400).json({ code: "HELP_CONTACT_INVALID" });
  }
  let ticketId;
  await pool.transaction(async (query) => {
    const ticket = await query(
      "INSERT INTO support_tickets(user_id, subject, status, priority) VALUES(NULL, $1, 'open', 'normal')",
      [`Help Center: ${subject}`]
    );
    ticketId = ticket.insertId;
    await query(
      "INSERT INTO support_messages(ticket_id, body) VALUES($1, $2)",
      [ticketId, `From: ${email}\nLocale: ${locale}\n\n${message}`]
    );
  });
  res.json({ ok: true, ticketId });
}

async function articlesByWhere(locale, where, params = [], limit = 50, order = "a.is_featured DESC, a.sort_order, a.updated_at DESC") {
  const rows = await pool.query(`${articleSelectSql(where, order)} LIMIT ${limitParam(limit, 50)}`, [locale, ...params]);
  return rows.rows;
}

function articleSelectSql(where, order = "a.is_featured DESC, a.sort_order, a.updated_at DESC") {
  const localeRef = "$1";
  return `SELECT a.id, a.slug, a.status, a.is_featured isFeatured, a.view_count viewCount,
       a.published_at publishedAt, a.updated_at updatedAt,
       c.slug categorySlug,
       COALESCE(ct.title, ctf.title) categoryTitle,
       COALESCE(t.locale, fallback.locale) locale,
       COALESCE(t.title, fallback.title) title,
       COALESCE(t.summary, fallback.summary) summary,
       COALESCE(t.content, fallback.content) content,
       COALESCE(t.translation_status, fallback.translation_status) translationStatus
     FROM help_articles a
     JOIN help_categories c ON c.id = a.category_id
     LEFT JOIN help_category_translations ct ON ct.category_id = c.id AND ct.locale = ${localeRef}
     LEFT JOIN help_category_translations ctf ON ctf.category_id = c.id AND ctf.locale = 'en'
     LEFT JOIN help_article_translations t ON t.article_id = a.id AND t.locale = ${localeRef}
     LEFT JOIN help_article_translations fallback ON fallback.article_id = a.id AND fallback.locale = 'en'
     WHERE a.status = 'published' AND c.is_active = TRUE AND ${where}
     ORDER BY ${order}`;
}

function limitParam(value, fallback) {
  const number = Number.parseInt(value, 10);
  if (!Number.isFinite(number)) return fallback;
  return Math.min(Math.max(number, 1), 100);
}

function cleanText(value, maxLength) {
  if (value == null) return "";
  return String(value).replace(/[\u0000-\u001f\u007f]/g, " ").trim().slice(0, maxLength);
}

function requestIp(req) {
  return cleanText(req.headers["x-forwarded-for"]?.split(",")[0] ?? req.ip ?? "", 64);
}
