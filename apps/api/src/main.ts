import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import { Logger } from 'nestjs-pino';
import { AppModule } from './app.module.js';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter.js';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule, { bufferLogs: true });

  const configService = app.get(ConfigService);
  const logger = app.get(Logger);
  app.useLogger(logger);

  // Security Headers via Helmet
  app.use(helmet());

  // Cookie Parser
  app.use(cookieParser());

  // CORS Configuration
  const webOrigin = configService.get<string>('WEB_ORIGIN', 'http://localhost:5173');
  app.enableCors({
    origin: [webOrigin],
    credentials: true,
    methods: ['GET', 'HEAD', 'PUT', 'PATCH', 'POST', 'DELETE', 'OPTIONS'],
  });

  // Global API Prefix
  const apiPrefix = configService.get<string>('API_PREFIX', '/api/v1').replace(/^\//, '');
  app.setGlobalPrefix(apiPrefix);

  // Global Validation Pipe
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  // Global Exception Filter
  app.useGlobalFilters(new AllExceptionsFilter());

  const port = configService.get<number>('PORT', 3000);
  await app.listen(port);
  logger.log(`🚀 MeetCall API is running on: http://localhost:${port}/${apiPrefix}`);
}

void bootstrap();
