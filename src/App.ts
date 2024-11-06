import express from "express";
import bodyParser from "body-parser";
import cors from "cors";
import { createServer } from "http";

import { Server as SocketServer } from "socket.io";

import Database from "./structures/Database";
import logger from "./structures/Logger";

import authMiddlewareExpress from "./middlewares/auth.middleware.express";
import authMiddlewareIO from "./middlewares/auth.middleware.io";

import errorMiddleware from "./middlewares/error.middleware";
import { MainController } from "./controllers/index.controller";
import { AuthController } from "./controllers/auth.controller";
import { MeController } from "./controllers/me.controller";
import { instrument } from "@socket.io/admin-ui";

import Mailgun from "mailgun.js";
import formData from "form-data";
import fileUpload from "express-fileupload";
import { ServersController } from "./controllers/servers.controller";

const port = process.env.PORT || 4000;

const app = express();
const http = createServer(app);
const database = new Database();

app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(
    fileUpload({
        limits: { fileSize: 50 * 1024 * 1024 }
    })
);

const controllers = [
    new MainController(),
    new AuthController(),
    new MeController(),
    new ServersController()
];

app.use(authMiddlewareExpress);
for (const controller of controllers) {
    app.use("/v2", controller.router);
}
app.use(errorMiddleware);

const io = new SocketServer(http, {
    path: "/v2/socket-io",
    connectionStateRecovery: {},
    cors: {
        origin: ["http://localhost:1420", "https://admin.socket.io"]
    }
});

io.use(authMiddlewareIO as any);

io.on("connection", (socket) => {
    logger.debug(`Socket connected: ${socket.id}`);

    socket.to(socket.id).emit("me", (socket as any).user);
});

instrument(io, {
    auth: false,
    mode: "development"
});

const mgInstance = new Mailgun(formData);
const mailgun = mgInstance.client({
    key: process.env.MAILGUN_KEY ?? "",
    username: "api"
});
await database.connect();
http.listen(port, () => {
    logger.info(`Server is running on ${port}`);
    logger.info(`Socket is running on ${port}`);
});

export { http, database, app, io, mailgun };
