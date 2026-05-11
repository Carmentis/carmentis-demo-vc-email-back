import { Injectable, BadRequestException } from '@nestjs/common';
import { SDJwtInstance, type SdJwtPayload } from '@sd-jwt/core';
import { CryptoService } from '../crypto/crypto.service';
import { StorageService } from '../storage/storage.service';
import { EmailService } from '../email/email.service';

@Injectable()
export class IssuerService {
  private sdjwt: SDJwtInstance<SdJwtPayload>;

  constructor(
    private crypto: CryptoService,
    private storage: StorageService,
    private email: EmailService,
  ) {
    this.sdjwt = new SDJwtInstance({
      signer: (data: string) => this.crypto.sign(data),
      verifier: () => Promise.resolve(true),
      signAlg: 'EdDSA',
      hasher: (data: string, alg: string) => this.crypto.hash(data, alg),
      hashAlg: 'sha-256',
      saltGenerator: () => this.crypto.generateSalt(),
    });
  }

  createChallenge(): { challenge: string; challengeId: string } {
    const challenge = this.crypto.generateChallenge();
    const challengeId = this.crypto.generateToken();
    this.storage.setChallenge(challengeId, challenge);
    return { challenge, challengeId };
  }

  async authenticate(
    challengeId: string,
    publicKey: string,
    signature: string,
  ): Promise<{ sessionToken: string }> {
    const entry = this.storage.getChallenge(challengeId);
    if (!entry) {
      throw new BadRequestException('Invalid or expired challenge');
    }
    this.storage.deleteChallenge(challengeId);

    const valid = await this.crypto.verifyJWS(entry.challenge, signature, publicKey);
    if (!valid) {
      throw new BadRequestException('Invalid signature');
    }

    const sessionToken = this.crypto.generateToken();
    this.storage.setSession(sessionToken, publicKey);
    return { sessionToken };
  }

  async sendEmailCode(
    sessionToken: string,
    publicKey: string,
    emailAddress: string,
  ): Promise<void> {
    const code = this.crypto.generateCode();
    this.storage.setEmailCode(sessionToken, {
      email: emailAddress,
      code,
      publicKey,
      expiresAt: Date.now() + 10 * 60 * 1000,
    });
    await this.email.sendVerificationCode(emailAddress, code);
  }

  async verifyEmailCode(
    sessionToken: string,
    publicKey: string,
    code: string,
  ): Promise<{ credential: string }> {
    const entry = this.storage.getEmailCode(sessionToken);
    if (!entry) {
      throw new BadRequestException('No verification code found');
    }
    if (entry.code !== code) {
      throw new BadRequestException('Invalid verification code');
    }
    if (Date.now() > entry.expiresAt) {
      this.storage.deleteEmailCode(sessionToken);
      throw new BadRequestException('Verification code expired');
    }
    this.storage.deleteEmailCode(sessionToken);

    const credential = await this.sdjwt.issue(
      {
        iss: 'test',
        iat: Math.floor(Date.now() / 1000),
        vct: 'EmailCredential',
        sub: publicKey,
        email: entry.email,
      },
      { _sd: ['email'] },
      { header: { alg: 'ES256', typ: 'sd+jwt' } },
    );

    return { credential };
  }
}
