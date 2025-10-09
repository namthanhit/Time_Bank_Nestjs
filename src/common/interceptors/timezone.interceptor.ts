import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
import { Observable, map } from 'rxjs';
import { toZonedTime, format } from 'date-fns-tz';

const TZ = 'Asia/Ho_Chi_Minh';
function toTZ(val: any): any {
  if (val instanceof Date) {
    const z = toZonedTime(val, TZ);
    return format(z, "yyyy-MM-dd'T'HH:mm:ssXXX", { timeZone: TZ });
  }
  if (Array.isArray(val)) return val.map(toTZ);
  if (val && typeof val === 'object') {
    const out: any = {};
    for (const k of Object.keys(val)) out[k] = toTZ(val[k]);
    return out;
  }
  return val;
}

@Injectable()
export class TimezoneInterceptor implements NestInterceptor {
  intercept(_: ExecutionContext, next: CallHandler): Observable<any> {
    return next.handle().pipe(map((data) => toTZ(data)));
  }
}
