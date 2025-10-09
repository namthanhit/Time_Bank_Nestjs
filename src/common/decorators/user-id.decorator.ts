import { createParamDecorator, ExecutionContext, UnauthorizedException } from '@nestjs/common';

export const UserId = createParamDecorator((_data, ctx: ExecutionContext) => {
  const req = ctx.switchToHttp().getRequest();
  const id = req.user?.userId;
  if (!id) throw new UnauthorizedException('No user in request');
  return String(id); // trả về string id
});