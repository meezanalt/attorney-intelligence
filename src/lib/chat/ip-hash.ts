import crypto from 'crypto';

/**
 * HMAC-SHA256 of the client IP for rate-limit keys and audit logs.
 * Requires CHAT_IP_HASH_SECRET — must be set consistently in every environment
 * so hashes are comparable across deploys.
 */
export function hashClientIp(ip: string): string {
  const secret = process.env.CHAT_IP_HASH_SECRET;
  if (!secret) {
    throw new Error('CHAT_IP_HASH_SECRET is not configured');
  }
  return crypto.createHmac('sha256', secret).update(ip).digest('hex');
}
