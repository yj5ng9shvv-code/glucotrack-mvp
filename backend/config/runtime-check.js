export function assertTestRuntime() {
  if (process.env.NODE_ENV !== 'test' || !/(_test|test_)$/i.test(process.env.TEST_DATABASE_NAME || '')) {
    throw new Error('TEST RUNTIME SECURITY VIOLATION');
  }
  for (const [key, expected] of [['SMTP_MODE','mock'], ['STRIPE_MODE','mock'], ['OPENAI_MODE','mock']]) {
    if (process.env[key] !== expected) throw new Error(`TEST RUNTIME SECURITY VIOLATION: ${key}`);
  }
  if (!process.env.JWT_SECRET?.startsWith('test_')) throw new Error('TEST RUNTIME SECURITY VIOLATION: JWT');
  if (process.env.HOST !== '127.0.0.1' || String(process.env.PORT) !== '8788') {
    throw new Error('TEST RUNTIME SECURITY VIOLATION: test API must bind to 127.0.0.1:8788');
  }
}
