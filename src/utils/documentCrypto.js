const crypto = require('crypto');
const config = require('../config');

const ALGORITHM = 'AES-256-GCM';
const IV_LENGTH = 12;

function getKey() {
  const secret = config.documentEncryptionKey || config.appSecretKey;
  return crypto.createHash('sha256').update(secret).digest();
}

function encryptDocument(buffer) {
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv('aes-256-gcm', getKey(), iv);
  const encryptedData = Buffer.concat([cipher.update(buffer), cipher.final()]);
  const tag = cipher.getAuthTag();
  const sha256Hash = crypto.createHash('sha256').update(buffer).digest('hex');

  return {
    algorithm: ALGORITHM,
    encryptedData,
    iv,
    tag,
    sha256Hash,
  };
}

function decryptDocument(document) {
  if (!document.encrypted_data || !document.encryption_iv || !document.encryption_tag) {
    const err = new Error('Document binary data is missing');
    err.statusCode = 409;
    err.code = 'conflict';
    throw err;
  }

  const decipher = crypto.createDecipheriv(
    'aes-256-gcm',
    getKey(),
    Buffer.from(document.encryption_iv)
  );
  decipher.setAuthTag(Buffer.from(document.encryption_tag));

  return Buffer.concat([
    decipher.update(Buffer.from(document.encrypted_data)),
    decipher.final(),
  ]);
}

module.exports = {
  encryptDocument,
  decryptDocument,
};
