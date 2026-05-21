import { Injectable, BadRequestException, Logger } from '@nestjs/common';
import { SDJwtInstance, type SdJwtPayload } from '@sd-jwt/core';
import { CryptoService } from '../crypto/crypto.service';
import { StorageService } from '../storage/storage.service';
import { EmailService } from '../email/email.service';
import { ConfigService } from '../config/config.service';

@Injectable()
export class DemoService {
	private sdjwt: SDJwtInstance<SdJwtPayload>;
	private logger = new Logger(DemoService.name);
	constructor(
		private crypto: CryptoService,
		private storage: StorageService,
		private email: EmailService,
		private config: ConfigService,
	) {
		this.sdjwt = new SDJwtInstance({
			signer: () => Promise.resolve(''),
			verifier: async (data: string, sig: string) => {
				// Verify against the issuer's public key
				return this.crypto.verify(data, sig);
			},
			hasher: (data: string, alg: string) => this.crypto.hash(data, alg),
			signAlg: 'EdDSA',
			hashAlg: 'sha-256',
			saltGenerator: () => this.crypto.generateSalt(),
		});
	}

	createVpChallenge(): { vpChallengeId: string; nonce: string; audience: string } {
		const nonce = this.crypto.generateChallenge();
		const audience = this.crypto.generateToken();
		const vpChallengeId = this.crypto.generateToken();
		this.storage.setVpChallenge(vpChallengeId, {
			nonce,
			audience,
			createdAt: Date.now(),
		});
		return { vpChallengeId, nonce, audience };
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

		const valid = await this.crypto.verifyJWS(
			entry.challenge,
			signature,
			publicKey,
		);
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
		vpChallengeId: string,
		vpToken: string,
	): Promise<{ valid: boolean; email: string }> {
		this.logger.log(`Submitting VP for publicKey: ${publicKey}`);

		const vpChallenge = this.storage.getVpChallenge(vpChallengeId);
		if (!vpChallenge) {
			throw new BadRequestException('Invalid or expired VP challenge');
		}
		this.storage.deleteVpChallenge(vpChallengeId);

		try {
			// Decode the VP token first to extract subject public key
			const decoded = await this.sdjwt.decode(vpToken);
			const vcPayload = decoded.jwt?.payload as any;
			if (!vcPayload?.sub) {
				throw new BadRequestException('Missing subject in credential');
			}

			// Verify that the subject matches the authenticated user
			if (vcPayload.sub !== publicKey) {
				throw new BadRequestException(
					'Credential subject does not match authenticated user',
				);
			}

			// Extract holder public key from sub (did:jwk)
			const subParts = (vcPayload.sub as string).split(':');
			if (
				subParts.length < 3 ||
				subParts[0] !== 'did' ||
				subParts[1] !== 'jwk'
			) {
				throw new BadRequestException('Invalid subject DID format');
			}

			const { nonce: expectedNonce, audience: expectedAudience } =
				vpChallenge;

			// Verify with kbVerifier checking nonce, audience, and holder signature
			const sdjwtWithKb = new SDJwtInstance<SdJwtPayload>({
				verifier: async (data: string, sig: string) =>
					this.crypto.verify(data, sig),
				hasher: (data: string, alg: string) =>
					this.crypto.hash(data, alg),
				signAlg: 'EdDSA',
				hashAlg: 'sha-256',
				saltGenerator: () => this.crypto.generateSalt(),
				kbVerifier: async (data: string, sig: string ) => {
					return this.crypto.verify(data, sig, vcPayload.sub);
				},
			});

			const { payload } = await sdjwtWithKb.verify(vpToken, {
				keyBindingNonce: expectedNonce,
			});
			const email = (payload as any).email;
			if (!email) {
				throw new BadRequestException(
					'Verifiable presentation does not contain an email claim',
				);
			}

			this.storage.updateDemoUser(publicKey, { vp: vpToken, email });
			return { valid: true, email };
		} catch (error) {
			this.logger.error(`Error verifying VP: ${error}`);
			if (error instanceof BadRequestException) throw error;
			throw new BadRequestException('Invalid verifiable presentation');
		}
	}

	clearVp(publicKey: string): void {
		this.storage.updateDemoUser(publicKey, { vp: undefined, email: undefined });
	}

	async prepareEmail(
		publicKey: string,
		to: string,
		subject: string,
		message: string,
	): Promise<{ anchorRequestId: string; operatorUrl: string }> {
		const user = this.storage.getDemoUser(publicKey);
		if (!user?.email) {
			throw new BadRequestException(
				'You must submit a verifiable presentation before sending emails',
			);
		}

		const { url, api_key } = this.config.get().operator;

		const body = {
			gasPriceInAtomics: 1,
			chainStorageInDays: 30,
			channels: [
				{ name: 'notifChannel', public: true },
				{ name: 'channel', public: false },
			],
			actors: [{ name: 'Operator' }, { name: user.email }],
			data: {
				notif: 'Email sent',
				sentAt: new Date().toLocaleString(),
				titre: subject,
				message,
				emailCredential: { __sd_jwt__: user.vp ?? '' },
			},
			channelAssignations: [
				{ channelName: 'notifChannel', fieldPath: 'this.notif' },
				{ channelName: 'channel', fieldPath: 'this.*' },
			],
			actorAssignations: [
				{ channelName: 'channel', actorName: user.email },
			],
			author: 'Operator',
			approvalMessage: `Approve sending email to ${to}`,
			endorser: user.email,
		};

		const response = await fetch(`${url}/api/anchorWithWallet`, {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
				Authorization: `Bearer ${api_key}`,
			},
			body: JSON.stringify(body),
		});

		if (!response.ok) {
			const text = await response.text();
			this.logger.error(`Operator error: ${text}`);
			throw new BadRequestException(`Operator error: ${text}`);
		}

		const result = await response.json();
		return { anchorRequestId: result.anchorRequestId, operatorUrl: url };
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

		await this.email.sendEmail(
			user.email,
			to,
			subject,
			message,
			attachments,
		);
	}
}
