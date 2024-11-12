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
import emojiModel from "../models/Emoji";

export class MeController {
    path = "/@me";
    router = Router();
    constructor() {
        this.router.get(this.path, this.getMe as any);
        this.router.patch(this.path, this.updateMe as any);
        this.router.get(`${this.path}/servers`, this.getMeServers as any);
        this.router.get(`${this.path}/dms`, this.getMeDMs as any);
        this.router.get(`${this.path}/friends`, this.getMeFriends as any);
        this.router.get(`${this.path}/emojis`, this.getMeEmojis as any);

        this.router.put(`${this.path}/emojis`, this.addEmoji as any);
        this.router.delete(`${this.path}/emojis`, this.removeEmojis as any);
    }

    async removeEmojis(
        req: RequestWithUser,
        res: Response,
        next: NextFunction
    ) {
        try {
            const user = await checkIfLoggedIn(req);

            const { emojis: emojiIds } = req.body;

            if (!emojiIds || !Array.isArray(emojiIds))
                throw new HttpException(
                    HTTP_RESPONSE_CODE.BAD_REQUEST,
                    "No emoji ids provided"
                );

            const emojis = await emojiModel.find({ _id: { $in: emojiIds } });

            if (!emojis.length)
                throw new HttpException(
                    HTTP_RESPONSE_CODE.BAD_REQUEST,
                    "No emojis found"
                );

            if (emojis.some((emoji) => emoji.createdBy !== user.id))
                throw new HttpException(
                    HTTP_RESPONSE_CODE.FORBIDDEN,
                    "You do not have permission to delete these emojis"
                );

            await Promise.all(
                emojis.map(async (emoji) => {
                    await bucket.deleteObject(emoji.url);
                    await emoji.deleteOne();
                })
            );

            res.json({ success: true });
        } catch (err) {
            logger.error(err);
            next(err);
        }
    }

    async addEmoji(req: RequestWithUser, res: Response, next: NextFunction) {
        try {
            const user = await checkIfLoggedIn(req);

            if (!req.files || !req.files.emoji)
                throw new HttpException(
                    HTTP_RESPONSE_CODE.BAD_REQUEST,
                    "No emoji file provided"
                );

            const { name } = req.body;

            if (!name)
                throw new HttpException(
                    HTTP_RESPONSE_CODE.BAD_REQUEST,
                    "No emoji name provided"
                );

            const { data, mimetype } = req.files.emoji as UploadedFile;

            const snowflake = genSnowflake();

            const emojiUrl = await bucket.upload(
                data,
                `emojis/${user.id}/${snowflake}.${mimetype.split("/")[1]}`,
                {},
                mimetype
            );

            const emoji = await new emojiModel({
                _id: genSnowflake(),
                name,
                shortCode: name.split(" ").join("_").toLowerCase(),
                createdBy: user.id,
                url: emojiUrl.publicUrls[0],
                createdAt: new Date(),
                createdTimestamp: Date.now()
            }).populate("createdBy");

            await emoji.save();

            res.json(emoji);
        } catch (err) {
            logger.error(err);
            next(err);
        }
    }

    async getMeEmojis(req: RequestWithUser, res: Response, next: NextFunction) {
        try {
            const user = await checkIfLoggedIn(req);

            const emojis = await emojiModel.find({ createdBy: user.id });

            res.json(emojis);
        } catch (err) {
            logger.error(err);
            next(err);
        }
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
