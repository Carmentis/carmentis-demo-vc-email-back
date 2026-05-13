import { Injectable } from '@nestjs/common';

export interface ChallengeEntry {
	challenge: string;
	createdAt: number;
}

export interface SessionEntry {
	publicKey: string;
	createdAt: number;
}

export interface EmailCodeEntry {
	email: string;
	code: string;
	publicKey: string;
	expiresAt: number;
}

export interface DemoUser {
	publicKey: string;
	vp?: string;
	email?: string;
	createdAt: number;
}

@Injectable()
export class StorageService {
	private challenges = new Map<string, ChallengeEntry>();
	private sessions = new Map<string, SessionEntry>();
	private emailCodes = new Map<string, EmailCodeEntry>();
	private demoUsers = new Map<string, DemoUser>();

	// Challenges
	setChallenge(id: string, challenge: string): void {
		this.challenges.set(id, { challenge, createdAt: Date.now() });
	}

	getChallenge(id: string): ChallengeEntry | undefined {
		return this.challenges.get(id);
	}

	deleteChallenge(id: string): void {
		this.challenges.delete(id);
	}

	// Sessions
	setSession(token: string, publicKey: string): void {
		this.sessions.set(token, { publicKey, createdAt: Date.now() });
	}

	getSession(token: string): SessionEntry | undefined {
		return this.sessions.get(token);
	}

	deleteSession(token: string): void {
		this.sessions.delete(token);
	}

	// Email codes
	setEmailCode(sessionToken: string, entry: EmailCodeEntry): void {
		this.emailCodes.set(sessionToken, entry);
	}

	getEmailCode(sessionToken: string): EmailCodeEntry | undefined {
		return this.emailCodes.get(sessionToken);
	}

	deleteEmailCode(sessionToken: string): void {
		this.emailCodes.delete(sessionToken);
	}

	// Demo users
	setDemoUser(publicKey: string, user: DemoUser): void {
		this.demoUsers.set(publicKey, user);
	}

	getDemoUser(publicKey: string): DemoUser | undefined {
		return this.demoUsers.get(publicKey);
	}

	updateDemoUser(publicKey: string, update: Partial<DemoUser>): void {
		const user = this.demoUsers.get(publicKey);
		if (user) {
			this.demoUsers.set(publicKey, { ...user, ...update });
		}
	}
}
