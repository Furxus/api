import type { UserWithEmail } from "@furxus/types";

import jwt from "jsonwebtoken";
import { decrypt } from "../structures/Crypt";
import logger from "../structures/Logger";
import { HttpException } from "../exceptions/HttpException";
import type { Socket } from "socket.io";

const { JWT_SECRET } = process.env;
if (!JWT_SECRET) throw new Error("JWT_SECRET is not defined");

const authMiddleware = (
    socket: Socket & { user: UserWithEmail },
    next: any
) => {
    try {
        if (!socket.handshake.auth) return next();
        const token = socket.handshake.auth.token ?? null;
        if (!token) throw new HttpException(401, "Unauthorized");
        const user = jwt.verify(decrypt(token), JWT_SECRET) as UserWithEmail;
        socket.user = user;

        next();
    } catch (err) {
        logger.error(err);
        next(err);
    }
};

export default authMiddleware;
