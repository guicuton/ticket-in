import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import {
  IAuthenticatedAccount,
  IJwtGuardPayload,
} from './strategies.interface';

@Injectable()
export class AuthStrategyJwt extends PassportStrategy(Strategy) {
  constructor(readonly cs: ConfigService) {
    const secret = cs.get<string>('JWT_SECRET');
    if (!secret) throw new Error('invalid_jwt_secret');

    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: secret,
    });
  }

  validate(payload: IJwtGuardPayload): IAuthenticatedAccount {
    return {
      username: payload.username,
      id: payload.sub,
    };
  }
}
