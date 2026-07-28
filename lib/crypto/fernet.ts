// Port từ api/crypto_utils.py — cài lại thuật toán Fernet (AES-128-CBC + HMAC-SHA256)
// bằng Node `crypto` thuần (không thêm thư viện), dùng CHUNG biến môi trường
// ENCRYPTION_KEY/ENCRYPTION_KEYS với bản Python cũ — ciphertext cũ giải mã được
// ngay, KHÔNG cần script migrate dữ liệu (xem Open Question trong design.md).
//
// Fernet token (trước base64url): version(1B=0x80) + timestamp(8B BE) + iv(16B)
// + ciphertext(N, PKCS7) + hmac-sha256(32B, ký trên toàn bộ phần trước).
// Node aes-128-cbc tự thêm/bỏ PKCS7 padding mặc định — không cần tự pad.
import crypto from "crypto";

interface FernetKeyPair {
  signingKey: Buffer;
  encryptionKey: Buffer;
}

function b64urlDecode(s: string): Buffer {
  return Buffer.from(s.replace(/-/g, "+").replace(/_/g, "/"), "base64");
}

function b64urlEncode(buf: Buffer): string {
  return buf.toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function parseKey(key: string): FernetKeyPair {
  const raw = b64urlDecode(key.trim());
  if (raw.length !== 32) {
    throw new Error("ENCRYPTION_KEY không hợp lệ: phải là 32 byte dạng base64url (khớp Fernet.generate_key()).");
  }
  return { signingKey: raw.subarray(0, 16), encryptionKey: raw.subarray(16, 32) };
}

function getKeys(): FernetKeyPair[] {
  const multiRaw = (process.env.ENCRYPTION_KEYS || "").trim();
  const singleRaw = (process.env.ENCRYPTION_KEY || "").trim();
  const raw = multiRaw || singleRaw;
  if (!raw) {
    throw new Error(
      "ENCRYPTION_KEY chưa được cấu hình. Thêm vào biến môi trường (khớp giá trị đang dùng ở bản Python cũ).",
    );
  }
  const keyList = raw
    .split(",")
    .map((k) => k.trim())
    .filter(Boolean);
  return keyList.map(parseKey);
}

function encryptWithKey(plaintext: Buffer, keys: FernetKeyPair): string {
  const version = Buffer.from([0x80]);
  const timestamp = Buffer.alloc(8);
  timestamp.writeBigUInt64BE(BigInt(Math.floor(Date.now() / 1000)));
  const iv = crypto.randomBytes(16);

  const cipher = crypto.createCipheriv("aes-128-cbc", keys.encryptionKey, iv);
  const ciphertext = Buffer.concat([cipher.update(plaintext), cipher.final()]);

  const payload = Buffer.concat([version, timestamp, iv, ciphertext]);
  const hmac = crypto.createHmac("sha256", keys.signingKey).update(payload).digest();
  return b64urlEncode(Buffer.concat([payload, hmac]));
}

function decryptWithKey(token: string, keys: FernetKeyPair): Buffer {
  const data = b64urlDecode(token.trim());
  if (data.length < 1 + 8 + 16 + 32) {
    throw new Error("Fernet token quá ngắn hoặc không hợp lệ.");
  }
  if (data[0] !== 0x80) {
    throw new Error("Fernet token có version không hợp lệ.");
  }
  const payload = data.subarray(0, data.length - 32);
  const receivedHmac = data.subarray(data.length - 32);
  const iv = data.subarray(9, 25);
  const ciphertext = data.subarray(25, data.length - 32);

  const expectedHmac = crypto.createHmac("sha256", keys.signingKey).update(payload).digest();
  if (!crypto.timingSafeEqual(receivedHmac, expectedHmac)) {
    throw new Error("InvalidToken");
  }

  const decipher = crypto.createDecipheriv("aes-128-cbc", keys.encryptionKey, iv);
  return Buffer.concat([decipher.update(ciphertext), decipher.final()]);
}

/** Mã hóa API Key trước khi lưu DB. Trả về ciphertext base64url (khớp định dạng Fernet). */
export function encryptApiKey(plaintext: string): string {
  if (!plaintext || !plaintext.trim()) return "";
  const keys = getKeys();
  return encryptWithKey(Buffer.from(plaintext, "utf-8"), keys[0]);
}

/** Giải mã API Key — CHỈ dùng ở phía server, không bao giờ trả plaintext ra client. */
export function decryptApiKey(ciphertext: string): string {
  if (!ciphertext || !ciphertext.trim()) return "";
  const keys = getKeys();
  let lastErr: unknown;
  for (const key of keys) {
    try {
      return decryptWithKey(ciphertext, key).toString("utf-8");
    } catch (e) {
      lastErr = e;
    }
  }
  throw new Error(
    `Không thể giải mã API Key: ENCRYPTION_KEY không khớp hoặc dữ liệu bị hỏng. (${lastErr instanceof Error ? lastErr.message : lastErr})`,
  );
}

/** Dạng masked để hiển thị cho Admin: ************abcd. */
export function maskApiKey(plaintext: string): string {
  if (!plaintext) return "";
  if (plaintext.length <= 4) return "****";
  const visible = plaintext.slice(-4);
  const hidden = "*".repeat(Math.max(8, plaintext.length - 4));
  return hidden + visible;
}

/** Dạng an toàn để log: sk-ant-... (6 ký tự đầu + ...). */
export function logSafeKey(plaintext: string): string {
  if (!plaintext) return "EMPTY";
  return plaintext.slice(0, 6) + "...";
}
