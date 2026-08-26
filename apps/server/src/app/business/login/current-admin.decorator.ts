import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { CURRENT_ADMIN_PROPERTY, type RequestWithAdmin } from './admin.guard';
import type { AuthenticatedAdmin } from './ports/admin-session.repository';

/**
 * The administrator behind the current request.
 *
 * Non-null wherever it can be used: {@link AdminGuard} has already run for
 * every route below `admin/`, and a route that is not below `admin/` has no
 * business asking.
 */
export const CurrentAdmin = createParamDecorator(
  (_data: unknown, context: ExecutionContext): AuthenticatedAdmin => {
    const request = context.switchToHttp().getRequest<RequestWithAdmin>();
    const admin = request[CURRENT_ADMIN_PROPERTY];
    if (!admin) {
      throw new Error(
        'CurrentAdmin used on a route that is not behind the administrative guard',
      );
    }
    return admin;
  },
);
