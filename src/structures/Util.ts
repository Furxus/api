import axios from "axios";
import ColorThief from "@yaredfall/color-thief-ts";
import { Snowflake } from "@theinternetfolks/snowflake";
import { threadId } from "worker_threads";

export const extractUrls = (content: string) => {
    const regex =
        /https?:\/\/(www\.)?[-a-zA-Z0-9@:%._+~#=]{1,256}\.[a-zA-Z0-9()]{1,63}\b([-a-zA-Z0-9()'@:%_+.~#?!&//=]*)/gi;

    return content.match(regex) ?? [];
};

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
