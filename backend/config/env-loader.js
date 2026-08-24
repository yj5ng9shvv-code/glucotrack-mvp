import dotenv from 'dotenv';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const test = process.env.NODE_ENV === 'test';
const file = path.join(root, test ? '.env.test' : '.env');
if (test && !fs.existsSync(file)) throw new Error('Environment file not found: .env.test');
if (fs.existsSync(file)) dotenv.config({path: file, override: true});
if (test && process.env.NODE_ENV !== 'test') throw new Error('TEST RUNTIME SECURITY VIOLATION');
export const runtimeEnvironment = test ? 'test' : 'production';
