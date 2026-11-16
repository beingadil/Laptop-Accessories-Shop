/**
 * Registers a resolve hook so `node --test` can load TypeScript modules that
 * use the project's `@/…` path alias (mapped to the repo root).
 * Usage: node --test --import ./tests/register-aliases.mjs <test files>
 */
import { register } from 'node:module';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
process.env.TS_PROJECT_ROOT = path.resolve(here, '..');
register('./resolve-aliases.mjs', pathToFileURL(`${here}/`));
