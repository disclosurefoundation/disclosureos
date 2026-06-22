import { defineProject } from 'vitest/config';

export default defineProject({
  test: {
    name: 'schema',
    environment: 'node',
    include: ['src/__tests__/**/*.test.ts'],
  },
});
