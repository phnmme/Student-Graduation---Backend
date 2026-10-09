/**
 * Centralized JWT secret validation.
 * Fail fast instead of silently falling back to a known public secret.
 */
export function getJwtSecret(): string {
  const secret = process.env.JWT_SECRET;

  if (!secret) {
    throw new Error("JWT_SECRET must be configured in the environment.");
  }

  if (secret === "your-secret-key") {
    throw new Error("JWT_SECRET must not use the insecure default value.");
  }

  return secret;
}
