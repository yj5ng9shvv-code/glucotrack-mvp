export function testApi(baseUrl = process.env.TEST_API_BASE_URL || 'http://127.0.0.1:8788') {
  const url = new URL(baseUrl);
  if (!['127.0.0.1', 'localhost'].includes(url.hostname)) throw new Error('TEST ENVIRONMENT VIOLATION');
  return {
    async request(path, options = {}) { return fetch(new URL(path, url), options); },
    async login(email, password = 'test-password') {
      const deviceKey = email.replace(/[^a-z0-9]/gi, '').slice(0, 48).toLowerCase();
      return this.request('/auth/login', {
        method: 'POST',
        headers: {'Content-Type':'application/json'},
        body: JSON.stringify({
          email,
          password,
          device: {
            id: `family-integration-${deviceKey}`,
            name: 'Family integration test',
            platform: 'web',
            fingerprint: `family-integration-${deviceKey}`
          }
        })
      });
    },
    assertStatus(response, status) { if (response.status !== status) throw new Error(`Expected ${status}, got ${response.status}`); },
  };
}
