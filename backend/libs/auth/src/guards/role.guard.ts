import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { IAuthenticatedAccount } from '../strategies/strategies.interface';

@Injectable()
export class RoleGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const roles: string[] = this.reflector.getAllAndOverride('roles', [
      context.getHandler(),
      context.getClass(),
    ]);

    if (!roles || roles.length === 0) return true;

    const { user }: { user?: IAuthenticatedAccount } = context
      .switchToHttp()
      .getRequest();

    if (!user?.role || !roles.includes(user.role))
      throw new ForbiddenException('insufficient_role');

    return true;
  }
}
