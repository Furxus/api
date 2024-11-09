import type { RequestWithUser } from "@furxus/types";
import { Router, type NextFunction, type Response } from "express";
import logger from "../structures/Logger";
import { checkIfLoggedIn, genSnowflake } from "../structures/Util";
import { HttpException } from "../exceptions/HttpException";
import { HTTP_RESPONSE_CODE } from "../Constants";
import dmChannelModel from "../models/DMChannel";

export class DMsController {
    path = "/dms";
    router = Router();

    constructor() {
        this.router.get(`${this.path}/:dmId`, this.getDM as any);
        this.router.post(this.path, this.createDM as any);
        this.router.delete(`${this.path}/:dmId`, this.closeDM as any);
    }

    async getDM(req: RequestWithUser, res: Response, next: NextFunction) {
        try {
            const user = await checkIfLoggedIn(req);

            const { dmId } = req.params;

            const dm = await dmChannelModel
                .findOne({
                    _id: dmId,
                    $or: [{ recipient1: user.id }, { recipient2: user.id }]
                })
                .populate("recipient1 recipient2");

            if (!dm)
                throw new HttpException(
                    HTTP_RESPONSE_CODE.NOT_FOUND,
                    "DM Channel not found"
                );

            res.json(dm);
        } catch (error) {
            logger.error(error);
            next(error);
        }
    }

    async closeDM(req: RequestWithUser, res: Response, next: NextFunction) {
        try {
            const user = await checkIfLoggedIn(req);

            const { dmId } = req.params;

            const dm = await dmChannelModel.findOne({
                _id: dmId,
                $or: [{ recipient1: user.id }, { recipient2: user.id }]
            });

            if (!dm)
                throw new HttpException(
                    HTTP_RESPONSE_CODE.NOT_FOUND,
                    "DM Channel not found"
                );

            dm.closed = true;

            await dm.save();

            res.json(dm);
        } catch (error) {
            logger.error(error);
            next(error);
        }
    }

    async createDM(req: RequestWithUser, res: Response, next: NextFunction) {
        try {
            const user = await checkIfLoggedIn(req);

            const { recipient } = req.body;

            if (!recipient)
                throw new HttpException(
                    HTTP_RESPONSE_CODE.BAD_REQUEST,
                    "Recipient is required"
                );

            if (user.id === recipient)
                throw new HttpException(
                    HTTP_RESPONSE_CODE.BAD_REQUEST,
                    "Cannot create DM with yourself"
                );

            let dm = await dmChannelModel.findOne({
                $or: [
                    { recipient1: user.id, recipient2: recipient },
                    { recipient1: recipient, recipient2: user.id }
                ]
            });

            if (!dm)
                dm = new dmChannelModel({
                    id: genSnowflake(),
                    recipient1: user.id,
                    recipient2: recipient,
                    createdAt: new Date(),
                    createdTimestamp: Date.now()
                });

            if (dm.closed) dm.closed = false;

            await dm.save();

            res.json(dm);
        } catch (error) {
            logger.error(error);
            next(error);
        }
    }
}
