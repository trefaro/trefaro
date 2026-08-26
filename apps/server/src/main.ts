import { Logger, ValidationPipe } from '@nestjs/common';
import { HttpAdapterHost, NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import cookieParser from 'cookie-parser';
import { AppModule } from './app/app.module';
import type { TrefaroEnv } from './app/core/config/env';
import { ENV } from './app/core/config/env.module';
import { AllExceptionsFilter } from './app/core/filters/all-exceptions.filter';
import { ConfiguredIoAdapter } from './app/core/websocket/configured-io.adapter';

/** REST endpoints live under `/api`; the reverse proxy routes on that prefix. */
const GLOBAL_PREFIX = 'api';

async function bootstrap(): Promise<void> {
  // The ENV provider validates the environment while the modules initialise, so
  // a misconfigured instance fails before this ever reaches `listen`.
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  const env = app.get<TrefaroEnv>(ENV);

  app.setGlobalPrefix(GLOBAL_PREFIX);

  // The administrative session travels in an HttpOnly cookie (F22).
  app.use(cookieParser());

  // Only the reverse proxy publishes a port, and it sets X-Forwarded-For — so
  // trusting exactly one hop gives the rate limiter the real client address
  // instead of the proxy's, without letting a caller forge it.
  app.set('trust proxy', 1);

  app.enableCors({
    origin: [env.publicUserClientUrl, env.publicAdminClientUrl],
    credentials: true,
  });

  // socket.io needs the same allow-list, and a gateway decorator cannot read it.
  app.useWebSocketAdapter(new ConfiguredIoAdapter(app, env));

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      // An unexpected field is a mistake worth reporting, not something to drop
      // silently — a registration form's field kit is configurable, so a typo in
      // a field key must not disappear.
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  app.useGlobalFilters(new AllExceptionsFilter(app.get(HttpAdapterHost)));

  // Plug-in web component bundles. Serving them from the server, rather than
  // from each client container, means one URL works in development (through the
  // dev-server proxy) and in production (through the reverse proxy) — and the
  // curated bundles travel with the image that already contains the plug-ins.
  // The global prefix does not apply to static assets, so it is spelled out.
  app.useStaticAssets(env.pluginBundleDir, {
    prefix: `/${GLOBAL_PREFIX}/plugins/`,
    // Bundle file names are stable, so revalidation rather than long caching.
    setHeaders: (response) =>
      response.setHeader('Cache-Control', 'no-cache, must-revalidate'),
  });

  // The OpenAPI description is served in every environment on purpose: the
  // source is public anyway (AGPL), and NFR 8 asks for thorough documentation.
  SwaggerModule.setup(
    `${GLOBAL_PREFIX}/docs`,
    app,
    SwaggerModule.createDocument(
      app,
      new DocumentBuilder()
        .setTitle('Trefaro')
        .setDescription(
          'Event management and community building for non-profit organizations. ' +
            'Endpoints are split into /api/user and /api/admin; /api/config and ' +
            '/api/health are public.',
        )
        .setVersion(env.nodeEnv === 'production' ? '1' : 'dev')
        .build(),
    ),
  );

  // Containers stop by signal; without this, shutdown hooks never run and
  // PostgreSQL sees connections drop instead of close.
  app.enableShutdownHooks();

  // 0.0.0.0, not localhost: inside a container the port must be reachable from
  // the reverse proxy.
  await app.listen(env.port, '0.0.0.0');

  Logger.log(
    `Trefaro server listening on http://0.0.0.0:${env.port}/${GLOBAL_PREFIX}`,
    'Bootstrap',
  );
}

bootstrap().catch((error: unknown) => {
  Logger.error(
    error instanceof Error ? error.message : String(error),
    'Bootstrap',
  );
  process.exitCode = 1;
});
