import { defineConfig } from "vite";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import tsconfigPaths from "vite-tsconfig-paths";
import { cloudflare } from "@cloudflare/vite-plugin";

export default defineConfig(({ command }) => ({
	plugins: [
		tanstackStart(),
		react(),
		tailwindcss(),
		tsconfigPaths(),
		// Cloudflare plugin only during builds — Miniflare/workerd has CJS
		// compatibility issues in dev mode with some TanStack dependencies.
		// `npm run dev` uses Node's native SSR; `npm run build` targets Workers.
		// viteEnvironment.name must be "ssr" so TanStack Start's manifest plugin
		// resolves virtual:tanstack-start-client-entry to the real hashed file.
		...(command === "build" ? [cloudflare({ viteEnvironment: { name: "ssr" } })] : []),
	],
}));
