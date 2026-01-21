import 'server-only';
import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'crypto';

const SECRET_ENV_KEY = 'ROADMAP_SECRET_KEY';

const deriveKey = (value: string) =>
  createHash('sha256').update(value).digest();

const getKey = () => {
  const raw = process.env[SECRET_ENV_KEY];
  if (!raw) {
    throw new Error(`${SECRET_ENV_KEY} is required to store datasource secrets.`);
  }
  return deriveKey(raw);
};

export function encryptSecret(value: string): string {
  const key = getKey();
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key, iv);
  const encrypted = Buffer.concat([cipher.update(value, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [
    iv.toString('base64'),
    tag.toString('base64'),
    encrypted.toString('base64'),
  ].join('.');
}

export function decryptSecret(value: string): string {
  const key = getKey();
  const [ivPart, tagPart, dataPart] = value.split('.');
  if (!ivPart || !tagPart || !dataPart) {
    throw new Error('Invalid secret payload.');
  }
  const iv = Buffer.from(ivPart, 'base64');
  const tag = Buffer.from(tagPart, 'base64');
  const encrypted = Buffer.from(dataPart, 'base64');
  const decipher = createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAuthTag(tag);
  const decrypted = Buffer.concat([decipher.update(encrypted), decipher.final()]);
  return decrypted.toString('utf8');
}
