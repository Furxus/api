import { model, Schema, type InferSchemaType } from "mongoose";

const inviteSchema = new Schema(
    {
        _id: {
            type: String,
            required: true,
            unique: true,
            index: true
        },
        code: {
            type: String,
            required: true
        },
        uses: {
            type: Number,
            default: 0
        },
        maxUses: {
            type: Number,
            default: 0
        },
        server: {
            type: String,
            ref: "servers",
            required: true
        },
        createdBy: {
            type: String,
            required: true,
            ref: "users"
        },
        createdTimestamp: {
            type: Number,
            required: true
        },
        expiresAt: {
            type: Date,
            default: null
        },
        expiresTimestamp: {
            type: Number,
            default: null
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
        }
    }
);

export type IInvite = InferSchemaType<typeof inviteSchema>;

const inviteModel = model("invites", inviteSchema);

export type InviteDocument = ReturnType<(typeof inviteModel)["hydrate"]>;

export default inviteModel;
