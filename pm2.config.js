module.exports = {
    apps: [
        {
            name: "Furxus API",
            script: "src/index.ts",
            interpreter: "bun",
            instances: 1,
            cron_restart: "0 * * * *",
            env: {
                node_env: "production"
            }
        }
    ]
};
