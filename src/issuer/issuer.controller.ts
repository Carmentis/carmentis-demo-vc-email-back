import { Body, Controller, Get, Post, Req, UseGuards } from '@nestjs/common';
import { IssuerService } from './issuer.service';
import { AuthGuard } from '../guards/auth.guard';
import { ConfigService } from '../config/config.service';

@Controller('issuer')
export class IssuerController {
	constructor(
		private issuerService: IssuerService,
		private configService: ConfigService,
	) {}

	@Get('config')
	getConfig() {
		return { relayUrl: this.configService.get().relay.url };
	}

	@Get('challenge')
	getChallenge() {
		return this.issuerService.createChallenge();
	}

	@Post('auth')
	async authenticate(
		@Body() body: { challengeId: string; pk: string; signature: string },
	) {
		console.log('Authenticating with:', body);
		return this.issuerService.authenticate(
			body.challengeId,
			body.pk,
			body.signature,
		);
	}

	@Post('email/send-code')
	@UseGuards(AuthGuard)
	async sendCode(@Req() req: any, @Body() body: { email: string }) {
		await this.issuerService.sendEmailCode(
			req.sessionToken,
			req.publicKey,
			body.email,
		);
		return { message: 'Verification code sent' };
	}

	@Post('email/verify-code')
	@UseGuards(AuthGuard)
	async verifyCode(@Req() req: any, @Body() body: { code: string }) {
		return this.issuerService.verifyEmailCode(
			req.sessionToken,
			req.publicKey,
			body.code,
		);
	}
}
