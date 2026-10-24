import { SORT_OPTIONS } from '../domain/pagination.js';
import { CATEGORIES } from '../domain/vehicle.js';

/**
 * The OpenAPI 3.0 description of the API, written by hand and kept honest by
 * test/integration/openapi.test.ts: that test compares it with the routes the app really
 * registers, with ACCESS_POLICY, with the fields the validators require, and with real responses.
 * When a route or a response changes, the test fails until this file changes with it.
 *
 * Money is always an integer in minor units (paise).
 */

type Json = Record<string, unknown>;

const schemaRef = (name: string): Json => ({ $ref: `#/components/schemas/${name}` });
const responseRef = (name: string): Json => ({ $ref: `#/components/responses/${name}` });
const parameterRef = (name: string): Json => ({ $ref: `#/components/parameters/${name}` });

const json = (schema: Json): Json => ({ 'application/json': { schema } });
const ok = (description: string, schema: Json): Json => ({ description, content: json(schema) });

const BEARER: Json[] = [{ bearerAuth: [] }];
const ADMIN_NOTE = ' Admin only: a signed-in USER gets 403.';

// Errors every operation can produce, whatever its own rules (oversized body, bad JSON, bugs).
const UNEXPECTED = { default: responseRef('Unexpected') };

const uuid = (description: string): Json => ({ type: 'string', format: 'uuid', description });
const timestamp: Json = { type: 'string', format: 'date-time' };
const minorUnits = (description: string): Json => ({ type: 'integer', minimum: 0, description });

