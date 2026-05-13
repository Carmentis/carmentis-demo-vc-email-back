import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import * as crypto from 'crypto';
import { existsSync, readFileSync, writeFileSync } from 'fs';
import * as jose from 'jose';
import { base64url } from 'jose';

const KEYS_FILE = process.env.KEYS_FILE ?? 'keys.json';

@Injectable()
export class CryptoService implements OnModuleInit {
	private readonly logger = new Logger(CryptoService.name);

	private publicJwk: { crv: string; x: string; kty: string };
	private privateJwk: { crv: string; d: string; x: string; kty: string };

	private privateKey: CryptoKey | Uint8Array;
	private publicKey: CryptoKey | Uint8Array;

	constructor() {}

	async onModuleInit() {
		if (existsSync(KEYS_FILE)) {
			this.logger.log(`Loading keys from ${KEYS_FILE}`);
			const raw = readFileSync(KEYS_FILE, 'utf-8');
			const parsed = JSON.parse(raw) as {
				publicJwk: typeof this.publicJwk;
				privateJwk: typeof this.privateJwk;
			};
			this.publicJwk = parsed.publicJwk;
			this.privateJwk = parsed.privateJwk;
		} else {
			this.logger.warn(
				`No key file found at ${KEYS_FILE}, generating a new key pair`,
			);
			const { publicKey, privateKey } = await jose.generateKeyPair('EdDSA', {
				crv: 'Ed25519',
				extractable: true,
			});
			this.publicJwk = (await jose.exportJWK(publicKey)) as typeof this.publicJwk;
			this.privateJwk = (await jose.exportJWK(privateKey)) as typeof this.privateJwk;
			writeFileSync(
				KEYS_FILE,
				JSON.stringify({ publicJwk: this.publicJwk, privateJwk: this.privateJwk }, null, 2),
				'utf-8',
			);
			this.logger.log(`New key pair generated and saved to ${KEYS_FILE}`);
		}

		this.privateKey = await jose.importJWK(this.privateJwk, 'Ed25519');
		this.publicKey = await jose.importJWK(this.publicJwk, 'Ed25519');
		this.logger.log(`Public key (JWK): ${JSON.stringify(this.publicJwk)}`);
	}

	getPublicKeyBase64url(): string {
		return `did:jwk:${base64url.encode(JSON.stringify(this.publicJwk))}`;
	}

	async sign(data: string): Promise<string> {
		const sig = crypto.sign(null, Buffer.from(data), {
			format: 'jwk',
			key: this.privateJwk,
		});
		const signature = Buffer.from(sig).toString('base64url');
		this.logger.debug(`Signing data: ${data} -> ${signature}`);
		return signature;
	}

	async verify(
		data: string,
		signature: string,
		didJwk?: string,
	): Promise<boolean> {
		if (didJwk) {
			this.logger.debug(
				`Verifying data: ${data} + ${signature} + ${didJwk}`,
			);
			return crypto.verify(
				null,
				Buffer.from(data),
				{
					format: 'jwk',
					// eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
					key: JSON.parse(
						Buffer.from(didJwk.split(':')[2], 'base64url').toString(
							'utf8',
						),
					),
				},
				Buffer.from(signature, 'base64url'),
			);
		} else {
			this.logger.debug(`Verifying data: ${data} + ${signature}`);
			const result = crypto.verify(
				null,
				Buffer.from(data),
				{
					format: 'jwk',
					key: this.publicJwk,
				},
				Buffer.from(signature, 'base64url'),
			);
			this.logger.debug(`Verified?: ${result}`);
			return result;
		}
	}

	async verifyJWS(
		challenge: string,
		jws: string,
		didJwk: string,
	): Promise<boolean> {
		this.logger.debug(`Verifying JWS ${jws}`);
		const didParts = didJwk.split(':');
		if (
			didParts.length < 3 ||
			didParts[0] !== 'did' ||
			didParts[1] !== 'jwk'
		) {
			return false;
		}
		const jwk = JSON.parse(
			Buffer.from(didParts[2], 'base64url').toString('utf8'),
		);
		const pubKey = await jose.importJWK(jwk, 'EdDSA');

		//const pubKey = crypto.createPublicKey({ key: jwk, format: 'jwk' });
		try {
			const { payload } = await jose.compactVerify(jws, pubKey);
			console.log('Obtained payload:', payload);
			return true;
		} catch (error) {
			console.error('JWS verification failed:', error);
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
