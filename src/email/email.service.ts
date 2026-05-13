import { Injectable } from '@nestjs/common';
import * as nodemailer from 'nodemailer';
import { ConfigService } from '../config/config.service';

@Injectable()
export class EmailService {
	private transporter: nodemailer.Transporter;

	constructor(private configService: ConfigService) {
		const { host, port, secure, auth } = this.configService.get().email;
		this.transporter = nodemailer.createTransport({
			host,
			port,
			secure,
			auth,
		});
	}

	async sendVerificationCode(to: string, code: string): Promise<void> {
		const from = this.configService.get().email.from;
		await this.transporter.sendMail({
			from,
			to,
			subject: 'Your verification code',
			text: `Your verification code is: ${code}\n\nThis code expires in 10 minutes.`,
			html: `
        <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto; padding: 24px;">
          <h2 style="color: #333;">Verification Code</h2>
          <p>Your verification code is:</p>
          <div style="font-size: 32px; font-weight: bold; letter-spacing: 8px; text-align: center; padding: 16px; background: #f5f5f5; border-radius: 8px; margin: 16px 0;">
            ${code}
          </div>
          <p style="color: #666; font-size: 14px;">This code expires in 10 minutes.</p>
        </div>
      `,
		});
	}

	async sendEmail(
		fromEmail: string,
		to: string,
		subject: string,
		message: string,
		attachments?: Express.Multer.File[],
	): Promise<void> {
		const from = this.configService.get().email.from;
		await this.transporter.sendMail({
			from,
			replyTo: fromEmail,
			to,
			subject,
			text: message,
			html: `
        <div style="font-family: sans-serif; max-width: 640px; margin: 0 auto; padding: 24px;">
          <p style="color: #666; font-size: 12px;">Sent by ${fromEmail} via Carmentis Email Demo</p>
          <hr style="border: none; border-top: 1px solid #eee; margin: 16px 0;" />
          <div style="white-space: pre-wrap;">${message.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</div>
        </div>
      `,
			attachments: attachments?.map((file) => ({
				filename: file.originalname,
				content: file.buffer,
				contentType: file.mimetype,
			})),
		});
	}
}
