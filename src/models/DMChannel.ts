import { type InferSchemaType, model, Schema } from "mongoose";

const dmChannelSchema = new Schema(
    {
        _id: {
            type: String,
            required: true,
            unique: true,
            index: true
        },
        recipient1: {
            type: String,
            ref: "users",
            required: true
        },
        recipient2: {
            type: String,
            ref: "users",
            required: true
        },
        messages: {
            type: [String],
            ref: "messages",
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

dmChannelSchema.pre("save", function (next) {
    this.set({
        updatedAt: new Date(),
        updatedTimestamp: Date.now()
    });

    next();
});

dmChannelSchema.pre("updateOne", function (next) {
    this.set({
        updatedAt: new Date(),
        updatedTimestamp: Date.now()
    });

    next();
});

export type IDMChannel = InferSchemaType<typeof dmChannelSchema>;

const dmChannelModel = model("dm_channels", dmChannelSchema);

export type DMChannelDocument = ReturnType<(typeof dmChannelModel)["hydrate"]>;

export default dmChannelModel;
