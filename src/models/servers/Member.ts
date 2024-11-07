import { type InferSchemaType, Schema, model } from "mongoose";

const memberSchema = new Schema(
    {
        _id: {
            type: String,
            required: true,
            unique: true,
            index: true
        },
        roles: {
            type: [String],
            ref: "roles",
            required: true
        },
        permissions: [],
        server: {
            type: String,
            ref: "servers",
            required: true
        },
        user: {
            type: String,
            ref: "users",
            required: true
        },
        joinedAt: {
            type: Date,
            required: true
        },
        joinedTimestamp: {
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
                    return this.user;
                },
                set: function (v: string) {
                    this.user = v;
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

memberSchema.pre("save", function (next) {
    this.set({
        updatedAt: new Date(),
        updatedTimestamp: Date.now()
    });

    next();
});

memberSchema.pre("updateOne", function (next) {
    this.set({
        updatedAt: new Date(),
        updatedTimestamp: Date.now()
    });

    next();
});

export type IMember = InferSchemaType<typeof memberSchema>;

const memberModel = model("members", memberSchema);

export type MemberDocument = ReturnType<(typeof memberModel)["hydrate"]>;

export default memberModel;
