const jwt = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');
const config = require('../config');

function signAccessToken(payload) {
  return jwt.sign(payload, config.appSecretKey, {
    algorithm: config.jwtAlgorithm,
    expiresIn: `${config.accessTokenExpireMinutes}m`,
  });
}

function signRefreshToken() {
  const jti = uuidv4();
  const token = jwt.sign({ jti, type: 'refresh' }, config.appSecretKey, {
    algorithm: config.jwtAlgorithm,
    expiresIn: `${config.refreshTokenExpireDays}d`,
  });
  return { token, jti };
}

function verifyToken(token) {
  return jwt.verify(token, config.appSecretKey, { algorithms: [config.jwtAlgorithm] });
}

function verifyRefreshToken(token) {
  const decoded = verifyToken(token);
  if (decoded.type !== 'refresh') {
    throw new Error('Invalid token type');
  }
  return decoded;
}

module.exports = {
  signAccessToken,
  signRefreshToken,
  verifyToken,
  verifyRefreshToken,
};
