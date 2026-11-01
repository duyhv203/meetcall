import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import type { AuthUser } from '@meetcall/shared';
import type { AuthenticatedRequest } from '../guards/auth.guard.js';

export const CurrentUser = createParamDecorator(
  (data: keyof AuthUser | undefined, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest<AuthenticatedRequest>();
    const user = request.user;

    return data ? user?.[data] : user;
  },
);
