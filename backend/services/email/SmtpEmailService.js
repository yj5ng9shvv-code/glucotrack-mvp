import nodemailer from 'nodemailer';

export class SmtpEmailService {
  #transport;
  constructor({ envNumber, envBoolean, requiredEnv }) { this.envNumber=envNumber; this.envBoolean=envBoolean; this.requiredEnv=requiredEnv; }
  async send(message) {
    if (!this.#transport) {
      const host=process.env.SMTP_HOST ?? '127.0.0.1'; const local=host==='127.0.0.1'||host==='localhost';
      this.#transport=nodemailer.createTransport({host,port:this.envNumber('SMTP_PORT',25),secure:this.envBoolean('SMTP_SECURE',false),ignoreTLS:this.envBoolean('SMTP_IGNORE_TLS',local),tls:{rejectUnauthorized:this.envBoolean('SMTP_REJECT_UNAUTHORIZED',true)},...(process.env.SMTP_USER?{auth:{user:process.env.SMTP_USER,pass:this.requiredEnv('SMTP_PASSWORD')}}:{})});
    }
    return this.#transport.sendMail({from:process.env.EMAIL_FROM ?? 'GlucoTrack <support@glukotrack.com>',...message});
  }
}