const schemas: Record<string, Json> = {
  Problem: {
    type: 'object',
    description:
      'Every error uses this shape (RFC 7807 style). `code` is stable and meant for programs.',
    required: ['type', 'title', 'status', 'code', 'detail', 'requestId'],
    properties: {
      type: { type: 'string', example: 'about:blank' },
      title: { type: 'string', example: 'Conflict' },
      status: { type: 'integer', example: 409 },
      code: { type: 'string', example: 'OUT_OF_STOCK' },
      detail: { type: 'string', example: 'Only 0 units left.' },
      requestId: { type: 'string', description: 'Also sent as the X-Request-Id header.' },
      errors: {
        type: 'array',
        description: 'Present for validation errors: one entry per problem field.',
        items: schemaRef('FieldError'),
      },
    },
  },
  FieldError: {
    type: 'object',
    required: ['field', 'message'],
    properties: {
      field: { type: 'string', example: 'price' },
      message: { type: 'string' },
    },
  },
  HealthStatus: {
    type: 'object',
    required: ['status'],
    properties: { status: { type: 'string', enum: ['ok', 'ready'] } },
  },
  PublicUser: {
    type: 'object',
    required: ['id', 'email', 'name', 'role', 'createdAt'],
    properties: {
      id: uuid('User id.'),
      email: { type: 'string', format: 'email' },
      name: { type: 'string' },
      role: { type: 'string', enum: ['USER', 'ADMIN'] },
      createdAt: timestamp,
    },
  },
  RegisterRequest: {
    type: 'object',
    required: ['email', 'password', 'name'],
    additionalProperties: false,
    properties: {
      email: { type: 'string', format: 'email', maxLength: 254 },
      password: {
        type: 'string',
        minLength: 10,
        maxLength: 128,
        description: 'At least 10 characters and not a common password.',
      },
      name: { type: 'string', minLength: 1, maxLength: 100 },
    },
  },
  LoginRequest: {
    type: 'object',
    required: ['email', 'password'],
    additionalProperties: false,
    properties: {
      email: { type: 'string', format: 'email' },
      password: { type: 'string' },
    },
  },
  TokenResponse: {
    type: 'object',
    required: ['accessToken', 'tokenType', 'expiresIn'],
    properties: {
      accessToken: {
        type: 'string',
        description: 'Short-lived JWT. Send as `Authorization: Bearer <token>`.',
      },
      tokenType: { type: 'string', enum: ['Bearer'] },
      expiresIn: { type: 'integer', description: 'Seconds until the access token expires.' },
    },
  },
  LoginResponse: {
    type: 'object',
    required: ['accessToken', 'tokenType', 'expiresIn', 'user'],
    properties: {
      accessToken: { type: 'string' },
      tokenType: { type: 'string', enum: ['Bearer'] },
      expiresIn: { type: 'integer' },
      user: schemaRef('PublicUser'),
    },
  },
  Vehicle: {
    type: 'object',
    required: [
      'id',
      'make',
      'model',
      'category',
      'price',
      'quantity',
      'year',
      'bodyStyle',
      'colorOptions',
      'description',
      'createdAt',
      'updatedAt',
    ],
    properties: {
      id: uuid('Vehicle id.'),
      make: { type: 'string' },
      model: { type: 'string' },
      category: { type: 'string', enum: [...CATEGORIES] },
      price: minorUnits('Price in minor units (paise).'),
      quantity: {
        type: 'integer',
        minimum: 0,
        description: 'Units in stock. Purchase is refused at 0.',
      },
      year: { type: 'integer', nullable: true },
      bodyStyle: {
        type: 'string',
        enum: [...CATEGORIES],
        description: 'Which illustration template draws the car.',
      },
      colorOptions: { type: 'array', items: { type: 'string', pattern: '^#[0-9a-fA-F]{6}$' } },
      description: { type: 'string', nullable: true },
      createdAt: timestamp,
      updatedAt: timestamp,
    },
  },
  CreateVehicleRequest: {
    type: 'object',
    required: ['make', 'model', 'category', 'price', 'quantity'],
    additionalProperties: false,
    properties: {
      make: { type: 'string', minLength: 1, maxLength: 60 },
      model: { type: 'string', minLength: 1, maxLength: 60 },
      category: { type: 'string', enum: [...CATEGORIES] },
      price: {
        type: 'integer',
        minimum: 1,
        maximum: 1_000_000_000_000,
        description: 'Minor units (paise).',
      },
      quantity: { type: 'integer', minimum: 0, maximum: 100_000 },
      year: { type: 'integer', minimum: 1886 },
      bodyStyle: {
        type: 'string',
        enum: [...CATEGORIES],
        description: 'Defaults to the category.',
      },
      colorOptions: {
        type: 'array',
        maxItems: 8,
        items: { type: 'string', pattern: '^#[0-9a-fA-F]{6}$' },
      },
      description: { type: 'string', maxLength: 2000 },
    },
  },
  UpdateVehicleRequest: {
    type: 'object',
    minProperties: 1,
    additionalProperties: false,
    description: 'Any subset of these fields. `quantity` is not accepted: use purchase or restock.',
    properties: {
      make: { type: 'string', minLength: 1, maxLength: 60 },
      model: { type: 'string', minLength: 1, maxLength: 60 },
      category: { type: 'string', enum: [...CATEGORIES] },
      price: { type: 'integer', minimum: 1, maximum: 1_000_000_000_000 },
      year: { type: 'integer', minimum: 1886, nullable: true },
      bodyStyle: { type: 'string', enum: [...CATEGORIES] },
      colorOptions: {
        type: 'array',
        maxItems: 8,
        items: { type: 'string', pattern: '^#[0-9a-fA-F]{6}$' },
      },
      description: { type: 'string', maxLength: 2000, nullable: true },
    },
  },
  PageMeta: {
    type: 'object',
    required: ['page', 'pageSize', 'total', 'totalPages'],
    properties: {
      page: { type: 'integer', minimum: 1 },
      pageSize: { type: 'integer', minimum: 1, maximum: 50 },
      total: { type: 'integer', minimum: 0 },
      totalPages: { type: 'integer', minimum: 0 },
    },
  },
  VehiclePage: {
    type: 'object',
    required: ['data', 'meta'],
    properties: {
      data: { type: 'array', items: schemaRef('Vehicle') },
      meta: schemaRef('PageMeta'),
    },
  },
  PurchaseRequest: {
    type: 'object',
    additionalProperties: false,
    properties: { quantity: { type: 'integer', minimum: 1, maximum: 10, default: 1 } },
  },
  Order: {
    type: 'object',
    required: [
      'id',
      'userId',
      'vehicleId',
      'quantity',
      'unitPrice',
      'totalPrice',
      'vehicleLabel',
      'createdAt',
    ],
    properties: {
      id: uuid('Order id.'),
      userId: uuid('The buyer.'),
      vehicleId: uuid('The vehicle bought (it may be soft-deleted later).'),
      quantity: { type: 'integer', minimum: 1 },
      unitPrice: minorUnits('Price per unit when bought, in minor units.'),
      totalPrice: minorUnits('quantity × unitPrice, in minor units.'),
      vehicleLabel: { type: 'string', description: '"Make Model" when bought.' },
      createdAt: timestamp,
    },
  },
  PurchaseResponse: {
    type: 'object',
    required: ['vehicle', 'order'],
    properties: { vehicle: schemaRef('Vehicle'), order: schemaRef('Order') },
  },
  OrderPage: {
    type: 'object',
    required: ['data', 'meta'],
    properties: { data: { type: 'array', items: schemaRef('Order') }, meta: schemaRef('PageMeta') },
  },
  RestockRequest: {
    type: 'object',
    required: ['quantity'],
    additionalProperties: false,
    properties: { quantity: { type: 'integer', minimum: 1, maximum: 10_000 } },
  },
  InventoryEvent: {
    type: 'object',
    required: ['id', 'type', 'delta', 'quantityAfter', 'createdAt', 'vehicle', 'actor'],
    properties: {
      id: uuid('Event id.'),
      type: { type: 'string', enum: ['CREATED', 'UPDATED', 'PURCHASED', 'RESTOCKED', 'DELETED'] },
      delta: { type: 'integer', description: 'Change in stock: negative for a purchase.' },
      quantityAfter: { type: 'integer', minimum: 0 },
      createdAt: timestamp,
      vehicle: {
        type: 'object',
        required: ['id', 'make', 'model'],
        properties: {
          id: uuid('Vehicle id.'),
          make: { type: 'string' },
          model: { type: 'string' },
        },
      },
      actor: {
        type: 'object',
        required: ['id', 'name'],
        properties: { id: uuid('Who did it.'), name: { type: 'string' } },
      },
    },
  },
  EventFeed: {
    type: 'object',
    required: ['data'],
    properties: { data: { type: 'array', items: schemaRef('InventoryEvent') } },
  },
};

