import { Module } from '@nestjs/common';
import { IssuerController } from './issuer.controller';
import { IssuerService } from './issuer.service';
import { EmailModule } from '../email/email.module';

@Module({
	imports: [EmailModule],
	controllers: [IssuerController],
	providers: [IssuerService],
})
export class IssuerModule {}
