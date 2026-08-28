import {
  ExecutionContext,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { SETUP_TOKEN_HEADER } from '@trefaro/shared-models';
import type { SetupService } from './setup.service';
import { SetupGuard } from './setup.guard';

/**
 * What an anonymous caller may learn from the setup route (E28).
 *
 * The two status codes carry the availability, which is what lets the organizer
 * client pick a screen before anybody has typed a token — so they are the
 * contract, not an implementation detail.
 */
function contextWith(headers: Record<string, string> = {}): ExecutionContext {
  return {
    switchToHttp: () => ({ getRequest: () => ({ headers }) }),
  } as unknown as ExecutionContext;
}

function guardWith(options: { pending: boolean; token?: string }): SetupGuard {
  return new SetupGuard({
    isPending: async () => options.pending,
    acceptsToken: (candidate: unknown) =>
      options.token !== undefined && candidate === options.token,
  } as unknown as SetupService);
}

describe('SetupGuard', () => {
  it('lets the right token through while the instance is unclaimed', async () => {
    const guard = guardWith({ pending: true, token: 'secret' });

    await expect(
      guard.canActivate(contextWith({ [SETUP_TOKEN_HEADER]: 'secret' })),
    ).resolves.toBe(true);
  });

  it('answers 401 while unclaimed and the token is wrong or missing', async () => {
    const guard = guardWith({ pending: true, token: 'secret' });

    await expect(
      guard.canActivate(contextWith({ [SETUP_TOKEN_HEADER]: 'guess' })),
    ).rejects.toThrow(UnauthorizedException);
    await expect(guard.canActivate(contextWith())).rejects.toThrow(
      UnauthorizedException,
    );
  });

  it('answers 404 once an administrator exists, token or no token', async () => {
    const guard = guardWith({ pending: false, token: 'secret' });

    // Gone rather than forbidden, the same answer a switched-off module gives
    // (F53) — and the same answer with a valid token, so a token that leaked
    // before the instance was claimed is worth nothing afterwards.
    await expect(guard.canActivate(contextWith())).rejects.toThrow(
      NotFoundException,
    );
    await expect(
      guard.canActivate(contextWith({ [SETUP_TOKEN_HEADER]: 'secret' })),
    ).rejects.toThrow(NotFoundException);
  });

  it('checks the administrator before the token, so the 404 wins', async () => {
    const asked: string[] = [];
    const guard = new SetupGuard({
      isPending: async () => {
        asked.push('pending');
        return false;
      },
      acceptsToken: () => {
        asked.push('token');
        return true;
      },
    } as unknown as SetupService);

    await expect(guard.canActivate(contextWith())).rejects.toThrow(
      NotFoundException,
    );
    // Order matters for what is revealed: on a set-up instance the answer must
    // not depend on the token at all, or the 404 would become an oracle for it.
    expect(asked).toEqual(['pending']);
  });
});
