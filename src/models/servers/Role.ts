import { type InferSchemaType, Schema, model } from "mongoose";

const roleSchema = new Schema(
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
        hoisted: {
            type: Boolean,
            default: false
        },
        mentionable: {
            type: Boolean,
            default: false
        },
        permissions: [String],
        server: {
            type: String,
            required: true
        },
        position: {
            type: Number,
            default: 0
        },
        color: {
            type: String,
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
                delete ret._id;
                delete ret.__v;
                return ret;
            }
        }
    }
);

roleSchema.pre("save", function (next) {
    this.set({
        updatedAt: new Date(),
        updatedTimestamp: Date.now()
    });

    next();
});

roleSchema.pre("updateOne", function (next) {
    this.set({
        updatedAt: new Date(),
        updatedTimestamp: Date.now()
    });

    next();
});

export type IRole = InferSchemaType<typeof roleSchema>;

const roleModel = model("roles", roleSchema);

export type RoleDocument = ReturnType<(typeof roleModel)["hydrate"]>;

export default roleModel;
