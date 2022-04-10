/// <reference types="vitest" />
import { configDefaults, defineConfig } from "vitest/config";

export default defineConfig({
  test: { include: [...configDefaults.include, "lib/**/*.js"] },
});
