function encode(text: string): ArrayBuffer {
  const arr = new TextEncoder().encode(text);
  return arr.buffer.slice(arr.byteOffset, arr.byteOffset + arr.byteLength) as ArrayBuffer;
}

function toHex(buf: ArrayBuffer): string {
  return Array.from(new Uint8Array(buf))
    .map(b => b.toString(16).padStart(2, "0"))
    .join("");
}

export async function signPayload(body: string, secret: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, encode(body));
  return "sha256=" + toHex(sig);
}

export async function verifyPayload(
  body:      string,
  secret:    string,
  signature: string,
): Promise<boolean> {
  const expected = await signPayload(body, secret);
  return expected === signature;
}
