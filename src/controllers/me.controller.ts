import type { RequestWithUser } from "@furxus/types";
import { Router, type Response } from "express";
import userModel from "../models/User";
import serverModel from "../models/servers/Server";

export class MeController {
    path = "/@me";
    router = Router();
    constructor() {
        this.router.get(this.path, this.getMe as any);
        this.router.get(`${this.path}/servers`, this.getMeServers as any);
    }

    async getMe(req: RequestWithUser, res: Response) {
        res.json(await userModel.findById(req.user.id));
    }

    async getMeServers(req: RequestWithUser, res: Response) {
        res.json(
            await serverModel.find({
                $or: [{ owner: req.user.id }, { members: req.user.id }]
            })
        );
    }
}
