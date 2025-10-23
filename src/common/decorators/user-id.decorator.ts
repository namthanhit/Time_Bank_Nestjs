import { createParamDecorator, ExecutionContext, UnauthorizedException } from '@nestjs/common';

export const UserId = createParamDecorator((_data, ctx: ExecutionContext) => {
  const req = ctx.switchToHttp().getRequest();
  const sub = req.user?.sub; // JwtStrategy.validate() đã return payload => req.user
  if (!sub) throw new UnauthorizedException('No user in request');
  return String(sub);
});