import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from "node:crypto";

const ALGORITHM = "aes-256-gcm";
const KEY_LENGTH = 32;
const IV_LENGTH = 12;

export function createSecretCodec({
  keyMaterial = process.env.SITE_MONITOR_SECRET_KEY ?? "site-monitor-dev-secret",
} = {}) {
  const key = scryptSync(keyMaterial, "site-monitor", KEY_LENGTH);

  return {
    encrypt(secret) {
      const iv = randomBytes(IV_LENGTH);
      const cipher = createCipheriv(ALGORITHM, key, iv);
      const ciphertext = Buffer.concat([
        cipher.update(secret, "utf8"),
        cipher.final(),
      ]);
      const authTag = cipher.getAuthTag();

      return [
        "enc",
        iv.toString("hex"),
        authTag.toString("hex"),
        ciphertext.toString("hex"),
      ].join(":");
    },

    decrypt(encryptedSecret) {
      const [prefix, ivHex, authTagHex, ciphertextHex] = String(encryptedSecret).split(":");
      if (prefix !== "enc" || !ivHex || !authTagHex || !ciphertextHex) {
        throw new Error("Secret is not in the expected encrypted format.");
      }

      const decipher = createDecipheriv(ALGORITHM, key, Buffer.from(ivHex, "hex"));
      decipher.setAuthTag(Buffer.from(authTagHex, "hex"));
      return Buffer.concat([
        decipher.update(Buffer.from(ciphertextHex, "hex")),
        decipher.final(),
      ]).toString("utf8");
    },
  };
}
