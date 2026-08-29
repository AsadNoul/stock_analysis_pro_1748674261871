// Shareable lobby codes — short, uppercase, unambiguous alphabet (no 0/O/1/I).
import { customAlphabet } from 'nanoid';

const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const generate = customAlphabet(ALPHABET, 5);

export function generateDashCode() {
  return generate();
}
