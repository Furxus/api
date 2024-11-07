import type { RequestWithUser } from "@furxus/types";
import { Router, type NextFunction, type Response } from "express";
import logger from "../structures/Logger";
import { HTTP_RESPONSE_CODE } from "../Constants";
import { HttpException } from "../exceptions/HttpException";
import serverModel from "../models/servers/Server";
import channelModel from "../models/servers/Channel";
import messageModel from "../models/Message";
import { genSnowflake } from "../structures/Util";
import { io } from "../App";

export class ChannelsController {
    path = "/channels";
    router = Router();

    constructor() {
        this.router.get(
            `${this.path}/:channelId/messages`,
            this.getChannelMessages as any
        );

        this.router.get(
            `${this.path}/:serverId/:channelId`,
            this.getServerChannel as any
        );
        this.router.get(
            `${this.path}/:serverId`,
            this.getServerChannels as any
        );
        this.router.get(`${this.path}/:channelId`, this.getChannel as any);

        this.router.put(this.path, this.createChannel as any);

        this.router.delete(
            `${this.path}/:channelId`,
            this.deleteChannel as any
        );
    }

    async deleteChannel(
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

            if (!user)
                throw new HttpException(
                    HTTP_RESPONSE_CODE.UNAUTHORIZED,
                    "Unauthorized"
                );

            const { channelId } = req.params;

            if (!channelId)
                throw new HttpException(
                    HTTP_RESPONSE_CODE.BAD_REQUEST,
                    "Channel ID is required"
                );

            console.log(channelId);

            const channel = await channelModel.findById(channelId);

            if (!channel)
                throw new HttpException(
                    HTTP_RESPONSE_CODE.NOT_FOUND,
                    "Channel not found"
                );

            const server = await serverModel.findById(channel.server);

            if (!server)
                throw new HttpException(
                    HTTP_RESPONSE_CODE.NOT_FOUND,
                    "Server not found"
                );

            if (!server.members?.includes(user.id))
                throw new HttpException(
                    HTTP_RESPONSE_CODE.UNAUTHORIZED,
                    "Unauthorized"
                );

            await channel.deleteOne();

            io.to(server.id).emit("channel:delete", channel);

            res.json(channel);
        } catch (err) {
            logger.error(err);
            next(err);
        }
    }

    async createChannel(
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

            if (!user)
                throw new HttpException(
                    HTTP_RESPONSE_CODE.UNAUTHORIZED,
                    "Unauthorized"
                );

            const { serverId, name, type } = req.body;

            if (!serverId || !name || !type)
                throw new HttpException(
                    HTTP_RESPONSE_CODE.BAD_REQUEST,
                    "Server ID, Name and Type are required"
                );

            const server = await serverModel.findById(serverId);

            if (!server)
                throw new HttpException(
                    HTTP_RESPONSE_CODE.NOT_FOUND,
                    "Server not found"
                );

            if (!server.members?.includes(user.id))
                throw new HttpException(
                    HTTP_RESPONSE_CODE.UNAUTHORIZED,
                    "Unauthorized"
                );

            const channel = await channelModel.create({
                _id: genSnowflake(),
                name,
                type,
                server: server.id,
                createdAt: new Date(),
                createdTimestamp: Date.now(),
                position: server.channels?.length
            });

            io.to(server.id).emit("channel:create", channel);

            res.json(channel);
        } catch (err) {
            logger.error(err);
            next(err);
        }
    }

    async getChannelMessages(
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

            if (!user)
                throw new HttpException(
                    HTTP_RESPONSE_CODE.UNAUTHORIZED,
                    "Unauthorized"
                );

            const { channelId } = req.params;

            if (!channelId)
                throw new HttpException(
                    HTTP_RESPONSE_CODE.BAD_REQUEST,
                    "Channel ID is required"
                );

            const channel = await channelModel.findById(channelId);

            if (!channel)
                throw new HttpException(
                    HTTP_RESPONSE_CODE.NOT_FOUND,
                    "Channel not found"
                );

            const { limit, cursor } = req.query;

            const messages = messageModel
                .find({
                    channel: channel.id,
                    ...(cursor
                        ? {
                              createdTimestamp: {
                                  $lt: parseInt(cursor.toString())
                              }
                          }
                        : {})
                })
                .sort({ createdTimestamp: -1 });

            if (limit) messages.limit(parseInt(limit.toString()));

            res.json(await messages);
        } catch (err) {
            logger.error(err);
            next(err);
        }
    }

    async getServerChannel(
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

            if (!user)
                throw new HttpException(
                    HTTP_RESPONSE_CODE.UNAUTHORIZED,
                    "Unauthorized"
                );

            const { serverId, channelId } = req.params;

            if (!serverId || !channelId)
                throw new HttpException(
                    HTTP_RESPONSE_CODE.BAD_REQUEST,
                    "Server ID and Channel ID are required"
                );

            const server = await serverModel.findById(serverId);

            if (!server)
                throw new HttpException(
                    HTTP_RESPONSE_CODE.NOT_FOUND,
                    "Server not found"
                );

            if (!server.members?.includes(user.id))
                throw new HttpException(
                    HTTP_RESPONSE_CODE.UNAUTHORIZED,
                    "Unauthorized"
                );

            const channel = await channelModel.findById(channelId);

            if (!channel)
                throw new HttpException(
                    HTTP_RESPONSE_CODE.NOT_FOUND,
                    "Channel not found"
                );

            res.json(channel);
        } catch (err) {
            logger.error(err);
            next(err);
        }
    }

    async getServerChannels(
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

            if (!user)
                throw new HttpException(
                    HTTP_RESPONSE_CODE.UNAUTHORIZED,
                    "Unauthorized"
                );

            const { serverId } = req.params;

            if (!serverId)
                throw new HttpException(
                    HTTP_RESPONSE_CODE.BAD_REQUEST,
                    "Server ID is required"
                );

            const server = await serverModel.findById(serverId);

            if (!server)
                throw new HttpException(
                    HTTP_RESPONSE_CODE.NOT_FOUND,
                    "Server not found"
                );

            if (!server.members?.includes(user.id))
                throw new HttpException(
                    HTTP_RESPONSE_CODE.UNAUTHORIZED,
                    "Unauthorized"
                );

            res.json(await channelModel.find({ server: server.id }));
        } catch (err) {
            logger.error(err);
            next(err);
        }
    }

    async getChannel(req: RequestWithUser, res: Response, next: NextFunction) {
        try {
            if (!req.user)
                throw new HttpException(
                    HTTP_RESPONSE_CODE.UNAUTHORIZED,
                    "Unauthorized"
                );

            const { user } = req;

            if (!user)
                throw new HttpException(
                    HTTP_RESPONSE_CODE.UNAUTHORIZED,
                    "Unauthorized"
                );

            const { channelId } = req.params;

            if (!channelId)
                throw new HttpException(
                    HTTP_RESPONSE_CODE.BAD_REQUEST,
                    "Channel ID is required"
                );

            const channel = await channelModel.findById(channelId);

            if (!channel)
                throw new HttpException(
                    HTTP_RESPONSE_CODE.NOT_FOUND,
                    "Channel not found"
                );

            res.json(channel);
        } catch (err) {
            logger.error(err);
            next(err);
        }
    }
}
