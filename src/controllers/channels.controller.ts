import type { MessageEmbed, RequestWithUser } from "@furxus/types";
import { Router, type NextFunction, type Response } from "express";
import logger from "../structures/Logger";
import { HTTP_RESPONSE_CODE } from "../Constants";
import { HttpException } from "../exceptions/HttpException";
import serverModel from "../models/servers/Server";
import channelModel from "../models/servers/Channel";
import messageModel from "../models/Message";
import { checkIfLoggedIn, genSnowflake } from "../structures/Util";
import { io } from "../App";
import dmChannelModel from "../models/DMChannel";

import urlMetadata from "url-metadata";

import getUrls from "get-urls";

export class ChannelsController {
    path = "/channels";
    router = Router();

    constructor() {
        this.router.get(
            `${this.path}/:channelId/messages`,
            this.getChannelMessages as any
        );
        this.router.put(
            `${this.path}/:channelId/messages`,
            this.createMessage as any
        );
        this.router.patch(
            `${this.path}/:channelId/messages/:messageId`,
            this.editMessage as any
        );
        this.router.delete(
            `${this.path}/:channelId/messages/:messageId`,
            this.deleteMessage as any
        );

        this.router.get(
            `${this.path}/:serverId/:channelId`,
            this.getServerChannel as any
        );
        this.router.get(
            `${this.path}/:serverId`,
            this.getServerChannels as any
        );

        this.router.put(this.path, this.createChannel as any);

        this.router.delete(
            `${this.path}/:channelId`,
            this.deleteChannel as any
        );
    }

    async editMessage(req: RequestWithUser, res: Response, next: NextFunction) {
        try {
            await checkIfLoggedIn(req);

            const { channelId, messageId } = req.params;

            if (!channelId || !messageId)
                throw new HttpException(
                    HTTP_RESPONSE_CODE.BAD_REQUEST,
                    "Channel ID and Message ID are required"
                );

            const { content } = req.body;

            if (!content)
                throw new HttpException(
                    HTTP_RESPONSE_CODE.BAD_REQUEST,
                    "Content is required"
                );

            if (content.length < 1 || content.length > 2000)
                throw new HttpException(
                    HTTP_RESPONSE_CODE.BAD_REQUEST,
                    "Content must be between 1 and 2000 characters"
                );

            let channel = await channelModel.findById(channelId);

            if (!channel) channel = await dmChannelModel.findById(channelId);

            if (!channel)
                throw new HttpException(
                    HTTP_RESPONSE_CODE.NOT_FOUND,
                    "Channel not found"
                );

            const message = await messageModel.findById(messageId);

            if (!message)
                throw new HttpException(
                    HTTP_RESPONSE_CODE.NOT_FOUND,
                    "Message not found"
                );

            if (message.author !== req.user.id)
                throw new HttpException(
                    HTTP_RESPONSE_CODE.UNAUTHORIZED,
                    "Unauthorized"
                );

            message.content = content;
            message.edited = true;

            const urls = getUrls(JSON.stringify(content));
            const metadatas: urlMetadata.Result[] = [];
            for (const url of urls) {
                const metadata = await urlMetadata(url).catch(() => null);
                if (!metadata) continue;
                metadatas.push(metadata);
            }

            const embeds: MessageEmbed[] = [];
            for (const metadata of metadatas) {
                embeds.push({
                    title: metadata["og:title"],
                    description: metadata["og:description"],
                    url: metadata["og:url"],
                    image: metadata["og:image"],
                    author: {
                        name: metadata["og:site_name"],
                        url: metadata["og:url"],
                        iconUrl: !metadata.favicons[0].href.startsWith("/")
                            ? (metadata.favicons[0]?.href ?? null)
                            : null
                    }
                });
            }

            message.embeds = embeds;

            await message.save();
            await message.populate("author");
            await message.populate("channel");

            if (!message.channel) (message.channel as any) = channel;

            io.to(channel.id).emit("message:update", message);

            res.json(message);
        } catch (err) {
            logger.error(err);
            next(err);
        }
    }