const problem = (description: string): Json => ({
  description,
  content: json(schemaRef('Problem')),
});

const responses: Record<string, Json> = {
  BadRequest: problem(
    'The request is invalid. `errors` names each problem field (code VALIDATION_ERROR).',
  ),
  Unauthorized: problem('No valid access token (code UNAUTHENTICATED).'),
  Forbidden: problem('Signed in, but the role is not allowed (code FORBIDDEN).'),
  VehicleNotFound: problem('No live vehicle with this id (code VEHICLE_NOT_FOUND).'),
  OutOfStock: problem('Not enough units left (code OUT_OF_STOCK). `detail` says how many remain.'),
  EmailTaken: problem('An account with this email exists (code EMAIL_TAKEN).'),
  InvalidCredentials: problem('Email or password is incorrect (code INVALID_CREDENTIALS).'),
  RateLimited: problem('Too many failed logins from this address (code RATE_LIMITED).'),
  NotReady: problem('The database cannot be reached (code NOT_READY).'),
  Unexpected: problem(
    'Any other error: bad JSON, body too large, unknown route, or a server fault.',
  ),
};

const parameters: Record<string, Json> = {
  VehicleId: { name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } },
  Page: { name: 'page', in: 'query', schema: { type: 'integer', minimum: 1, default: 1 } },
  PageSize: {
    name: 'pageSize',
    in: 'query',
    schema: { type: 'integer', minimum: 1, maximum: 50, default: 20 },
  },
  VehicleSort: {
    name: 'sort',
    in: 'query',
    schema: { type: 'string', enum: [...SORT_OPTIONS], default: '-createdAt' },
  },
};

