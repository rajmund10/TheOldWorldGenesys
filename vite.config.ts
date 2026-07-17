import { AliasOptions, defineConfig } from 'vite';
import dotenv from 'dotenv';
import dotenvExpand from 'dotenv-expand';
import pluginVue from '@vitejs/plugin-vue';
import path from 'path';
import process from 'process';
import fs from 'fs';

const env = dotenv.config();
dotenvExpand.expand(env);

const PROXY_HOST = process.env.VITE_PROXY_HOST ?? 'localhost';
const PROXY_PORT = process.env.VITE_PROXY_PORT ?? 30000;
const COPY_PUBLIC_DIR = process.env.VITE_COPY_PUBLIC_DIR !== 'false';

/**
 * A list of aliases to be applied only in production.
 */
let releaseOnlyAliases: AliasOptions = [];

let devOnlyAliases: AliasOptions = [];

if (process.env.NODE_ENV === 'production') {
	releaseOnlyAliases = [{ find: 'vue', replacement: path.resolve(__dirname, 'node_modules/vue/dist/vue.esm-browser.prod.js') }];
} else {
	devOnlyAliases = [];
}

function copyPublicDirSkippingLocks(source: string, target: string, cleanTarget = false) {
	if (!fs.existsSync(source)) {
		return;
	}

	fs.mkdirSync(target, { recursive: true });

	if (cleanTarget && fs.existsSync(target)) {
		const sourceEntries = new Set(fs.readdirSync(source).filter((name) => name !== 'LOCK'));
		for (const entry of fs.readdirSync(target, { withFileTypes: true })) {
			if (sourceEntries.has(entry.name)) {
				continue;
			}

			try {
				fs.rmSync(path.join(target, entry.name), { recursive: true, force: true });
			} catch (error) {
				const message = error instanceof Error ? error.message : String(error);
				console.warn(`[vite] Could not remove stale public asset "${path.join(target, entry.name)}". It may be locked by Foundry. ${message}`);
			}
		}
	}

	for (const entry of fs.readdirSync(source, { withFileTypes: true })) {
		if (entry.name === 'LOCK') {
			continue;
		}

		const sourcePath = path.join(source, entry.name);
		const targetPath = path.join(target, entry.name);

		if (entry.isDirectory()) {
			copyPublicDirSkippingLocks(sourcePath, targetPath, true);
		} else if (entry.isFile()) {
			fs.copyFileSync(sourcePath, targetPath);
		}
	}
}

function copyPublicDirPlugin() {
	return {
		name: 'copy-public-dir-skip-locks',
		closeBundle() {
			if (!COPY_PUBLIC_DIR) {
				return;
			}

			copyPublicDirSkippingLocks(path.resolve(__dirname, 'public'), path.resolve(__dirname, 'dist'));
		},
	};
}

// https://vitejs.dev/config/
export default defineConfig({
	// Proxy w/Foundry. See https://foundryvtt.wiki/en/development/guides/vite
	base: '/systems/genesys',
	server: {
		port: 30001,
		open: false,
		proxy: {
			'^/assets': `http://${ PROXY_HOST }:${ PROXY_PORT }/systems/genesys/`,
			'^(?!/systems/genesys)': `http://${ PROXY_HOST }:${ PROXY_PORT }/`,
			'/socket.io': {
				target: `ws://${ PROXY_HOST }:${ PROXY_PORT }`,
				ws: true,
			},
		},
	},
	publicDir: 'public',
	build: {
		outDir: 'dist',
		emptyOutDir: false,
		sourcemap: true,
		// Avoiding minification is important, because we don't want names of globals/etc. to be mangled.
		minify: false,
		lib: {
			name: 'Genesys',
			entry: 'src/Genesys.ts',
			formats: ['es'], // ES Modules
			fileName: 'Genesys',
		},
		copyPublicDir: false,
	},
	plugins: [pluginVue(), copyPublicDirPlugin()],
	resolve: {
		alias: [{ find: '@', replacement: path.resolve(__dirname, 'src') }, { find: '@scss', replacement: path.resolve(__dirname, 'src/scss') }, ...devOnlyAliases, ...releaseOnlyAliases],
	},
});
