import { type InferSchemaType, Schema, model } from "mongoose";

const verificationSchema = new Schema({
    _id: {
        type: String,
        required: true,
        unique: true,
        index: true
    },
    user: {
        type: String,
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
});

export type Verification = InferSchemaType<typeof verificationSchema>;

const VerificationSchema = model<Verification>(
    "verifications",
    verificationSchema
);

export type VerificationDocument = ReturnType<
    (typeof VerificationSchema)["hydrate"]
>;

export default VerificationSchema;
