import type { RequestWithUser } from "@furxus/types";
import { Router, type NextFunction, type Response } from "express";
import logger from "../structures/Logger";
import userModel from "../models/User";
import { HttpException } from "../exceptions/HttpException";
import { HTTP_RESPONSE_CODE } from "../Constants";
import { checkIfLoggedIn } from "../structures/Util";
import { sockets } from "../App";

export class FriendRequestsController {
    path = "/friend-requests";
    router = Router();

    constructor() {
        this.router.put(this.path, this.sendFriendRequest as any);
        this.router.delete(
            `${this.path}/:userId`,
            this.deleteFriendRequest as any
        );
    }

    async sendFriendRequest(
        req: RequestWithUser,
        res: Response,
        next: NextFunction
    ) {
        try {
            const user = await checkIfLoggedIn(req);
            const { userId } = req.body;

            const targetUser = await userModel.findById(userId);

            if (!targetUser)
                throw new HttpException(
                    HTTP_RESPONSE_CODE.NOT_FOUND,
                    "User not found"
                );

            if (user.id === targetUser.id)
                throw new HttpException(
                    HTTP_RESPONSE_CODE.BAD_REQUEST,
                    "Cannot send friend request to yourself"
                );

            if (user.friends.includes(targetUser.id)) {
                throw new HttpException(
                    HTTP_RESPONSE_CODE.BAD_REQUEST,
                    "Friend request already sent or user is already a friend"
                );
            }

            if (user.friendRequests?.sent.includes(targetUser.id)) {
                throw new HttpException(
                    HTTP_RESPONSE_CODE.BAD_REQUEST,
                    "Friend request already sent"
                );
            }

            if (user.friendRequests?.received.includes(userId))
                throw new HttpException(
                    HTTP_RESPONSE_CODE.BAD_REQUEST,
                    "Friend request already received"
                );

            if (
                user.friendRequests?.received.includes(targetUser.id) &&
                targetUser.friendRequests?.sent.includes(user.id)
            ) {
                user.friends.push(targetUser.id);
                targetUser.friends.push(user.id);

                user.friendRequests.received =
                    user.friendRequests.received.filter(
                        (id) => id !== targetUser.id
                    );
                targetUser.friendRequests.sent =
                    targetUser.friendRequests.sent.filter(
                        (id) => id !== user.id
                    );

                await user.save();
                await targetUser.save();

                const userSocket = sockets.get(user.id);
                const targetUserSocket = sockets.get(targetUser.id);

                if (userSocket) userSocket.emit("me:update", user);
                if (targetUserSocket)
                    targetUserSocket.emit("me:update", targetUser);

                res.json({
                    success: true
                });
                return;
            }

            user.friendRequests?.sent.push(targetUser.id);
            targetUser.friendRequests?.received.push(user.id);

            await user.save();
            await targetUser.save();

            const userSocket = sockets.get(user.id);
            const targetUserSocket = sockets.get(targetUser.id);

            if (userSocket) userSocket.emit("me:update", user);
            if (targetUserSocket)
                targetUserSocket.emit("me:update", targetUser);

            res.json({
                success: true
            });
        } catch (err) {
            logger.error(err);
            next(err);
        }
    }

    async deleteFriendRequest(
        req: RequestWithUser,
        res: Response,
        next: NextFunction
    ) {
        try {
            const user = await checkIfLoggedIn(req);

            const { userId } = req.params;

            const targetUser = await userModel.findById(userId);

            if (!targetUser)
                throw new HttpException(
                    HTTP_RESPONSE_CODE.NOT_FOUND,
                    "User not found"
                );

            if (user.id === targetUser.id)
                throw new HttpException(
                    HTTP_RESPONSE_CODE.BAD_REQUEST,
                    "Cannot delete friend request to yourself"
                );

            if (!user.friendRequests?.sent.includes(targetUser.id))
                throw new HttpException(
                    HTTP_RESPONSE_CODE.BAD_REQUEST,
                    "Friend request not found"
                );

            if (!targetUser.friendRequests?.received.includes(user.id))
                throw new HttpException(
                    HTTP_RESPONSE_CODE.BAD_REQUEST,
                    "Friend request not found"
                );

            user.friendRequests.sent = user.friendRequests.sent.filter(
                (id) => id !== targetUser.id
            );
            targetUser.friendRequests.received =
                targetUser.friendRequests.received.filter(
                    (id) => id !== user.id
                );

            await user.save();
            await targetUser.save();

            const userSocket = sockets.get(user.id);
            const targetUserSocket = sockets.get(targetUser.id);

            if (userSocket) userSocket.emit("me:update", user);
            if (targetUserSocket)
                targetUserSocket.emit("me:update", targetUser);

            res.json({
                success: true
            });
        } catch (err) {
            logger.error(err);
            next(err);
        }
    }
}
