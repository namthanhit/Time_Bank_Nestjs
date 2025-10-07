import { CanActivate, Injectable, ExecutionContext } from "@nestjs/common";
import { Observable } from "rxjs";

@Injectable()
export class CurrentUserGuard implements CanActivate {
    canActivate(ctx: ExecutionContext): boolean{
        const req = ctx.switchToHttp().getRequest();
        req.user = {id: 1n};
        return true;
    }
}