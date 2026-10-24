import { Router } from 'express';
import swaggerUi from 'swagger-ui-express';
import { openApiDocument } from '../openapi/document.js';

/** Public: the API description as JSON, and Swagger UI rendering it. */
export function docsRoutes(): Router {
  const router = Router();
  router.get('/openapi.json', (_req, res) => {
    res.json(openApiDocument);
  });
  router.use(
    '/docs',
    swaggerUi.serve,
    swaggerUi.setup(openApiDocument as Record<string, unknown>, {
      customSiteTitle: 'Cove API docs',
    }),
  );
  return router;
}
