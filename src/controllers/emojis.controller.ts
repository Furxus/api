import type { RequestWithUser } from "@furxus/types";
import { Router, type NextFunction, type Response } from "express";
import emojiModel from "../models/Emoji";
import { checkIfLoggedIn } from "../structures/Util";

export class EmojiController {
    path = "/emojis";
    router = Router();

    constructor() {
        this.router.get(this.path, this.getAllEmojis as any);
    }

    async getAllEmojis(
        req: RequestWithUser,
        res: Response,
        next: NextFunction
    ) {
        try {
            await checkIfLoggedIn(req);

            const emojis = await emojiModel.find();

            res.json(emojis);
        } catch (error) {
            next(error);
        }
    }
}
