import { Injectable, BadRequestException } from '@nestjs/common';
import { SDJwtInstance, type SdJwtPayload } from '@sd-jwt/core';
import { CryptoService } from '../crypto/crypto.service';
import { StorageService } from '../storage/storage.service';
import { EmailService } from '../email/email.service';

@Injectable()
export class DemoService {
  private sdjwt: SDJwtInstance<SdJwtPayload>;

  constructor(
    private crypto: CryptoService,
    private storage: StorageService,
    private email: EmailService,
  ) {
    this.sdjwt = new SDJwtInstance({
      signer: () => Promise.resolve(''),
      verifier: async (data: string, sig: string) => {
        // Verify against the issuer's public key
        return this.crypto.verify(data, sig, this.crypto.getPublicKeyBase64url());
      },
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

    const valid = await this.crypto.verify(entry.challenge, signature, publicKey);
    if (!valid) {
      throw new BadRequestException('Invalid signature');
    }

    const sessionToken = this.crypto.generateToken();
    this.storage.setSession(sessionToken, publicKey);

    // Create demo user if not exists
    if (!this.storage.getDemoUser(publicKey)) {
      this.storage.setDemoUser(publicKey, {
        publicKey,
        createdAt: Date.now(),
      });
    }

    return { sessionToken };
  }

  getProfile(publicKey: string) {
    const user = this.storage.getDemoUser(publicKey);
    return {
      publicKey,
      hasVp: !!user?.vp,
      email: user?.email ?? null,
    };
  }

  async submitVp(
    publicKey: string,
    vp: string,
  ): Promise<{ valid: boolean; email: string }> {
    try {
      const { payload } = await this.sdjwt.verify(vp);
      const email = (payload as any).email;
      if (!email) {
        throw new BadRequestException(
          'Verifiable presentation does not contain an email claim',
        );
      }

      this.storage.updateDemoUser(publicKey, { vp, email });
      return { valid: true, email };
    } catch (error) {
      if (error instanceof BadRequestException) throw error;
      throw new BadRequestException('Invalid verifiable presentation');
    }
  }

  async sendEmail(
    publicKey: string,
    to: string,
    subject: string,
    message: string,
    attachments?: Express.Multer.File[],
  ): Promise<void> {
    const user = this.storage.getDemoUser(publicKey);
    if (!user?.email) {
      throw new BadRequestException(
        'You must submit a verifiable presentation before sending emails',
      );
    }

    await this.email.sendEmail(user.email, to, subject, message, attachments);
  }
}
