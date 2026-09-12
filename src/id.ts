function hexByte(byte: number): string {
  return byte.toString(16).padStart(2, "0");
}

function uuidV4FromRandomValues(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  const version = bytes[6] ?? 0;
  const variant = bytes[8] ?? 0;
  bytes[6] = (version & 0x0f) | 0x40;
  bytes[8] = (variant & 0x3f) | 0x80;
  const hex = Array.from(bytes, hexByte).join("");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

/**
 * New entity id. Uses the native UUID generator when the runtime
 * exposes it (secure contexts); otherwise composes a v4 UUID from
 * `crypto.getRandomValues`, which remains available over plain HTTP.
 */
export function newId(): string {
  const native = crypto["randomUUID"];
  if (typeof native === "function") {
    return native.call(crypto);
  }
  return uuidV4FromRandomValues();
}
