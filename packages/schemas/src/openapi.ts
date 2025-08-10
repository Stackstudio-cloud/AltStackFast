import { z } from 'zod';
import { toolProfileSchema } from './toolProfile';

// Minimal OpenAPI-like export from Zod types
export function toolProfileOpenApi(): Record<string, unknown> {
  const shape = (toolProfileSchema as z.ZodObject<any>).shape;
  const props: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(shape) as Array<[string, any]>) {
    const typeName = v?._def?.typeName || '';
    props[k] = { type: zodTypeToOpenApi(typeName) };
  }
  return {
    openapi: '3.1.0',
    info: { title: 'Stackfast ToolProfile', version: '1.0.0' },
    components: {
      schemas: {
        ToolProfile: {
          type: 'object',
          properties: props,
        },
      },
    },
  };
}

function zodTypeToOpenApi(name: string): string {
  switch (name) {
    case 'ZodString': return 'string';
    case 'ZodNumber': return 'number';
    case 'ZodBoolean': return 'boolean';
    case 'ZodArray': return 'array';
    case 'ZodObject': return 'object';
    default: return 'string';
  }
}


