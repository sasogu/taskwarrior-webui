import * as Router from '@koa/router';
import * as taskwarrior from './taskwarrior';
import { Task } from "taskwarrior-lib";

const router = new Router();

router.get('/', async ctx => {
	const tasks = taskwarrior.load();
	ctx.body = tasks;
});

router.put('/', async ctx => {
	const body = ctx.request.body as { tasks: Task[] };
	const msg = taskwarrior.update(body.tasks);
	console.log(msg);
	ctx.status = 200;
});

router.delete('/', async ctx => {
	const query = ctx.query.tasks;
	const tasks = Array.isArray(query) ? query : [query];
	const msg = taskwarrior.del(tasks);
	console.log(msg);
	ctx.status = 200;
});

export default router;
