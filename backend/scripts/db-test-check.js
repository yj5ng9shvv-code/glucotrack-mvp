import "../config/env-loader.js";
import mysql from "mysql2/promise";

const name = process.env.TEST_DATABASE_NAME;
if (process.env.NODE_ENV !== "test" || !/(_test|test_)$/i.test(name || "") || name === process.env.DB_NAME) throw new Error("Unsafe database target");
const connection = await mysql.createConnection({host: process.env.TEST_DATABASE_HOST, port: Number(process.env.TEST_DATABASE_PORT || 3306), user: process.env.TEST_DATABASE_USER, password: process.env.TEST_DATABASE_PASSWORD, database: name});
await connection.query("SELECT 1"); await connection.end();
console.log(`TEST DATABASE CONNECTION CHECK\nEnvironment: TEST\nDatabase: ${name}\nUser: ${process.env.TEST_DATABASE_USER}\nConnection: PASS`);