const jsonBody = (schema: string): Json => ({
  required: true,
  content: json(schemaRef(schema)),
});

const queryParam = (name: string, schema: Json, description: string): Json => ({
  name,
  in: 'query',
  description,
  schema,
});

const searchParameters: Json[] = [
  queryParam(
    'q',
    { type: 'string', minLength: 1, maxLength: 100 },
    'Words that must each appear in the make or model, any order, case-insensitive.',
  ),
  queryParam('make', { type: 'string' }, 'Whole make, case-insensitive.'),
  queryParam('model', { type: 'string' }, 'Whole model, case-insensitive.'),
  queryParam('category', { type: 'string', enum: [...CATEGORIES] }, 'Category.'),
  queryParam('minPrice', { type: 'integer', minimum: 0 }, 'Lowest price, minor units, inclusive.'),
  queryParam(
    'maxPrice',
    { type: 'integer', minimum: 0 },
    'Highest price, minor units, inclusive. Must not be below minPrice.',
  ),
  queryParam(
    'inStock',
    { type: 'string', enum: ['true', 'false'] },
    'true: units in stock. false: sold out.',
  ),
  parameterRef('Page'),
  parameterRef('PageSize'),
  parameterRef('VehicleSort'),
];

export const openApiDocument: Json = {
  openapi: '3.0.3',
  info: {
    title: 'Cove API',
    version: '0.1.0',
    description:
      'REST API for the Cove car dealership inventory system (a TDD kata). ' +
      'Prices are integers in minor units (paise). This is a demo: a purchase only moves inventory, ' +
      'there are no payments, and the seeded vehicles are sample data.',
  },
  servers: [{ url: '/' }],
  tags: [
    { name: 'Health' },
    { name: 'Auth' },
    { name: 'Vehicles' },
    { name: 'Inventory' },
    { name: 'Orders' },
    { name: 'Admin' },
  ],
  paths: {
    '/api/health': {
      get: {
        operationId: 'getHealth',
        tags: ['Health'],
        summary: 'Liveness probe',
        description: 'Answers while the process is up. Does not touch the database.',
        security: [],
        responses: { '200': ok('The process is alive.', schemaRef('HealthStatus')), ...UNEXPECTED },
      },
    },
    '/api/ready': {
      get: {
        operationId: 'getReady',
        tags: ['Health'],
        summary: 'Readiness probe',
        description: 'Answers 200 only when the database responds.',
        security: [],
        responses: {
          '200': ok('Ready for traffic.', schemaRef('HealthStatus')),
          '503': responseRef('NotReady'),
          ...UNEXPECTED,
        },
      },
    },
    '/api/auth/register': {
      post: {
        operationId: 'register',
        tags: ['Auth'],
        summary: 'Create an account',
        description: 'Always creates a USER. A `role` field is rejected.',
        security: [],
        requestBody: jsonBody('RegisterRequest'),
        responses: {
          '201': ok('The new account (never includes the password hash).', schemaRef('PublicUser')),
          '400': responseRef('BadRequest'),
          '409': responseRef('EmailTaken'),
          ...UNEXPECTED,
        },
      },
    },
    '/api/auth/login': {
      post: {
        operationId: 'login',
        tags: ['Auth'],
        summary: 'Sign in',
        description:
          'Returns a short-lived access token in the body and sets the httpOnly `refresh_token` cookie ' +
          '(path /api/auth). Unknown email and wrong password give the same 401. Failed attempts are rate limited per IP.',
        security: [],
        requestBody: jsonBody('LoginRequest'),
        responses: {
          '200': ok('Signed in.', schemaRef('LoginResponse')),
          '400': responseRef('BadRequest'),
          '401': responseRef('InvalidCredentials'),
          '429': responseRef('RateLimited'),
          ...UNEXPECTED,
        },
      },
    },
    '/api/auth/refresh': {
      post: {
        operationId: 'refresh',
        tags: ['Auth'],
        summary: 'Exchange the refresh cookie for a new access token',
        description:
          'Authenticated by the `refresh_token` cookie, not a bearer token. The cookie is rotated. ' +
          'Presenting a used cookie again revokes every session of that user.',
        security: [],
        responses: {
          '200': ok('A new access token; a new refresh cookie is set.', schemaRef('TokenResponse')),
          '401': responseRef('Unauthorized'),
          ...UNEXPECTED,
        },
      },
    },
    '/api/auth/logout': {
      post: {
        operationId: 'logout',
        tags: ['Auth'],
        summary: 'Sign out',
        description: 'Revokes the refresh token chain and clears the cookie. Always answers 204.',
        security: [],
        responses: { '204': { description: 'Signed out. No body.' }, ...UNEXPECTED },
      },
    },
    '/api/auth/me': {
      get: {
        operationId: 'getMe',
        tags: ['Auth'],
        summary: 'The signed-in user',
        security: BEARER,
        responses: {
          '200': ok('The current user.', schemaRef('PublicUser')),
          '401': responseRef('Unauthorized'),
          ...UNEXPECTED,
        },
      },
    },
    '/api/vehicles': {
      get: {
        operationId: 'listVehicles',
        tags: ['Vehicles'],
        summary: 'List vehicles',
        description: 'Vehicles that are not soft-deleted, sold-out ones included.',
        security: BEARER,
        parameters: [parameterRef('Page'), parameterRef('PageSize'), parameterRef('VehicleSort')],
        responses: {
          '200': ok('One page of vehicles.', schemaRef('VehiclePage')),
          '400': responseRef('BadRequest'),
          '401': responseRef('Unauthorized'),
          ...UNEXPECTED,
        },
      },
      post: {
        operationId: 'createVehicle',
        tags: ['Vehicles'],
        summary: 'Add a vehicle',
        description: `Creates a vehicle and a CREATED inventory event.${ADMIN_NOTE}`,
        'x-required-role': 'ADMIN',
        security: BEARER,
        requestBody: jsonBody('CreateVehicleRequest'),
        responses: {
          '201': ok('The new vehicle.', schemaRef('Vehicle')),
          '400': responseRef('BadRequest'),
          '401': responseRef('Unauthorized'),
          '403': responseRef('Forbidden'),
          ...UNEXPECTED,
        },
      },
    },
    '/api/vehicles/search': {
      get: {
        operationId: 'searchVehicles',
        tags: ['Vehicles'],
        summary: 'Search vehicles',
        description: 'Filters combine with AND. Unknown parameters are rejected.',
        security: BEARER,
        parameters: searchParameters,
        responses: {
          '200': ok('One page of matches.', schemaRef('VehiclePage')),
          '400': responseRef('BadRequest'),
          '401': responseRef('Unauthorized'),
          ...UNEXPECTED,
        },
      },
    },
    '/api/vehicles/{id}': {
      get: {
        operationId: 'getVehicle',
        tags: ['Vehicles'],
        summary: 'Get one vehicle',
        security: BEARER,
        parameters: [parameterRef('VehicleId')],
        responses: {
          '200': ok('The vehicle.', schemaRef('Vehicle')),
          '400': responseRef('BadRequest'),
          '401': responseRef('Unauthorized'),
          '404': responseRef('VehicleNotFound'),
          ...UNEXPECTED,
        },
      },
      put: {
        operationId: 'updateVehicle',
        tags: ['Vehicles'],
        summary: 'Update a vehicle',
        description: `Partial update; send only the fields to change.${ADMIN_NOTE}`,
        'x-required-role': 'ADMIN',
        security: BEARER,
        parameters: [parameterRef('VehicleId')],
        requestBody: jsonBody('UpdateVehicleRequest'),
        responses: {
          '200': ok('The updated vehicle.', schemaRef('Vehicle')),
          '400': responseRef('BadRequest'),
          '401': responseRef('Unauthorized'),
          '403': responseRef('Forbidden'),
          '404': responseRef('VehicleNotFound'),
          ...UNEXPECTED,
        },
      },
      delete: {
        operationId: 'deleteVehicle',
        tags: ['Vehicles'],
        summary: 'Delete a vehicle',
        description: `Soft delete: orders keep their snapshots.${ADMIN_NOTE}`,
        'x-required-role': 'ADMIN',
        security: BEARER,
        parameters: [parameterRef('VehicleId')],
        responses: {
          '204': { description: 'Deleted. No body.' },
          '400': responseRef('BadRequest'),
          '401': responseRef('Unauthorized'),
          '403': responseRef('Forbidden'),
          '404': responseRef('VehicleNotFound'),
          ...UNEXPECTED,
        },
      },
    },
    '/api/vehicles/{id}/purchase': {
      post: {
        operationId: 'purchaseVehicle',
        tags: ['Inventory'],
        summary: 'Buy a vehicle',
        description:
          'Takes `quantity` units (default 1, at most 10) in one atomic step that also stores the order ' +
          'and a PURCHASED event. Two buyers can never take the same last unit.',
        security: BEARER,
        parameters: [parameterRef('VehicleId')],
        requestBody: { required: false, content: json(schemaRef('PurchaseRequest')) },
        responses: {
          '200': ok('The vehicle after the sale and the order.', schemaRef('PurchaseResponse')),
          '400': responseRef('BadRequest'),
          '401': responseRef('Unauthorized'),
          '404': responseRef('VehicleNotFound'),
          '409': responseRef('OutOfStock'),
          ...UNEXPECTED,
        },
      },
    },
    '/api/vehicles/{id}/restock': {
      post: {
        operationId: 'restockVehicle',
        tags: ['Inventory'],
        summary: 'Add stock',
        description: `Adds \`quantity\` units (1 to 10,000) and writes a RESTOCKED event.${ADMIN_NOTE}`,
        'x-required-role': 'ADMIN',
        security: BEARER,
        parameters: [parameterRef('VehicleId')],
        requestBody: jsonBody('RestockRequest'),
        responses: {
          '200': ok('The vehicle after restocking.', schemaRef('Vehicle')),
          '400': responseRef('BadRequest'),
          '401': responseRef('Unauthorized'),
          '403': responseRef('Forbidden'),
          '404': responseRef('VehicleNotFound'),
          ...UNEXPECTED,
        },
      },
    },
    '/api/orders/mine': {
      get: {
        operationId: 'listMyOrders',
        tags: ['Orders'],
        summary: 'My orders',
        description: "Only the caller's own orders, newest first.",
        security: BEARER,
        parameters: [parameterRef('Page'), parameterRef('PageSize')],
        responses: {
          '200': ok('One page of orders.', schemaRef('OrderPage')),
          '400': responseRef('BadRequest'),
          '401': responseRef('Unauthorized'),
          ...UNEXPECTED,
        },
      },
    },
    '/api/admin/events': {
      get: {
        operationId: 'listInventoryEvents',
        tags: ['Admin'],
        summary: 'Recent inventory events',
        description: `The newest ledger entries, newest first.${ADMIN_NOTE}`,
        'x-required-role': 'ADMIN',
        security: BEARER,
        parameters: [
          queryParam(
            'limit',
            { type: 'integer', minimum: 1, maximum: 100, default: 20 },
            'How many events to return.',
          ),
        ],
        responses: {
          '200': ok('The feed.', schemaRef('EventFeed')),
          '400': responseRef('BadRequest'),
          '401': responseRef('Unauthorized'),
          '403': responseRef('Forbidden'),
          ...UNEXPECTED,
        },
      },
    },
  },
  components: {
    securitySchemes: {
      bearerAuth: { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' },
    },
    parameters,
    responses,
    schemas,
  },
};
