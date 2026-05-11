import {
  Body,
  Controller,
  Get,
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
    @Body() body: { challengeId: string; publicKey: string; signature: string },
  ) {
    return this.demoService.authenticate(
      body.challengeId,
      body.publicKey,
      body.signature,
    );
  }

  @Get('profile')
  @UseGuards(AuthGuard)
  getProfile(@Req() req: any) {
    return this.demoService.getProfile(req.publicKey);
  }

  @Post('profile/vp')
  @UseGuards(AuthGuard)
  async submitVp(@Req() req: any, @Body() body: { vp: string }) {
    return this.demoService.submitVp(req.publicKey, body.vp);
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
