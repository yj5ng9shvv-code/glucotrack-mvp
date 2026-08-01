import { EmailService } from './email/EmailService.js';
import { SmtpEmailService } from './email/SmtpEmailService.js';
import { MockEmailService } from './email/MockEmailService.js';
import { PaymentService } from './payment/PaymentService.js';
import { StripePaymentService } from './payment/StripePaymentService.js';
import { MockPaymentService } from './payment/MockPaymentService.js';
import { AiService } from './ai/AiService.js';
import { OpenAiService } from './ai/OpenAiService.js';
import { MockAiService } from './ai/MockAiService.js';

export function createServiceFactory({
  environment = process.env.NODE_ENV,
  requiredEnv,
  envNumber,
  envBoolean
} = {}) {
  if (environment === 'test') {
    return {
      email: new EmailService(new MockEmailService()),
      payment: new PaymentService(new MockPaymentService()),
      ai: new AiService(new MockAiService())
    };
  }

  return {
    email: new EmailService(new SmtpEmailService({ envNumber, envBoolean, requiredEnv })),
    payment: new PaymentService(new StripePaymentService({ requiredEnv })),
    ai: new AiService(new OpenAiService({ requiredEnv }))
  };
}
