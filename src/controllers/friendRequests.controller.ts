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

            user.friendRequests?.sent.push(targetUser.id);
            targetUser.friendRequests?.received.push(user.id);

            await user.save();
            await targetUser.save();

            res.json({
                success: true,
                message: "Friend request sent"
            });
        } catch (err) {
            logger.error(err);
            next(err);
        }
    }
}
