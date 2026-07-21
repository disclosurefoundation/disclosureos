import { defineProject } from 'vitest/config';

export default defineProject({
  test: {
    name: 'instruments',
    environment: 'node',
    include: ['src/__tests__/**/*.test.ts'],
  },
});
