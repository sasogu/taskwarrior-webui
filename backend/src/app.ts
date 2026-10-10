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
app.use(bodyParser());
app.use(logger());

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