    async deleteMessage(
        req: RequestWithUser,
        res: Response,
        next: NextFunction
    ) {
        try {
            await checkIfLoggedIn(req);

            const { channelId, messageId } = req.params;

            if (!channelId || !messageId)
                throw new HttpException(
                    HTTP_RESPONSE_CODE.BAD_REQUEST,
                    "Channel ID and Message ID are required"
                );

            let channel = await channelModel.findById(channelId);

            if (!channel) channel = await dmChannelModel.findById(channelId);

            if (!channel)
                throw new HttpException(
                    HTTP_RESPONSE_CODE.NOT_FOUND,
                    "Channel not found"
                );

            const message = await messageModel.findById(messageId);

            if (!message)
                throw new HttpException(
                    HTTP_RESPONSE_CODE.NOT_FOUND,
                    "Message not found"
                );

            if (message.author !== req.user.id)
                throw new HttpException(
                    HTTP_RESPONSE_CODE.UNAUTHORIZED,
                    "Unauthorized"
                );

            await message.deleteOne();

            channel.messages = channel.messages?.filter(
                (m) => m !== message.id
            );

            await channel.save();

            io.to(channel.id).emit("message:delete", message);

            res.json(message);
        } catch (err) {
            logger.error(err);
            next(err);
        }
    }

    async createMessage(
        req: RequestWithUser,
        res: Response,
        next: NextFunction
    ) {
        try {
            await checkIfLoggedIn(req);

            const { content } = req.body;
            const { channelId } = req.params;

            if (!content)
                throw new HttpException(
                    HTTP_RESPONSE_CODE.BAD_REQUEST,
                    "Channel ID and Content are required"
                );

            if (content.length < 1 || content.length > 2000)
                throw new HttpException(
                    HTTP_RESPONSE_CODE.BAD_REQUEST,
                    "Content must be between 1 and 2000 characters"
                );

            let channel = await channelModel.findById(channelId);

            if (!channel) channel = await dmChannelModel.findById(channelId);

            if (!channel)
                throw new HttpException(
                    HTTP_RESPONSE_CODE.NOT_FOUND,
                    "Channel not found"
                );

            const urls = getUrls(JSON.stringify(content));
            const metadatas: urlMetadata.Result[] = [];
            for (const url of urls) {
                const metadata = await urlMetadata(url).catch(() => null);
                if (!metadata) continue;
                metadatas.push(metadata);
            }

            const embeds: MessageEmbed[] = [];
            for (const metadata of metadatas) {
                const embed = {
                    title: metadata["og:title"],
                    description: metadata["og:description"].replaceAll(
                        " ",
                        "\n"
                    ),
                    url: metadata["og:url"],
                    image: metadata["og:image"],
                    media:
                        metadata["og:video:secure_url"] ??
                        metadata["og:video:url"] ??
                        null,
                    author: {
                        name: metadata["og:site_name"].split(",")[0],
                        url: metadata["og:url"],
                        iconUrl: !metadata.favicons[0]?.href.startsWith("/")
                            ? (metadata.favicons[0]?.href ?? null)
                            : null
                    }
                };

                if (
                    embed.url.includes("spotify") &&
                    embed.url.includes("track")
                )
                    embed.media = `https://open.spotify.com/embed/track/${embed.url.split("/")[4]}`;

                embeds.push(embed);
            }

            const message = new messageModel({
                _id: genSnowflake(),
                channel: channel.id,
                author: req.user.id,
                content,
                embeds,
                createdAt: new Date(),
                createdTimestamp: Date.now()
            });

            await message.save();
            await message.populate("author");
            await message.populate("channel");

            if (!message.channel) (message.channel as any) = channel;

            channel.messages?.push(message.id);

            await channel.save();

            io.to(channel.id).emit("message:create", message);

            res.json(message);
        } catch (err) {
            logger.error(err);
            next(err);
        }
    }

    async deleteChannel(
        req: RequestWithUser,
        res: Response,
        next: NextFunction
    ) {
        try {
            const user = await checkIfLoggedIn(req);

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
            const user = await checkIfLoggedIn(req);

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
            await checkIfLoggedIn(req);

            const { channelId } = req.params;

            if (!channelId)
                throw new HttpException(
                    HTTP_RESPONSE_CODE.BAD_REQUEST,
                    "Channel ID is required"
                );

            let channel: any = await channelModel
                .findById(channelId)
                .select("-messages");

            if (!channel)
                channel = await dmChannelModel
                    .findById(channelId)
                    .select("-messages");

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
                .sort({ createdTimestamp: -1 })
                .populate("author")
                .populate("channel");

            if (limit) messages.limit(parseInt(limit.toString()));

            const msgs = await messages;
            for (const message of msgs) {
                if (!message.channel) {
                    (message.channel as any) = channel;
                }
            }

            res.json(msgs.reverse());
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
            const user = await checkIfLoggedIn(req);

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
            const user = await checkIfLoggedIn(req);

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
}
