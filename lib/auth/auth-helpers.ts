import crypto from 'node:crypto';

export const encrypt = (plaintext: string, nonce: string) => {
  const { key, iv } = get_key_and_iv(nonce);

  const cipher = crypto.createCipheriv('aes-256-cbc', key, iv);

  let encrypted = cipher.update(plaintext, 'utf8', 'base64');
  encrypted += cipher.final('base64');

  return encrypted;
};

export const decrypt = (encryptedText: string, nonce: string) => {
  const { key, iv } = get_key_and_iv(nonce);

  const decipher = crypto.createDecipheriv('aes-256-cbc', key, iv);

  let decrypted = decipher.update(encryptedText, 'base64', 'utf8');
  decrypted += decipher.final('utf8');

  return decrypted;
};

export const get_key_and_iv = (nonce: string) => {
  const nonceBuffer = Buffer.from(nonce, 'base64');

  const key = nonceBuffer.subarray(0, 32);
  const iv = nonceBuffer.subarray(32, 48);

  return {
    key,
    iv,
  };
};
