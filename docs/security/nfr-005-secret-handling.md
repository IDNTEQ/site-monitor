# NFR-005 Security Review -- Secret Handling

## Scope

This slice covers the first persisted secret paths in `site-monitor`:

- monitor authentication secrets
- notification channel credentials

## Controls Implemented

- Secrets are encrypted before database writes using AES-256-GCM with a process-supplied 32-byte key.
- SQLite stores only ciphertext, IV, and auth tag material in versioned serialized form.
- API create and read responses expose only `secretConfigured` booleans instead of plaintext secrets.
- Decryption is not used in any HTTP response path.

## Reviewer Checks

- Confirm `SITE_MONITOR_SECRET_KEY` is provided through runtime configuration and not committed.
- Confirm `src/repositories.js` only returns redacted secret metadata.
- Confirm the integration test reads stored rows and proves the database values differ from the submitted plaintext.

## Residual Risks

- Key rotation is not implemented yet.
- Secrets are decrypted only in tests right now; future runtime consumers must keep decrypted values out of logs and response bodies.
- This slice does not yet integrate with an external KMS or secret manager.
