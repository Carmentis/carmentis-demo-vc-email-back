import { Module } from '@nestjs/common';
import { ConfigModule } from './config/config.module';
import { StorageModule } from './storage/storage.module';
import { CryptoModule } from './crypto/crypto.module';
import { EmailModule } from './email/email.module';
import { IssuerModule } from './issuer/issuer.module';
import { DemoModule } from './demo/demo.module';
import { AppController } from './app.controller';
import { AppService } from './app.service';

@Module({
  imports: [
    ConfigModule,
    StorageModule,
    CryptoModule,
    EmailModule,
    IssuerModule,
    DemoModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
