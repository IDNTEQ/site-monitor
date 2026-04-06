import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

const ALGORITHM = "aes-256-gcm";
const IV_BYTES = 12;
const FORMAT_VERSION = "v1";

export function encryptSecret(plaintext, key) {
  if (typeof plaintext !== "string" || plaintext.length === 0) {
    throw new Error("Secret plaintext must be a non-empty string.");
  }

  const iv = randomBytes(IV_BYTES);
  const cipher = createCipheriv(ALGORITHM, key, iv);
  const ciphertext = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const authTag = cipher.getAuthTag();

  return [FORMAT_VERSION, iv.toString("base64url"), authTag.toString("base64url"), ciphertext.toString("base64url")].join(":");
}

export function decryptSecret(serializedCiphertext, key) {
  const [version, ivEncoded, authTagEncoded, ciphertextEncoded] = serializedCiphertext.split(":");

  if (version !== FORMAT_VERSION || !ivEncoded || !authTagEncoded || !ciphertextEncoded) {
    throw new Error("Unsupported encrypted secret format.");
  }

  const decipher = createDecipheriv(ALGORITHM, key, Buffer.from(ivEncoded, "base64url"));
  decipher.setAuthTag(Buffer.from(authTagEncoded, "base64url"));

  const plaintext = Buffer.concat([
    decipher.update(Buffer.from(ciphertextEncoded, "base64url")),
    decipher.final()
  ]);

  return plaintext.toString("utf8");
}
