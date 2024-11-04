import type { NextFunction, Request, Response } from "express";
import type { HttpException } from "../exceptions/HttpException";

const errorMiddleware = (
    error: HttpException,
    _: Request,
    res: Response,
    __: NextFunction
) => {
    const status = error.status ?? 500;
    const message = status === 500 ? "Internal server error" : error.message;
    const errors = error.errors ?? [];

    res.status(status).send({ status, message, errors });
};

export default errorMiddleware;
