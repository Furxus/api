import { type InferSchemaType, Schema, model } from "mongoose";

const messageSchema = new Schema(
    {
        _id: {
            type: String,
            required: true,
            unique: true,
            index: true
        },
        author: {
            type: String,
            ref: "users",
            required: true
        },
        content: {
            type: Object,
            required: true
        },
        edited: {
            type: Boolean,
            default: false
        },
        embeds: {
            type: Array,
            required: false
        },
        attachments: {
            type: Array,
            required: false
        },
        mentions: {
            type: [String],
            ref: "users",
            required: false
        },
        channel: {
            type: String,
            ref: "channels",
            required: true
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

messageSchema.pre("save", function (next) {
    this.set({
        updatedAt: new Date(),
        updatedTimestamp: Date.now()
    });

    next();
});

messageSchema.pre("updateOne", function (next) {
    this.set({
        updatedAt: new Date(),
        updatedTimestamp: Date.now()
    });
    next();
});

export type IMessage = InferSchemaType<typeof messageSchema>;

const messageModel = model("messages", messageSchema);

export type MessageDocument = ReturnType<(typeof messageModel)["hydrate"]>;

export default messageModel;
