/**
 * Generates a unique product SKU. Used to pre-fill the "New Product" form and
 * as a server-side fallback when a POST arrives without one.
 * Format: PRD-XXXXXX (6 chars, no ambiguous look-alikes: 0/O, 1/I/L).
 */
const ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
const SUFFIX_LENGTH = 6;
const PREFIX = 'PRD';

export function generateSku(): string {
  let suffix = '';
  for (let i = 0; i < SUFFIX_LENGTH; i += 1) {
    suffix += ALPHABET[Math.floor(Math.random() * ALPHABET.length)];
  }
  return `${PREFIX}-${suffix}`;
}
