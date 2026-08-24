import "../config/env-loader.js";
import mysql from "mysql2/promise";

const name = process.env.TEST_DATABASE_NAME;
if (process.env.NODE_ENV !== "test" || !/(_test|test_)$/i.test(name || "") || name === process.env.DB_NAME) throw new Error("Unsafe database target");
const db = await mysql.createConnection({host: process.env.TEST_DATABASE_HOST, port: Number(process.env.TEST_DATABASE_PORT || 3306), user: process.env.TEST_DATABASE_USER, password: process.env.TEST_DATABASE_PASSWORD, database: name});
const [rows] = await db.query("SHOW TABLES"); await db.end();
console.log(`TEST DATABASE SCHEMA CHECK\nDatabase: ${name}\nTables: ${rows.length ? rows.map(Object.values).flat().join(', ') : 'EMPTY'}`);
