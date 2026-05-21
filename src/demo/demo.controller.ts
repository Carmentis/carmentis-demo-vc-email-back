import {
	Body,
	Controller,
	Delete,
	Get,
	Logger,
	Post,
	Req,
	UploadedFiles,
	UseGuards,
	UseInterceptors,
} from '@nestjs/common';
import { FilesInterceptor } from '@nestjs/platform-express';
import { DemoService } from './demo.service';
import { AuthGuard } from '../guards/auth.guard';
import { ConfigService } from '../config/config.service';

@Controller('demo')
export class DemoController {
	private logger = new Logger(DemoController.name);
	constructor(
		private demoService: DemoService,
		private configService: ConfigService,
	) {}

	@Get('config')
	getConfig() {
		return { relayUrl: this.configService.get().relay.url };
	}

	@Get('challenge')
	getChallenge() {
		return this.demoService.createChallenge();
	}

	@Post('auth')
	async authenticate(
		@Body() body: { challengeId: string; pk: string; signature: string },
	) {
		this.logger.log('Authenticating with challenge id ' + body.challengeId);
		this.logger.log('Authenticating with public key ' + body.pk);
		this.logger.log('Authenticating with signature ' + body.signature);
		return this.demoService.authenticate(
			body.challengeId,
			body.pk,
			body.signature,
		);
	}

	@Get('profile')
	@UseGuards(AuthGuard)
	getProfile(@Req() req: any) {
		return this.demoService.getProfile(req.publicKey);
	}

	@Get('vp-challenge')
	@UseGuards(AuthGuard)
	getVpChallenge() {
		return this.demoService.createVpChallenge();
	}

	@Post('profile/vp')
	@UseGuards(AuthGuard)
	async submitVp(
		@Req() req: any,
		@Body() body: { vpChallengeId: string; vp_token: string },
	) {
		return this.demoService.submitVp(
			req.publicKey,
			body.vpChallengeId,
			body.vp_token,
		);
	}

	@Delete('profile/vp')
	@UseGuards(AuthGuard)
	deleteVp(@Req() req: any) {
		this.demoService.clearVp(req.publicKey);
		return { success: true };
	}

	@Post('email/prepare')
	@UseGuards(AuthGuard)
	async prepareEmail(
		@Req() req: any,
		@Body() body: { to: string; subject: string; message: string },
	) {
		return this.demoService.prepareEmail(
			req.publicKey,
			body.to,
			body.subject,
			body.message,
		);
	}

	@Post('email/send')
	@UseGuards(AuthGuard)
	@UseInterceptors(
		FilesInterceptor('attachments', 10, {
			limits: { fileSize: 10 * 1024 * 1024 },
		}),
	)
	async sendEmail(
		@Req() req: any,
		@Body() body: { to: string; subject: string; message: string },
		@UploadedFiles() attachments?: Array<Express.Multer.File>,
	) {
		await this.demoService.sendEmail(
			req.publicKey,
			body.to,
			body.subject,
			body.message,
			attachments,
		);
		return { success: true };
	}
}
