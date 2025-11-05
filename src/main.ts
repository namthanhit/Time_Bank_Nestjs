import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';
import { TimezoneInterceptor } from './common/interceptors/timezone.interceptor';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  app.setGlobalPrefix('api/v1');

  // Temporary request logger to debug Authorization header issues
  app.use((req: any, res: any, next: any) => {
    try {
      // eslint-disable-next-line no-console
      console.log('[Request Logger]', req.method, req.originalUrl || req.url, 'Authorization=', req.headers?.authorization);
    } catch (e) {}
    next();
  });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
    }),
  );

  app.useGlobalInterceptors(new TimezoneInterceptor());

  app.enableCors({
    origin: true,           
    credentials: true,
  });

  const port = Number(process.env.PORT ?? 3000);

  // bind 0.0.0.0 để thiết bị cùng mạng truy cập được
  await app.listen(port, '0.0.0.0');

}
bootstrap();
