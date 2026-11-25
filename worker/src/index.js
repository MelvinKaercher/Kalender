import { handleRequest, runScheduled } from './app.js';
import { sendPush } from './push.js';

export default {
  fetch: (request, env) => handleRequest(request, env, { sendPush }),
  scheduled: (event, env, ctx) => {
    ctx.waitUntil(runScheduled(env, { sendPush, now: new Date(event.scheduledTime) }));
  },
};
