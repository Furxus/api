import axios from "axios";
import ColorThief from "@yaredfall/color-thief-ts";
import { Snowflake } from "@theinternetfolks/snowflake";
import { threadId } from "worker_threads";
import type { RequestWithUser } from "@furxus/types";
import { HttpException } from "../exceptions/HttpException";
import { HTTP_RESPONSE_CODE } from "../Constants";
import userModel from "../models/User";

import sharp from "sharp";
import rgbHex from "rgb-hex";

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
    for (let i = 0; i < 6; i++) {
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

    const user = await userModel.findById(req.user.id);

    if (!user)
        throw new HttpException(
            HTTP_RESPONSE_CODE.UNAUTHORIZED,
            "Unauthorized"
        );

    return user;
};

export const dominantHex = async (url: string) => {
    const { dominant } = await sharp(await imageToBuffer(url)).stats();

    return rgbHex(dominant.r, dominant.g, dominant.b);
};

export const getUrls = (text: string) => {
    const urlPattern =
        /(https?:\/\/)?(www\.)?([a-zA-Z0-9-]+\.[a-zA-Z]{2,})(\/\S*)?/g;
    const urls = text.match(urlPattern) || []; // Find all URLs or return an empty array if none

    // Convert each URL to valid format (ensure it has https://)
    const validUrls = urls.map((url) => {
        // If the URL doesn't start with 'http' (or 'https'), add 'https://'
        if (!/^https?:\/\//i.test(url)) {
            url = "https://" + url;
        }
        return url;
    });

    // Remove duplicates using Set
    return [...new Set(validUrls)];
};
