import type { RequestWithUser } from "@furxus/types";
import { Router, type NextFunction, type Response } from "express";
import logger from "../structures/Logger";
import { HttpException } from "../exceptions/HttpException";
import { HTTP_RESPONSE_CODE } from "../Constants";
import type { UploadedFile } from "express-fileupload";
import serverModel from "../models/servers/Server";
import { genSnowflake, randInviteCode } from "../structures/Util";
import channelModel from "../models/servers/Channel";
import memberModel from "../models/servers/Member";
import bucket from "../structures/AssetManagement";
import sharp from "sharp";
import inviteModel from "../models/servers/Invite";
import userModel from "../models/User";

export class ServersController {
    path = "/servers";
    router = Router();

    constructor() {
        this.router.put(this.path, this.createServer as any);
        this.router.delete(`${this.path}/:id`, this.deleteServer as any);
        this.router.post(this.path, this.joinServer as any);
    }

    async createServer(
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

            const { user } = req;

            if (!userModel.findById(user.id))
                throw new HttpException(
                    HTTP_RESPONSE_CODE.UNAUTHORIZED,
                    "Unauthorized"
                );

            const { name } = req.body;

            if (!name)
                throw new HttpException(
                    HTTP_RESPONSE_CODE.BAD_REQUEST,
                    "Name is required"
                );

            let icon: UploadedFile | null = null;

            if (req.files && req.files.icon) {
                icon = req.files.icon as UploadedFile;

                if (!icon.mimetype.startsWith("image"))
                    throw new HttpException(
                        HTTP_RESPONSE_CODE.BAD_REQUEST,
                        "Invalid file type"
                    );
            }

            const server = new serverModel({
                _id: genSnowflake(),
                name,
                owner: user.id,
                createdAt: new Date(),
                createdTimestamp: Date.now()
            });

            const textChannel = new channelModel({
                _id: genSnowflake(),
                name: "General",
                server: server.id,
                type: "text",
                createdAt: new Date(),
                createdTimestamp: Date.now(),
                position: 0
            });

            const member = new memberModel({
                _id: genSnowflake(),
                user: user.id,
                server: server.id,
                permissions: ["Administrator"],
                joinedAt: new Date(),
                joinedTimestamp: Date.now()
            });

            const invite = new inviteModel({
                _id: genSnowflake(),
                code: randInviteCode(),
                maxUses: 0,
                expiresAt: null,
                server: server.id,
                createdBy: user.id,
                createdTimestamp: Date.now()
            });

            server.channels?.push(textChannel.id);
            server.members?.push(member.user);
            server.invites?.push(invite.id);

            if (icon) {
                const { data, mimetype } = icon;

                const snowflake = genSnowflake();

                const iconUrl = await bucket.upload(
                    data,
                    `servers/${server.id}/icons/${snowflake}.${mimetype.split("/")[1]}`,
                    {},
                    mimetype
                );

                const pngBuffer = await sharp(data).png().toBuffer();

                await bucket.upload(
                    pngBuffer,
                    `servers/${server.id}/icons/${snowflake}.png`,
                    {},
                    "image/png"
                );

                if (iconUrl) server.icon = iconUrl.publicUrls[0];
            }

            await server.save();
            await textChannel.save();
            await member.save();
            await invite.save();

            res.json(server);
        } catch (err) {
            logger.error(err);
            next(err);
        }
    }

    async deleteServer(
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

            const { user } = req;

            if (!userModel.findById(user.id))
                throw new HttpException(
                    HTTP_RESPONSE_CODE.UNAUTHORIZED,
                    "Unauthorized"
                );

            const { id } = req.params;

            const server = await serverModel.findById(id);

            if (!server)
                throw new HttpException(
                    HTTP_RESPONSE_CODE.NOT_FOUND,
                    "Server not found"
                );

            if (server.owner !== user.id)
                throw new HttpException(
                    HTTP_RESPONSE_CODE.UNAUTHORIZED,
                    "You are not the owner of this server"
                );

            await server.deleteOne();
            await channelModel.deleteMany({ server: server.id });
            await memberModel.deleteMany({ server: server.id });
            await inviteModel.deleteMany({ server: server.id });

            res.json(server);
        } catch (err) {
            logger.error(err);
            next(err);
        }
    }

    async joinServer(req: RequestWithUser, res: Response, next: NextFunction) {
        try {
            if (!req.user)
                throw new HttpException(
                    HTTP_RESPONSE_CODE.UNAUTHORIZED,
                    "Unauthorized"
                );

            const { user } = req;

            if (!userModel.findById(user.id))
                throw new HttpException(
                    HTTP_RESPONSE_CODE.UNAUTHORIZED,
                    "Unauthorized"
                );

            const { code } = req.body;

            const invite = await inviteModel.findOne({ code });
            if (!invite)
                throw new HttpException(
                    HTTP_RESPONSE_CODE.NOT_FOUND,
                    "Invalid invite code"
                );

            const server = await serverModel.findById(invite.server);

            if (!server)
                throw new HttpException(
                    HTTP_RESPONSE_CODE.NOT_FOUND,
                    "Server not found"
                );

            if (server.members?.includes(user.id)) {
                res.json(server);
                return;
            }

            if (invite.maxUses > 0 && invite.uses >= invite.maxUses)
                throw new HttpException(
                    HTTP_RESPONSE_CODE.BAD_REQUEST,
                    "Invite has reached maximum uses"
                );

            if (invite.expiresTimestamp && invite.expiresTimestamp < Date.now())
                throw new HttpException(
                    HTTP_RESPONSE_CODE.BAD_REQUEST,
                    "Invite has expired"
                );

            const member = new memberModel({
                _id: genSnowflake(),
                user: user.id,
                server: server.id,
                permissions: [],
                joinedAt: new Date(),
                joinedTimestamp: Date.now()
            });

            server.members?.push(member.user);

            server.markModified("members");

            await member.save();
            await server.save();
            await invite.updateOne({ $inc: { uses: 1 } });

            res.json(server);
        } catch (err) {
            logger.error(err);
            next(err);
        }
    }
}
