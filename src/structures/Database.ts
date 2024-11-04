import mongoose from "mongoose";
import logger from "./Logger";

const { DATABASE } = process.env;

export default class Database {
    readonly connection: typeof mongoose;
    constructor() {
        this.connection = mongoose;
    }

    connect = () =>
        this.connection
            .connect(DATABASE ?? "", {
                autoIndex: false,
                maxPoolSize: 10,
                serverSelectionTimeoutMS: 5000,
                socketTimeoutMS: 45000,
                family: 4
            })
            .then(() => logger.info("Connected to database"))
            .catch((error) => logger.error(error));

    disconnect = () =>
        this.connection
            .disconnect()
            .then(() => logger.info("Disconnected from database"))
            .catch((error) => logger.error(error));
}
