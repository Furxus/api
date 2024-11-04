import { createLogger, format, transports, config } from "winston";
import "winston-daily-rotate-file";
import { capitalize } from "lodash";
import moment from "moment";

const { combine, timestamp, printf, errors } = format;

const tsFormat = () => moment().format("YYYY-MM-DD HH:mm:ss A").trim();

const myFormat = printf(({ level, message, timestamp, stack }) =>
    stack
        ? `[${timestamp}] ${capitalize(level)}: ${message}\n${stack}`
        : `[${timestamp}] ${capitalize(level)}: ${message}`
);

const { NODE_ENV } = process.env;

const rotateOpts = {
    datePattern: "YYYY-MM-DD-HH",
    zippedArchive: true,
    maxSize: "20m",
    maxFiles: "14d"
};

const logger = createLogger({
    levels: config.syslog.levels,
    level: NODE_ENV === "production" ? "info" : "debug",
    format: combine(
        errors({ stack: true }),
        timestamp({
            format: tsFormat
        }),
        myFormat
    ),
    rejectionHandlers: [
        new transports.Console(),
        new transports.DailyRotateFile({
            filename: "logs/rejections-%DATE%.log",
            ...rotateOpts
        })
    ],
    exceptionHandlers: [
        new transports.Console(),
        new transports.DailyRotateFile({
            filename: "logs/exceptions-%DATE%.log",
            ...rotateOpts
        })
    ],
    transports: [
        new transports.DailyRotateFile({
            filename: "logs/errors-%DATE%.log",
            level: "error",
            ...rotateOpts
        }),
        // Re enable debug logs if needed (uncomment the line below)
        /*new transports.DailyRotateFile({
            filename: "logs/debug-%DATE%.log",
            level: "debug",
            ...rotateOpts,
        }),*/
        new transports.DailyRotateFile({
            filename: "logs/all-%DATE%.log",
            ...rotateOpts
        })
    ]
});

if (process.env.NODE_ENV !== "production") {
    logger.add(
        new transports.Console({ format: format.colorize({ all: true }) })
    );
}

export default logger;
