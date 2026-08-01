export class MockPaymentService {
  constructor() {
    this.customers = new Map();
    this.subscriptions = new Map();
    this.sequence = 0;
  }

  verifyWebhook({ payload, signature }) {
    if (signature !== 'test_signature') {
      throw new Error('Invalid test payment webhook signature');
    }
    if (Buffer.isBuffer(payload)) payload = payload.toString('utf8');
    return typeof payload === 'string' ? JSON.parse(payload) : payload;
  }

  async retrieveSubscription(subscriptionId) {
    const subscription = this.subscriptions.get(String(subscriptionId));
    if (!subscription) throw new Error('Mock subscription not found');
    return subscription;
  }

  async createCustomer({ email, userId }) {
    const id = `cus_test_${++this.sequence}`;
    const customer = { id, email, metadata: { userId: String(userId) }, mode: 'test' };
    this.customers.set(id, customer);
    return customer;
  }

  async createCheckoutSession(options) {
    const id = `cs_test_${++this.sequence}`;
    const plan = options.metadata?.plan ?? 'monthly';
    const subscriptionId = `sub_test_${this.sequence}`;
    this.subscriptions.set(subscriptionId, {
      id: subscriptionId,
      customer: options.customer,
      metadata: { ...(options.subscription_data?.metadata ?? options.metadata ?? {}) },
      status: 'active',
      current_period_end: Math.floor(Date.now() / 1000) + 30 * 24 * 60 * 60
    });
    return {
      id,
      mode: 'test',
      url: `http://127.0.0.1:8788/mock-stripe/checkout/${id}?plan=${encodeURIComponent(plan)}`,
      subscription: subscriptionId
    };
  }

  async createPortalSession({ customerId }) {
    const id = `bps_test_${++this.sequence}`;
    return {
      id,
      mode: 'test',
      url: `http://127.0.0.1:8788/mock-stripe/portal/${id}?customer=${encodeURIComponent(customerId)}`
    };
  }
}
