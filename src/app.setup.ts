import { INestApplication } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { ApiExceptionFilter } from './common/api-exception.filter';
import { ErrorResponse } from './docs/schemas';

export function configureApp(app: INestApplication) {
  app.useGlobalFilters(new ApiExceptionFilter());

  const config = new DocumentBuilder()
    .setTitle('Elham Booking API')
    .setDescription(
      'Appointment booking API. No authentication. JSON only; ids are UUID strings; dates are ISO 8601 in UTC. ' +
        'Errors use the shape {"error":{"code":"...","message":"..."}}. Socket.IO events are documented in the README.',
    )
    .setVersion('1.0.0')
    .build();
  const document = SwaggerModule.createDocument(app, config, { extraModels: [ErrorResponse] });
  SwaggerModule.setup('docs', app, document, { jsonDocumentUrl: 'openapi.json' });
}
