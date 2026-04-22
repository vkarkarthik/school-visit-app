import app from './app.js';
import { env } from './config/env.js';
import { connectDb } from './config/db.js';

async function start() {
  await connectDb();
  const PORT = process.env.PORT || env.port || 5000;

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on port ${PORT}`);
  });
}

start().catch((error) => {
  console.error('Failed to start server:', error);
  process.exit(1);
});