import { pool } from "./db.js";

const maximumPageSize = 100;

export function registerFoodCatalogRoutes(app, { asyncHandler }) {
  app.get("/food/catalog", asyncHandler(async (req, res) => {
    const query = cleanText(req.query?.q, 120);
    const favoritesOnly = String(req.query?.favorites ?? "") === "1";
    const limit = pageSize(req.query?.limit);
    const filters = ["user_id = $1", "deleted_at IS NULL"];
    const values = [req.user.id];
    if (query) {
      values.push(`%${query}%`);
      filters.push(`(food_name LIKE $${values.length} OR category LIKE $${values.length})`);
    }
    if (favoritesOnly) filters.push("favorite = TRUE");
    values.push(limit);
    const result = await pool.query(
      `SELECT id, food_name, category, portion_grams, calories, protein_grams,
              fat_grams, carbohydrates_grams, glycemic_index, usage_count,
              favorite, last_used_at, created_at, updated_at
       FROM user_food_catalog WHERE ${filters.join(" AND ")}
       ORDER BY favorite DESC, usage_count DESC, updated_at DESC LIMIT $${values.length}`,
      values
    );
    res.json({ items: result.rows.map(publicFood) });
  }));

  app.post("/food/catalog/add", asyncHandler(async (req, res) => {
    const food = validatedFood(req.body);
    const inserted = await pool.query(
      `INSERT INTO user_food_catalog(
         user_id, food_name, category, portion_grams, calories, protein_grams,
         fat_grams, carbohydrates_grams, glycemic_index, favorite
       ) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
      [req.user.id, food.name, food.category, food.portion, food.calories,
        food.protein, food.fat, food.carbohydrates, food.glycemicIndex, food.favorite]
    );
    const row = await catalogItem(req.user.id, inserted.insertId);
    res.status(201).json({ item: publicFood(row) });
  }));

  app.put("/food/catalog/update/:id", asyncHandler(async (req, res) => {
    const id = positiveId(req.params.id);
    const food = validatedFood(req.body);
    const result = await pool.query(
      `UPDATE user_food_catalog SET food_name=$1, category=$2, portion_grams=$3,
       calories=$4, protein_grams=$5, fat_grams=$6, carbohydrates_grams=$7,
       glycemic_index=$8, favorite=$9 WHERE id=$10 AND user_id=$11`,
      [food.name, food.category, food.portion, food.calories, food.protein, food.fat,
        food.carbohydrates, food.glycemicIndex, food.favorite, id, req.user.id]
    );
    if (!result.rowCount) return res.status(404).json({ error: "food not found" });
    res.json({ item: publicFood(await catalogItem(req.user.id, id)) });
  }));

  app.delete("/food/catalog/delete/:id", asyncHandler(async (req, res) => {
    const result = await pool.query(
      "UPDATE user_food_catalog SET deleted_at=UTC_TIMESTAMP() WHERE id=$1 AND user_id=$2 AND deleted_at IS NULL",
      [positiveId(req.params.id), req.user.id]
    );
    if (!result.rowCount) return res.status(404).json({ success: false, message: "Product not found" });
    res.json({ success: true, message: "Product deleted" });
  }));

  app.post("/food/favorite/:id", asyncHandler(async (req, res) => {
    const id = positiveId(req.params.id);
    const favorite = Boolean(req.body?.favorite);
    const result = await pool.query("UPDATE user_food_catalog SET favorite=$1 WHERE id=$2 AND user_id=$3", [favorite, id, req.user.id]);
    if (!result.rowCount) return res.status(404).json({ error: "food not found" });
    res.json({ item: publicFood(await catalogItem(req.user.id, id)) });
  }));

  app.post("/food/catalog/:id/use", asyncHandler(async (req, res) => {
    const id = positiveId(req.params.id);
    const item = await catalogItem(req.user.id, id);
    if (!item) return res.status(404).json({ error: "food not found" });
    const eatenAt = validDate(req.body?.eaten_at) ?? new Date();
    await pool.query(
      `INSERT INTO food_logs(user_id,title,carbs_grams,eaten_at,metadata)
       VALUES($1,$2,$3,$4,$5)`,
      [req.user.id, item.food_name, item.carbohydrates_grams, eatenAt,
        JSON.stringify({ catalog_food_id: id, portion_grams: Number(item.portion_grams), calories: Number(item.calories) })]
    );
    await pool.query("UPDATE user_food_catalog SET usage_count=usage_count+1,last_used_at=UTC_TIMESTAMP() WHERE id=$1 AND user_id=$2", [id, req.user.id]);
    res.status(201).json({ item: publicFood(await catalogItem(req.user.id, id)) });
  }));
}

async function catalogItem(userId, id) {
  const result = await pool.query("SELECT * FROM user_food_catalog WHERE id=$1 AND user_id=$2 AND deleted_at IS NULL", [id, userId]);
  return result.rows[0] ?? null;
}

function publicFood(row) {
  return {
    id: Number(row.id), name: row.food_name, category: row.category,
    portion_grams: Number(row.portion_grams), calories: Number(row.calories),
    protein_grams: Number(row.protein_grams), fat_grams: Number(row.fat_grams),
    carbohydrates_grams: Number(row.carbohydrates_grams), glycemic_index: Number(row.glycemic_index),
    usage_count: Number(row.usage_count), favorite: Boolean(row.favorite),
    last_used_at: row.last_used_at, created_at: row.created_at, updated_at: row.updated_at
  };
}

function validatedFood(value) {
  const name = cleanText(value?.name, 255);
  if (!name) { const error = new Error("food name is required"); error.status = 400; throw error; }
  return {
    name, category: cleanText(value?.category, 100) || "Food", portion: nutrition(value?.portion_grams, 5000),
    calories: nutrition(value?.calories, 10000), protein: nutrition(value?.protein_grams, 1000),
    fat: nutrition(value?.fat_grams, 1000), carbohydrates: nutrition(value?.carbohydrates_grams, 1000),
    glycemicIndex: nutrition(value?.glycemic_index, 100), favorite: Boolean(value?.favorite)
  };
}
function nutrition(value, maximum) { const number = Number(value); return Number.isFinite(number) && number >= 0 && number <= maximum ? number : 0; }
function pageSize(value) { const number = Number(value); return Number.isInteger(number) && number > 0 ? Math.min(number, maximumPageSize) : 50; }
function positiveId(value) { const id = Number(value); if (!Number.isSafeInteger(id) || id < 1) { const error = new Error("invalid id"); error.status = 400; throw error; } return id; }
function cleanText(value, maximum) { return String(value ?? "").trim().replace(/\s+/g, " ").slice(0, maximum); }
function validDate(value) { const date = value ? new Date(value) : null; return date && !Number.isNaN(date.getTime()) ? date : null; }
