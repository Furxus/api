import { Router, type Request, type Response } from "express";

export class MainController {
    path = "/";
    router = Router();

    constructor() {
        this.router.get(`${this.path}/ack`, this.getAck as any);
    }

    async getAck(_: Request, res: Response) {
        res.json({ ack: true });
    }
}
