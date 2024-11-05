import type { Request, NextFunction, Response } from "express";
import type { RequestWithUser, UserWithEmail } from "@furxus/types";

import jwt from "jsonwebtoken";
import { decrypt } from "../structures/Crypt";
import logger from "../structures/Logger";
import { HttpException } from "../exceptions/HttpException";

const { JWT_SECRET } = process.env;
if (!JWT_SECRET) throw new Error("JWT_SECRET is not defined");

const authMiddleware = (req: Request, _: Response, next: NextFunction) => {
    try {
        if (!req.headers.authorization) return next();
        const token = req.headers.authorization?.split(" ")[1] ?? null;
        if (!token) throw new HttpException(401, "Unauthorized");
        const user = jwt.verify(decrypt(token), JWT_SECRET) as UserWithEmail;
        (req as RequestWithUser).user = user;

        next();
    } catch (err) {
        logger.error(err);
        next(err);
    }
};

export default authMiddleware;
