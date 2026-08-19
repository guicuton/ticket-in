export const config = () => ({
  TIMEZONE: 'America/Sao_Paulo',
  DATABASE: {
    URL: process.env.POSTGRES_DATABASE_URL,
  },
  JWT_SECRET: process.env.JWT_SECRET,

  CACHE: {
    REDIS: {
      URL: `redis://${process.env.REDIS_HOST}:${process.env.REDIS_PORT}`,
      HOST: process.env.REDIS_HOST,
      PORT: process.env.REDIS_PORT,
      PASS: process.env.REDIS_PASS,
      TTL: 60 * 60 * 24 * 1000, // 1 day,
    },
  },
});
