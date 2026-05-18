import { describe, it } from 'node:test';
import { SDJwtInstance } from '@sd-jwt/core';
import { SDJwtVcInstance } from '@sd-jwt/sd-jwt-vc';
import { digest } from '@sd-jwt/crypto-nodejs';
import crypto from 'crypto';
import { JWK } from 'jose';

describe("test", () => {
	it("Should verify a sd-jwt", async () => {
		// provide the sd-jwt
		const credential =
			'eyJ0eXAiOiJzZCtqd3QiLCJhbGciOiJFZERTQSJ9.eyJpc3MiOiJkaWQ6andrOmV5SmpjbllpT2lKRlpESTFOVEU1SWl3aWVDSTZJamhNVEd0NVUxTmlaR0Y2VlY5clVXVlJXRUV0ZVVOaVdHbFNhR3BmWTBnME9EWnZSazFQTTFkQloyTWlMQ0pyZEhraU9pSlBTMUFpZlEiLCJpYXQiOjE3Nzg2ODAyODAsInZjdCI6IkVtYWlsQ3JlZGVudGlhbCIsInN1YiI6ImRpZDpqd2s6ZXlKcmRIa2lPaUpQUzFBaUxDSmpjbllpT2lKRlpESTFOVEU1SWl3aVlXeG5Jam9pUldSRVUwRWlMQ0o0SWpvaVpIWjZZelIzTUdWcVlUbDFaMGg1ZDE4MVpWQldjblZETkZNeFVGcEpOVVo0VlhoeGEwcHZhM0J4YnlKOSIsIl9zZCI6WyJSWTJHVGxKX3ExNXJKcGQ3WGJqWWFmcEEtVGgwdTNHRkZzMWwxcnhvaGRFIl0sIl9zZF9hbGciOiJzaGEtMjU2In0.vwLd0qm96gNM_PqvMS49mX3BBBSTztqlmcun7qp-xPj0XSIdG5hjg75P4AM3spb0uhK4-WCQsG6BBzrfGAKwBg~WyJ6TmNFV3NoMTBXWVlxMXhyYWl5TEF3IiwiZW1haWwiLCJnYW1hcmNhZGV0QGdtYWlsLmNvbSJd~';
		console.log(credential);

		// extract the claims
		const sdjwt = new SDJwtVcInstance({
			hasher: digest,
		});
		const claims = (await sdjwt.getClaims(credential)) as { iss: string };

		// extract the issuer's public key'
		const issDidJwk = claims.iss;
		const issuerJwk = JSON.parse(
			Buffer.from(issDidJwk.split(':')[2], 'base64url').toString('utf-8')
		) as any;
		console.log(issuerJwk);

		// verify the sd-jwt
		const sdjwtInstance = new SDJwtInstance({
			hasher: digest,
			verifier: (data, sig) => {

				return crypto.verify(
					null,
					Buffer.from(data),
					{
						format: 'jwk',
						key: issuerJwk,
					},
					Buffer.from(sig, 'base64url'),
				);
			}
		});
		const isValid = await sdjwtInstance.verify(credential, issuerJwk);
		console.log(isValid);




	})
})