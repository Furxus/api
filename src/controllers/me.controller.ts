import type { RequestWithUser } from "@furxus/types";
import { Router, type NextFunction, type Response } from "express";
import userModel from "../models/User";
import serverModel from "../models/servers/Server";
import logger from "../structures/Logger";
import { HttpException } from "../exceptions/HttpException";
import { HTTP_RESPONSE_CODE } from "../Constants";
import type { UploadedFile } from "express-fileupload";
import { genSnowflake } from "../structures/Util";
import bucket from "../structures/AssetManagement";

import sharp from "sharp";
import { sockets } from "../App";

export class MeController {
    path = "/@me";
    router = Router();
    constructor() {
        this.router.get(this.path, this.getMe as any);
        this.router.patch(this.path, this.updateMe as any);
        this.router.get(`${this.path}/servers`, this.getMeServers as any);
    }

    async getMe(req: RequestWithUser, res: Response, next: NextFunction) {
        try {
            if (!req.user)
                throw new HttpException(
                    HTTP_RESPONSE_CODE.UNAUTHORIZED,
                    "Unauthorized"
                );

            res.json(await userModel.findById(req.user.id));
        } catch (err) {
            logger.error(err);
            next(err);
        }
    }

    async updateMe(req: RequestWithUser, res: Response, next: NextFunction) {
        try {
            if (!req.user)
                throw new HttpException(
                    HTTP_RESPONSE_CODE.UNAUTHORIZED,
                    "Unauthorized"
                );

            const user = await userModel.findById(req.user.id);

            if (!user)
                throw new HttpException(
                    HTTP_RESPONSE_CODE.NOT_FOUND,
                    "Uh oh, user not found"
                );

            if (req.body.username) {
                const { username } = req.body;

                if (username.length < 3 || username.length > 32) {
                    throw new HttpException(
                        HTTP_RESPONSE_CODE.BAD_REQUEST,
                        "Username must be between 3 and 32 characters"
                    );
                }

                if (await userModel.findOne({ username }))
                    throw new HttpException(
                        HTTP_RESPONSE_CODE.BAD_REQUEST,
                        "Username is already taken"
                    );

                user.username = username;
            }

            if (req.files?.avatar) {
                if (user.avatar) {
                    user.previousAvatars.push(user.avatar);
                    if (user.previousAvatars.length > 5) {
                        const removedAvatar = user.previousAvatars.shift();
                        if (removedAvatar) {
                            await bucket.deleteObject(
                                `avatars/${user.id}/${removedAvatar}`
                            );
                        }
                    }
                }

                const { data, mimetype } = req.files.avatar as UploadedFile;

                const snowflake = genSnowflake();

                const iconUrl = await bucket.upload(
                    data,
                    `avatars/${user.id}/${snowflake}.${mimetype.split("/")[1]}`,
                    {},
                    mimetype
                );

                if (mimetype.includes("gif")) {
                    const pngBuffer = await sharp(data).png().toBuffer();

                    await bucket.upload(
                        pngBuffer,
                        `avatars/${user.id}/${snowflake}.png`,
                        {},
                        "image/png"
                    );
                }

                if (iconUrl) user.avatar = iconUrl.publicUrls[0];
            }

            if (req.body?.avatar) {
                user.avatar = req.body.avatar;
            }

            if (req.body.defaultAvatar) {
                user.avatar = null;
                user.defaultAvatar = req.body.defaultAvatar;
            }

            if (req.body.displayName) {
                user.displayName = req.body.displayName;
            }

            if (req.body.bio) {
                user.bio = req.body.bio;
            }

            const socket = sockets.get(user.id);

            if (socket) {
                socket.emit("me:update", user);
            }

            await user.save();

            res.json(user);
        } catch (err) {
            logger.error(err);
            next(err);
        }
    }

    async getMeServers(
        req: RequestWithUser,
        res: Response,
        next: NextFunction
    ) {
        try {
            if (!req.user)
                throw new HttpException(
                    HTTP_RESPONSE_CODE.UNAUTHORIZED,
                    "Unauthorized"
                );

            if (!(await userModel.findById(req.user.id)))
                throw new HttpException(
                    HTTP_RESPONSE_CODE.UNAUTHORIZED,
                    "Unaothorized"
                );

            const servers = await serverModel
                .find({
                    $or: [
                        { owner: req.user?.id },
                        { members: { $in: [req.user?.id] } }
                    ]
                })
                .populate("owner")
                .populate({
                    path: "invites",
                    populate: {
                        path: "createdBy"
                    }
                })
                .exec()
                .then((servers) => servers.reverse());

            res.json(servers);
        } catch (err) {
            logger.error(err);
            next(err);
        }
    }
}
