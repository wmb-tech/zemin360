import { createApp } from './app';

const port = Number(process.env.API_PORT ?? 3100);
const app = createApp();

export default { port, fetch: app.fetch };
console.log(`evidex-api :${port}`);
