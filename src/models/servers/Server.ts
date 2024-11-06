import { type InferSchemaType, Schema, model } from "mongoose";

const serverSchema = new Schema(
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
        nameAcronym: {
            type: String
        },
        icon: {
            type: String,
            default: null
        },
        description: {
            type: String,
            default: null
        },
        owner: {
            type: String,
            ref: "users",
            required: true
        },
        invites: {
            type: [String],
            ref: "invites",
            default: []
        },
        members: {
            type: [String],
            ref: "members",
            required: false
        },
        channels: {
            type: [String],
            ref: "channels",
            required: false
        },
        roles: {
            type: [String],
            ref: "roles",
            required: false
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

serverSchema.pre("save", function (next) {
    this.set({
        updatedAt: new Date(),
        updatedTimestamp: Date.now(),
        nameAcronym: this.name
            .split(" ")
            .map((n: string) => n[0])
            .join("")
            .toUpperCase()
    });

    next();
});

serverSchema.pre("updateOne", function (next) {
    this.set({
        updatedAt: new Date(),
        updatedTimestamp: Date.now(),
        nameAcronym: this.get("name")
            .split(" ")
            .map((n: string) => n[0])
            .join("")
            .toUpperCase()
    });

    next();
});

export type IServer = InferSchemaType<typeof serverSchema>;

const serverModel = model("servers", serverSchema);

export type ServerDocument = ReturnType<(typeof serverModel)["hydrate"]>;

export default serverModel;
