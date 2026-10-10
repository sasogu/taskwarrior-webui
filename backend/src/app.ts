import * as Koa from 'koa';
import * as Router from '@koa/router';
import * as bodyParser from 'koa-bodyparser';
import * as logger from 'koa-logger';
import * as qs from 'koa-qs';

import tasksRouter from './tasks';
import { TaskError } from './taskwarrior';
import serveStatic from './static';

const app = new Koa();

qs(app);
app.use(logger());

// Authentication = Tailscale identity. Tailscale Serve sets Tailscale-User-Login
// for requests coming from tailnet users; the container is only published on
// 127.0.0.1, so Serve is the only way in. Fails closed if not configured.
const allowedLogins = (process.env.ALLOWED_LOGINS || '')
	.split(',').map(l => l.trim().toLowerCase()).filter(Boolean);
if (allowedLogins.length === 0)
	throw new Error('ALLOWED_LOGINS is not set');

app.use(async (ctx, next) => {
	const login = (ctx.get('Tailscale-User-Login') || '').toLowerCase();
	if (!allowedLogins.includes(login)) {
		console.warn(`denied ${ctx.method} ${ctx.path} login=${JSON.stringify(login)}`);
		ctx.status = 403;
		ctx.body = 'Forbidden';
		return;
	}
	await next();
});

app.use(bodyParser());

app.use(async (ctx, next) => {
	try {
		await next();
	}
	catch (err) {
		if (err instanceof TaskError) {
			ctx.status = err.status;
			ctx.body = err.message;
			return;
		}
		throw err;
	}
});

const router = new Router();
router.use('/tasks', tasksRouter.routes());

app.use(router.prefix('/api').routes());
app.use(router.allowedMethods());
app.use(serveStatic(process.env.STATIC_DIR || '/static'));

const prod = process.env.NODE_ENV === 'production';
const addr = prod ? '0.0.0.0' : 'localhost';
const port = +(process.env.PORT || 8080);
app.listen(port, addr);

console.log(`Server listening on http://${addr}:${port}`);
