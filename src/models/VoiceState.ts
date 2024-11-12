import { model, Schema, type InferSchemaType } from "mongoose";

const voiceStateSchema = new Schema(
    {
        _id: {
            type: String,
            required: true,
            unique: true,
            index: true
        },
        server: {
            type: String,
            ref: "servers"
        },
        channel: {
            type: String,
            ref: "channels",
            required: true
        },
        user: {
            type: String,
            ref: "users",
            required: true
        },
        sessionID: {
            type: String,
            required: true
        },
        deaf: {
            type: Boolean,
            default: false
        },
        mute: {
            type: Boolean,
            default: false
        },
        selfDeaf: {
            type: Boolean,
            default: false
        },
        selfMute: {
            type: Boolean,
            default: false
        },
        selfStream: {
            type: Boolean,
            default: false
        },
        selfVideo: {
            type: Boolean,
            default: false
        }
    },
    {
        virtuals: {
            id: {
                get: function () {
                    return this._id;
                },
                set: function (v: string) {
                    this._id = v;
                }
            }
        },
        toJSON: {
            virtuals: true,
            transform: function (_, ret) {
                delete ret._id;
                delete ret.__v;
                return ret;
            }
        },
        toObject: {
            virtuals: true,
            transform: function (_, ret) {
                delete ret._id;
                delete ret.__v;
                return ret;
            }
        }
    }
);

export type IVoiceState = InferSchemaType<typeof voiceStateSchema>;

const voiceStateModel = model("voicestates", voiceStateSchema);

export type VoiceStateDocument = ReturnType<
    (typeof voiceStateModel)["hydrate"]
>;

export default voiceStateModel;
