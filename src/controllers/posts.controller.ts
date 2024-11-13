import type { RequestWithUser } from "@furxus/types";
import { Router, type NextFunction, type Response } from "express";
import logger from "../structures/Logger";
import { checkIfLoggedIn } from "../structures/Util";
import postModel from "../models/posts/Post";

export class PostsController {
    path = "/posts";
    router = Router();

    constructor() {
        this.router.get(`${this.path}/trending`, this.getTrendingPosts as any);
    }

    async getTrendingPosts(
        req: RequestWithUser,
        res: Response,
        next: NextFunction
    ) {
        try {
            await checkIfLoggedIn(req);

            const { limit, cursor } = req.query;

            const posts = postModel
                .find({
                    ...(cursor
                        ? {
                              createdTimestamp: {
                                  $lt: parseInt(cursor.toString())
                              }
                          }
                        : {})
                })
                .sort({ createdTimestamp: -1 })
                .populate("user");

            if (limit) posts.limit(parseInt(limit.toString()));

            res.json(posts);
        } catch (err) {
            logger.error(err);
            next(err);
        }
    }
}
