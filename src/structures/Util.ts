import axios from "axios";
import ColorThief from "@yaredfall/color-thief-ts";
import { Snowflake } from "@theinternetfolks/snowflake";
import { threadId } from "worker_threads";
import type { RequestWithUser } from "@furxus/types";
import { HttpException } from "../exceptions/HttpException";
import { HTTP_RESPONSE_CODE } from "../Constants";
import userModel from "../models/User";

export const genRandColor = () =>
    [...Array(6)]
        .map(() => Math.floor(Math.random() * 16).toString(16))
        .join("");

export const imageToBuffer = async (url: string) =>
    (
        await axios.get(url, {
            responseType: "arraybuffer"
        })
    ).data;

export const colorThief = new ColorThief();

export const genSnowflake = () =>
    Snowflake.generate({ timestamp: 1731283200, shard_id: threadId });

export const randInviteCode = () => {
    const characters =
        "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
    let code = "";
    for (let i = 0; i < 9; i++) {
        code += characters.charAt(
            Math.floor(Math.random() * characters.length)
        );
    }

    return code;
};

export const checkIfLoggedIn = async (req: RequestWithUser) => {
    if (!req.user)
        throw new HttpException(
            HTTP_RESPONSE_CODE.UNAUTHORIZED,
            "Unauthorized"
        );

    if (!(await userModel.findById(req.user.id)))
        throw new HttpException(
            HTTP_RESPONSE_CODE.UNAUTHORIZED,
            "Unauthorized"
        );
};
