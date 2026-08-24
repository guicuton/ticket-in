const instances = Number(process.env.PM2_INSTANCES) || 2;

module.exports = {
  apps: [
    {
      name: 'ticketin-backend',
      cwd: '/app',
      script: 'backend/dist/main.js',
      exec_mode: 'cluster',
      instances,
      autorestart: true,
      max_memory_restart: '512M',
      kill_timeout: 5000,
      merge_logs: true,
      time: true,
    },
  ],
};
