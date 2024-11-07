import { type InferSchemaType, Schema, model } from "mongoose";

const channelSchema = new Schema(
    {
        _id: {
            type: String,
            required: true,
            unique: true,
            index: true
        },
        name: {
            type: String,
            required: true
        },
        server: {
            type: String,
            ref: "servers",
            required: true
        },
        messages: {
            type: [String],
            ref: "messages",
            required: false
        },
        category: {
            type: String,
            ref: "channels",
            default: null
        },
        children: {
            type: [String],
            ref: "channels",
            default: null
        },
        type: {
            type: String,
            required: true
        },
        topic: {
            type: String,
            default: null
        },
        position: {
            type: Number,
            required: true
        },
        nsfw: {
            type: Boolean,
            default: false
        },
        createdAt: {
            type: Date,
            required: true
        },
        createdTimestamp: {
            type: Number,
            required: true
        },
        updatedAt: Date,
        updatedTimestamp: Number
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
                delete ret.password;
                delete ret.privateKey;
                delete ret.email;
                return ret;
            }
        }
    }
);

channelSchema.pre("save", function (next) {
    if (this.type != "category" && this.children?.length > 0)
        throw new Error("Non-category channels cannot have children");

    this.set({
        updatedAt: new Date(),
        updatedTimestamp: Date.now()
    });

    next();
});

channelSchema.pre("updateOne", function (next) {
    this.set({
        updatedAt: new Date(),
        updatedTimestamp: Date.now()
    });

    next();
});

export type IChannel = InferSchemaType<typeof channelSchema>;

const channelModel = model("channels", channelSchema);

export type ChannelDocument = ReturnType<(typeof channelModel)["hydrate"]>;

export default channelModel;
