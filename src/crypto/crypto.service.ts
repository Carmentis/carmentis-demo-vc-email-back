import { Injectable } from '@nestjs/common';
import * as crypto from 'crypto';
import * as jose from 'jose';
@Injectable()
export class CryptoService {
  private readonly privateKey: crypto.KeyObject;
  private readonly publicKey: crypto.KeyObject;

  constructor() {
    const keyPair = crypto.generateKeyPairSync('ed25519');
    this.privateKey = keyPair.privateKey;
    this.publicKey = keyPair.publicKey;
  }

  getPublicKeyBase64url(): string {
    const raw = this.publicKey.export({ type: 'spki', format: 'der' });
    // Ed25519 SPKI DER is 44 bytes; the raw 32-byte key starts at offset 12
    const rawKey = raw.subarray(12);
    return Buffer.from(rawKey).toString('base64url');
  }

  async sign(data: string): Promise<string> {
    const sig = crypto.sign(null, Buffer.from(data), this.privateKey);
    return Buffer.from(sig).toString('base64url');
  }

  async verify(
    data: string,
    signature: string,
    publicKeyBase64url: string,
  ): Promise<boolean> {
    const pubKeyDer = Buffer.concat([
      // Ed25519 SPKI prefix
      Buffer.from('302a300506032b6570032100', 'hex'),
      Buffer.from(publicKeyBase64url, 'base64url'),
    ]);
    const pubKey = crypto.createPublicKey({
      key: pubKeyDer,
      format: 'der',
      type: 'spki',
    });
    return crypto.verify(
      null,
      Buffer.from(data),
      pubKey,
      Buffer.from(signature, 'base64url'),
    );
  }

  async verifyJWS(
    challenge: string,
    jws: string,
    didJwk: string,
  ): Promise<boolean> {
    const didParts = didJwk.split(':');
    if (didParts.length < 3 || didParts[0] !== 'did' || didParts[1] !== 'jwk') {
      return false;
    }
    const jwk = JSON.parse(Buffer.from(didParts[2], 'base64url').toString('utf8'));
    const pubKey = await jose.importJWK(
      jwk,
      'EdDSA',
    );

    //const pubKey = crypto.createPublicKey({ key: jwk, format: 'jwk' });
    try {
      const { payload } = await jose.compactVerify(jws, pubKey);
      console.log("Obtained payload:", payload)
      return true;
    } catch (error) {
      console.error("JWS verification failed:", error);
      return false;
    }
  }

  async hash(data: string, algorithm: string): Promise<Uint8Array> {
    const normalized = algorithm.replace('-', '').toLowerCase();
    return new Uint8Array(
      crypto.createHash(normalized).update(data).digest(),
    );
  }

  async generateSalt(): Promise<string> {
    return crypto.randomBytes(16).toString('base64url');
  }

  generateChallenge(): string {
    return crypto.randomBytes(32).toString('base64url');
  }

  generateCode(): string {
    return Math.floor(100000 + Math.random() * 900000).toString();
  }

  generateToken(): string {
    return crypto.randomUUID();
  }
}
