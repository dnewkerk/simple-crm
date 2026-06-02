import { defineConfig } from "vitest/config";
import swc from "unplugin-swc";

// TypeORM entities rely on emitted decorator metadata, which esbuild (Vitest's
// default transformer) does not produce. swc does, so we transform via swc and
// run the in-memory SQLite DB declared in test.env.
export default defineConfig({
    test: {
        globals: true,
        environment: "node",
        include: ["test/**/*.test.ts"],
        env: { SQLITE_DB: ":memory:" },
    },
    plugins: [
        swc.vite({
            jsc: {
                target: "es2022",
                parser: { syntax: "typescript", decorators: true },
                transform: { legacyDecorator: true, decoratorMetadata: true },
            },
        }),
    ],
});
