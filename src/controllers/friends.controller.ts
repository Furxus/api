import type { RequestWithUser } from "@furxus/types";
import { Router, type Response, type NextFunction } from "express";
import logger from "../structures/Logger";
import { checkIfLoggedIn } from "../structures/Util";
import { HTTP_RESPONSE_CODE } from "../Constants";
import { HttpException } from "../exceptions/HttpException";
import userModel from "../models/User";
import { sockets } from "../App";

export class FriendsController {
    path = "/friends";
    router = Router();

    constructor() {
        this.router.put(this.path, this.acceptFriendRequest as any);
        this.router.delete(`${this.path}/:userId`, this.deleteFriend as any);
    }

    async acceptFriendRequest(
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
                    "Cannot accept friend request from yourself"
                );

            if (user.friendRequests?.sent.includes(targetUser.id))
                throw new HttpException(
                    HTTP_RESPONSE_CODE.BAD_REQUEST,
                    "No friend request sent to this user"
                );

            if (!user.friendRequests?.received.includes(targetUser.id))
                throw new HttpException(
                    HTTP_RESPONSE_CODE.BAD_REQUEST,
                    "No friend request from this user"
                );

            user.friends.push(targetUser.id);
            targetUser.friends.push(user.id);

            user.friendRequests.received = user.friendRequests.received.filter(
                (id) => id !== targetUser.id
            );
            targetUser.friendRequests!.sent =
                targetUser.friendRequests!.sent.filter((id) => id !== user.id);

            const userSocket = sockets.get(user.id);
            const targetUserSocket = sockets.get(targetUser.id);

            if (userSocket) userSocket.emit("me:update", user);
            if (targetUserSocket)
                targetUserSocket.emit("me:update", targetUser);

            await user.save();
            await targetUser.save();

            res.json({ success: true });
        } catch (err) {
            logger.error(err);
            next(err);
        }
    }

    async deleteFriend(
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
                    "Cannot delete friend to yourself"
                );

            if (!user.friends.includes(targetUser.id))
                throw new HttpException(
                    HTTP_RESPONSE_CODE.BAD_REQUEST,
                    "No friend found"
                );

            if (!targetUser.friends.includes(user.id))
                throw new HttpException(
                    HTTP_RESPONSE_CODE.BAD_REQUEST,
                    "No friend found"
                );

            user.friends = user.friends.filter((id) => id !== targetUser.id);
            targetUser.friends = targetUser.friends.filter(
                (id) => id !== user.id
            );

            const userSocket = sockets.get(user.id);
            const targetUserSocket = sockets.get(targetUser.id);

            if (userSocket) userSocket.emit("me:update", user);
            if (targetUserSocket)
                targetUserSocket.emit("me:update", targetUser);

            await user.save();
            await targetUser.save();

            res.json({ success: true });
        } catch (err) {
            logger.error(err);
            next(err);
        }
    }
}
