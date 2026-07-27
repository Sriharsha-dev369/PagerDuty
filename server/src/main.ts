import 'dotenv/config'; // load server/.env into process.env before anything reads DATABASE_URL
import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true, // strip properties not declared in the DTO
      forbidNonWhitelisted: true, // reject requests that send unknown properties
      transform: true, // turn the raw JSON body into a typed DTO instance
    }),
  );

  await app.listen(process.env.PORT ?? 3000);
}
bootstrap();
