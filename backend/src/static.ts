// Minimal static file server for the exported Nuxt frontend,
// so the image runs a single unprivileged process (no nginx as root).
import * as fs from 'fs';
import * as path from 'path';
import { Context, Next } from 'koa';

const TYPES: Record<string, string> = {
	'.html': 'text/html; charset=utf-8',
	'.js': 'application/javascript',
	'.css': 'text/css',
	'.json': 'application/json',
	'.webmanifest': 'application/manifest+json',
	'.png': 'image/png',
	'.ico': 'image/x-icon',
	'.svg': 'image/svg+xml',
	'.woff': 'font/woff',
	'.woff2': 'font/woff2',
	'.ttf': 'font/ttf',
	'.eot': 'application/vnd.ms-fontobject',
	'.txt': 'text/plain'
};

export default function serveStatic(root: string) {
	const base = path.resolve(root);
	return async (ctx: Context, next: Next) => {
		if (ctx.method !== 'GET' && ctx.method !== 'HEAD')
			return next();
		let file = path.resolve(base, '.' + path.posix.normalize(decodeURIComponent(ctx.path)));
		if (file !== base && !file.startsWith(base + path.sep))
			return next();
		if (fs.existsSync(file) && fs.statSync(file).isDirectory())
			file = path.join(file, 'index.html');
		if (!fs.existsSync(file))
			return next();
		ctx.type = TYPES[path.extname(file)] || 'application/octet-stream';
		// The service worker and index must always be revalidated
		if (/\/(sw\.js|index\.html)$/.test(file))
			ctx.set('Cache-Control', 'no-cache');
		ctx.body = fs.createReadStream(file);
	};
}
