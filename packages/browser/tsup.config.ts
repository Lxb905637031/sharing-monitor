import { defineConfig } from 'tsup'

export default defineConfig([
    {
        entry: ['src'],
        format: ['cjs'],
        sourcemap: true,
        bundle: true,
        dts: true,
        clean: true,
        minify: true,
        outDir: 'build/cjs',
    },
    {
        entry: ['src'],
        format: ['esm'],
        sourcemap: true,
        bundle: true,
        dts: true,
        clean: true,
        minify: true,
        outDir: 'build/esm',
    },
])
