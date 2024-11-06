import type { RequestWithUser } from "@furxus/types";
import { Router, type NextFunction, type Response } from "express";
import logger from "../structures/Logger";
import { HttpException } from "../exceptions/HttpException";
import { HTTP_RESPONSE_CODE } from "../Constants";
import type { UploadedFile } from "express-fileupload";
import serverModel from "../models/servers/Server";
import { genSnowflake } from "../structures/Util";
import channelModel from "../models/servers/Channel";
import memberModel from "../models/servers/Member";
import bucket from "../structures/AssetManagement";

export class ServersController {
    path = "/servers";
    router = Router();

    constructor() {
        this.router.post(this.path, this.createServer as any);
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
                user: user.id,
                server: server.id,
                permissions: ["Administrator"],
                joinedAt: new Date(),
                joinedTimestamp: Date.now()
            });

            server.generateInviteLink(server.id, member.id);
            server.channels?.push(textChannel.id);
            server.members?.push(member.user);

            if (icon) {
                const { data, mimetype } = icon;

                const iconUrl = await bucket.upload(
                    data,
                    `servers/${server.id}/icons/${genSnowflake()}.${mimetype.split("/")[1]}`,
                    {},
                    mimetype
                );

                if (iconUrl) server.icon = iconUrl.publicUrls[0];
            }

            await server.save();
            await textChannel.save();
            await member.save();

            res.json(server);
        } catch (err) {
            logger.error(err);
            next(err);
        }
    }
}
