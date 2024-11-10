import type { RequestWithUser } from "@furxus/types";
import { Router, type NextFunction, type Response } from "express";
import userModel from "../models/User";
import serverModel from "../models/servers/Server";
import logger from "../structures/Logger";
import { HttpException } from "../exceptions/HttpException";
import { HTTP_RESPONSE_CODE } from "../Constants";
import type { UploadedFile } from "express-fileupload";
import { checkIfLoggedIn, dominantHex, genSnowflake } from "../structures/Util";
import bucket from "../structures/AssetManagement";

import sharp from "sharp";
import { sockets } from "../App";
import dmChannelModel from "../models/DMChannel";

export class MeController {
    path = "/@me";
    router = Router();
    constructor() {
        this.router.get(this.path, this.getMe as any);
        this.router.patch(this.path, this.updateMe as any);
        this.router.get(`${this.path}/servers`, this.getMeServers as any);
        this.router.get(`${this.path}/dms`, this.getMeDMs as any);
        this.router.get(`${this.path}/friends`, this.getMeFriends as any);
    }

    async getMe(req: RequestWithUser, res: Response, next: NextFunction) {
        try {
            const user = await checkIfLoggedIn(req);

            res.json(user);
        } catch (err) {
            logger.error(err);
            next(err);
        }
    }

    async updateMe(req: RequestWithUser, res: Response, next: NextFunction) {
        try {
            const user = await checkIfLoggedIn(req);

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

                user.accentColor = await dominantHex(iconUrl.publicUrls[0]);
            }

            if (req.body?.avatar) {
                user.avatar = req.body.avatar;
                user.accentColor = await dominantHex(req.body.avatar);
            }

            if (req.body.defaultAvatar) {
                user.avatar = null;
                const imageUrl = bucket.getObjectPublicUrls(
                    `defaultAvatar/${req.body.defaultAvatar}.png`
                )[0];
                user.defaultAvatar = imageUrl;

                user.accentColor = await dominantHex(imageUrl);
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
            await checkIfLoggedIn(req);

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

    async getMeDMs(req: RequestWithUser, res: Response, next: NextFunction) {
        try {
            const user = await checkIfLoggedIn(req);

            const dms = await dmChannelModel
                .find({
                    closed: false,
                    $or: [{ recipient1: user.id }, { recipient2: user.id }]
                })
                .populate("recipient1")
                .populate("recipient2")
                .populate({
                    path: "messages",
                    options: {
                        sort: { createdAt: -1 },
                        limit: 1
                    }
                });

            res.json(dms);
        } catch (err) {
            logger.error(err);
            next(err);
        }
    }

    async getMeFriends(
        req: RequestWithUser,
        res: Response,
        next: NextFunction
    ) {
        try {
            const user = await checkIfLoggedIn(req);

            const friends = await userModel.find({
                _id: { $in: user.friends }
            });

            res.json(friends);
        } catch (err) {
            logger.error(err);
            next(err);
        }
    }
}
