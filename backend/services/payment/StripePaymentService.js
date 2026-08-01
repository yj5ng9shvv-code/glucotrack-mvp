import Stripe from 'stripe';

export class StripePaymentService {
  #client;

  constructor({ requiredEnv, StripeClient = Stripe }) {
    this.requiredEnv = requiredEnv;
    this.StripeClient = StripeClient;
  }

  get client() {
    if (!this.#client) {
      this.#client = new this.StripeClient(this.requiredEnv('STRIPE_SECRET_KEY'));
    }
    return this.#client;
  }

  verifyWebhook({ payload, signature }) {
    return this.client.webhooks.constructEvent(
      payload,
      signature,
      this.requiredEnv('STRIPE_WEBHOOK_SECRET')
    );
  }

  retrieveSubscription(subscriptionId) {
    return this.client.subscriptions.retrieve(String(subscriptionId));
  }

  createCustomer({ email, userId }) {
    return this.client.customers.create({
      email,
      metadata: { userId: String(userId) }
    });
  }

  createCheckoutSession(options) {
    return this.client.checkout.sessions.create(options);
  }

  createPortalSession({ customerId, returnUrl }) {
    return this.client.billingPortal.sessions.create({
      customer: customerId,
      return_url: returnUrl
    });
  }
}
