const { hashPassword, verifyPassword, generateTempPassword } = require('../../src/utils/password');

describe('Password Utils', () => {
  test('hashPassword returns hashed string', async () => {
    const hash = await hashPassword('password123');
    expect(hash).toBeTruthy();
    expect(hash).not.toBe('password123');
    expect(hash.startsWith('$2')).toBe(true);
  });

  test('verifyPassword validates correct password', async () => {
    const hash = await hashPassword('password123');
    const valid = await verifyPassword('password123', hash);
    expect(valid).toBe(true);
  });

  test('verifyPassword rejects wrong password', async () => {
    const hash = await hashPassword('password123');
    const valid = await verifyPassword('wrongpassword', hash);
    expect(valid).toBe(false);
  });

  test('generateTempPassword returns string of correct length', () => {
    const pwd = generateTempPassword(12);
    expect(pwd).toHaveLength(12);
    expect(typeof pwd).toBe('string');
  });
});
