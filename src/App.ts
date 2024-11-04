import express from "express";
import bodyParser from "body-parser";
import cors from "cors";
import { createServer, Server as HttpServer } from "http";
import Database from "./structures/Database";
import logger from "./structures/Logger";
import authMiddleware from "./middlewares/auth.middleware";
import errorMiddleware from "./middlewares/error.middleware";

const port = process.env.PORT || 4000;

export class App {
    readonly app: express.Application;
    readonly http: HttpServer;
    readonly database: Database;

    constructor(controllers: any[]) {
        this.app = express();
        this.http = createServer(this.app);
        this.database = new Database();

        this.app.use(cors());
        this.app.use(bodyParser.json());
        this.app.use(bodyParser.urlencoded({ extended: true }));

        this.app.use(authMiddleware);
        this.initControllers(controllers);
        this.app.use(errorMiddleware);
    }

    private initControllers(controllers: any[]) {
        for (const controller of controllers) {
            this.app.use("/v2", controller.router);
        }
    }

    async start() {
        await this.database.connect();
        this.http.listen(port, () =>
            logger.info(`Server is running on ${port}`)
        );
    }
}
