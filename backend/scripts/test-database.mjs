export function configureTestDatabase() {
  if (process.env.NODE_ENV !== "test") throw new Error("NODE_ENV=test is required");
  const name = process.env.TEST_DATABASE_NAME ?? "";
  if (!/(_test|test_)$/i.test(name)) throw new Error("Unsafe test database target");
  for (const key of ["HOST", "PORT", "NAME", "USER", "PASSWORD"]) {
    const value = process.env[`TEST_DATABASE_${key}`];
    if (!value) throw new Error(`TEST_DATABASE_${key} is required`);
    process.env[`DB_${key}`] = value;
  }
  return name;
}
