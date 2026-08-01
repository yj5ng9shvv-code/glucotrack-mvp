export class PaymentService {
  constructor(adapter) {
    this.adapter = adapter;
  }

  verifyWebhook({ payload, signature }) {
    return this.adapter.verifyWebhook({ payload, signature });
  }

  retrieveSubscription(subscriptionId) {
    return this.adapter.retrieveSubscription(subscriptionId);
  }

  createCustomer({ email, userId }) {
    return this.adapter.createCustomer({ email, userId });
  }

  createCheckoutSession(options) {
    return this.adapter.createCheckoutSession(options);
  }

  createPortalSession({ customerId, returnUrl }) {
    return this.adapter.createPortalSession({ customerId, returnUrl });
  }
}
