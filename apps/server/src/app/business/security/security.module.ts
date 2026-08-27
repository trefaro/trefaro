import { Module } from '@nestjs/common';
import { TokenSigner } from './token-signer';

/**
 * Cryptographic building blocks the business layer shares.
 *
 * Only the signer so far (E5). It lives in its own module rather than inside the
 * registration module because the participant self-service links of AP 9 use the
 * same signature, and a shared building block that sits inside one feature
 * module gets copied instead of imported.
 */
@Module({
  providers: [TokenSigner],
  exports: [TokenSigner],
})
export class SecurityModule {}
