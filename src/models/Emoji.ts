import { type InferSchemaType, Schema, model } from "mongoose";

const emojiSchema = new Schema(
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
        shortCode: {
            type: String,
            required: true
        },
        url: {
            type: String,
            required: true
        },
        createdBy: {
            type: String,
            ref: "users",
            required: true
        },
        createdTimestamp: {
            type: Number,
            required: true
        },
        createdAt: {
            type: Date,
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

emojiSchema.pre("save", function (next) {
    this.set({
        updatedAt: new Date(),
        updatedTimestamp: Date.now()
    });

    next();
});

emojiSchema.pre("updateOne", function (next) {
    this.set({
        updatedAt: new Date(),
        updatedTimestamp: Date.now()
    });
    next();
});

export type IEmoji = InferSchemaType<typeof emojiSchema>;

const emojiModel = model("Emoji", emojiSchema);

export type EmojiDocument = ReturnType<(typeof emojiModel)["hydrate"]>;

export default emojiModel;
