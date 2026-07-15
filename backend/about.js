import { ABOUT_CONTENT, ABOUT_LOCALES, aboutLocale } from "./about-content.js";
import { pool } from "./db.js";

export function registerAboutPublicRoutes(app, { asyncHandler }) {
  app.get("/about", asyncHandler(async (req, res) => {
    const locale = aboutLocale(req.query.locale);
    res.json({ content: await loadAboutContent(locale), locales: ABOUT_LOCALES });
  }));
  app.get("/about/locales", (_req, res) => res.json({ locales: ABOUT_LOCALES }));
}

export async function loadAboutContent(localeValue) {
  const locale = aboutLocale(localeValue);
  const row = await pool.query(
    `SELECT c.section_key,c.content_type,c.sort_order,c.is_active,t.locale,t.title,t.subtitle,t.content,t.translation_status,t.updated_at
     FROM about_content c
     JOIN about_content_translations t ON t.content_id = c.id AND t.locale = $1
     WHERE c.is_active = TRUE
     ORDER BY c.sort_order`,
    [locale]
  );
  if (!row.rowCount) return ABOUT_CONTENT[locale] || ABOUT_CONTENT.en;
  return rowsToAbout(locale, row.rows);
}

export function rowsToAbout(locale, rows) {
  const base = structuredClone(ABOUT_CONTENT[locale] || ABOUT_CONTENT.en);
  const byKey = Object.fromEntries(rows.map((row) => [row.section_key, row]));
  const hero = byKey.hero;
  if (hero) {
    base.hero.title = hero.title || base.hero.title;
    base.hero.subtitle = hero.subtitle || base.hero.subtitle;
    base.shortDescription = hero.subtitle || base.shortDescription;
  }
  const what = byKey.what_is;
  if (what) {
    base.whatIs.title = what.title || base.whatIs.title;
    base.whatIs.paragraphs = splitParagraphs(what.content);
  }
  const disclaimer = byKey.medical_disclaimer;
  if (disclaimer) {
    base.medicalDisclaimer.title = disclaimer.title || base.medicalDisclaimer.title;
    base.medicalDisclaimer.text = disclaimer.content || base.medicalDisclaimer.text;
  }
  for (const advantage of base.advantages) {
    const row = byKey[`advantage_${advantage.key}`];
    if (row) {
      advantage.title = row.title || advantage.title;
      advantage.description = row.content || row.subtitle || advantage.description;
      advantage.isActive = Boolean(row.is_active);
    }
  }
  base.translationStatus = rows.some((row) => row.translation_status !== "published") ? "needs_review" : "published";
  base.updatedAt = rows.map((row) => row.updated_at).filter(Boolean).sort().at(-1) || null;
  return base;
}

function splitParagraphs(value) {
  const text = String(value || "").trim();
  return text ? text.split(/\n{2,}/).map((item) => item.trim()).filter(Boolean) : [];
}
