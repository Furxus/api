import { type InferSchemaType, Schema, model } from "mongoose";

const postSchema = new Schema(
    {
        _id: {
            type: String,
            required: true,
            unique: true,
            index: true
        },
        hashtags: [String],
        user: {
            type: String,
            ref: "users",
            required: true
        },
        mentions: {
            type: [String],
            ref: "users",
            required: false
        },
        content: {
            text: {
                type: String,
                default: null
            },
            image: {
                type: String,
                default: null
            },
            video: {
                type: String,
                default: null
            },
            audio: {
                type: String,
                default: null
            }
        },
        nsfw: {
            type: Boolean,
            default: false
        },
        comments: {
            type: [String],
            ref: "comments",
            required: false
        },
        likes: {
            type: [String],
            ref: "users",
            required: false
        },
        reports: {
            type: [String],
            ref: "reports",
            required: false
        },
        favorites: {
            type: [String],
            ref: "users",
            required: false
        },
        shares: {
            type: [String],
            ref: "users",
            required: false
        },
        views: {
            type: Number,
            default: 0
        },
        isPinned: {
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
        }
    }
);

postSchema.pre("save", function (next) {
    this.set({
        updatedAt: new Date(),
        updatedTimestamp: Date.now()
    });

    next();
});

postSchema.pre("updateOne", function (next) {
    this.set({
        updatedAt: new Date(),
        updatedTimestamp: Date.now()
    });

    next();
});

export type IPost = InferSchemaType<typeof postSchema>;

const postModel = model("posts", postSchema);

export type PostDocument = ReturnType<(typeof postModel)["hydrate"]>;

export default postModel;
