import {
	CanActivate,
	ExecutionContext,
	Injectable,
	UnauthorizedException,
} from '@nestjs/common';
import { StorageService } from '../storage/storage.service';

@Injectable()
export class AuthGuard implements CanActivate {
	constructor(private storage: StorageService) {}

	canActivate(context: ExecutionContext): boolean {
		const request = context.switchToHttp().getRequest();
		const token = request.headers['x-session-token'] as string;
		if (!token) {
			throw new UnauthorizedException('Missing session token');
		}
		const session = this.storage.getSession(token);
		if (!session) {
			throw new UnauthorizedException('Invalid session token');
		}
		(request as any).publicKey = session.publicKey;
		(request as any).sessionToken = token;
		return true;
	}
}
