let _encoded: Uint8Array | null = null;

const KNOWN_WEAK = new Set([
  "change-me-in-production",
  "REPLACE_ME_GENERATE_WITH_openssl_rand_hex_32",
  "",
]);

export function getEncodedSecret(): Uint8Array {
  if (_encoded) return _encoded;
  const key = process.env.SECRET_KEY;
  if (!key || KNOWN_WEAK.has(key)) {
    throw new Error(
      "SECRET_KEY is not configured or uses a default value. " +
        "Run: openssl rand -hex 32 — then set SECRET_KEY in your .env file.",
    );
  }
  _encoded = new TextEncoder().encode(key);
  return _encoded;
}
