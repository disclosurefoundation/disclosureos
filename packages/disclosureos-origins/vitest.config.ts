import { defineProject } from 'vitest/config';

export default defineProject({
  test: {
    name: 'origins',
    environment: 'node',
    include: ['src/__tests__/**/*.test.ts'],
  },
});
