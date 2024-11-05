import { Router, type Request, type Response } from "express";

export class MainController {
    router = Router();

    constructor() {
        this.router.get("/ack", this.getAck);
    }

    async getAck(_: Request, res: Response) {
        res.status(200).json({ ack: true });
    }
}
