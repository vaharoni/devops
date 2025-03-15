import { createHmac } from 'crypto';

export function sign(data: string) {
  const keyStr = process.env.MONOREPO_BASE_SECRET;
  if (!keyStr) throw new Error('Secret not set');
  const key = Buffer.from(keyStr, 'hex');
  return createHmac('sha256', key).update(data).digest('hex');
}

export function verify(data: string, signature: string) {
  const generatedSignature = sign(data);
  return generatedSignature === signature;
}
