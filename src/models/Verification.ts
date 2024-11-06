import { type InferSchemaType, Schema, model } from "mongoose";

const verificationSchema = new Schema(
    {
        _id: {
            type: String,
            required: true,
            unique: true,
            index: true
        },
        user: {
            type: String,
            ref: "users",
            required: true
        },
        code: {
            type: String,
            required: true
        },
        expiresAt: {
            type: Date,
            required: true
        },
        expiresTimestamp: {
            type: Number,
            required: true
        },
        verified: {
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
        }
    }
);

export type Verification = InferSchemaType<typeof verificationSchema>;

const verificationModel = model<Verification>(
    "verifications",
    verificationSchema
);

export type VerificationDocument = ReturnType<
    (typeof verificationModel)["hydrate"]
>;

export default verificationModel;
