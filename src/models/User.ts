import { type InferSchemaType, Schema, model } from "mongoose";
import jwt from "jsonwebtoken";

const { JWT_SECRET } = process.env;
if (!JWT_SECRET) throw new Error("No JWT secret provided");

const userSchema = new Schema(
    {
        _id: {
            type: String,
            required: true,
            unique: true,
            index: true
        },
        username: {
            type: String,
            required: true,
            unique: true
        },
        email: {
            type: String,
            required: true,
            unique: true
        },
        age: Number,
        dateOfBirth: {
            type: Date,
            required: true
        },
        avatar: {
            type: String,
            default: null,
            required: false
        },
        defaultAvatar: {
            type: String,
            required: true
        },
        previousAvatars: {
            type: [String],
            default: []
        },
        banner: {
            type: String,
            default: null,
            required: false
        },
        accentColor: {
            type: String,
            required: true
        },
        displayName: {
            type: String,
            default: null,
            required: false
        },
        nameAcronym: {
            type: String,
            default: null,
            required: false
        },
        activity: {
            status: {
                type: String,
                default: "offline"
            },
            text: {
                type: String,
                default: null,
                required: false
            },
            lastLogin: {
                type: Date,
                default: null,
                required: false
            },
            lastLoginTimestamp: {
                type: Number,
                default: null,
                required: false
            },
            lastActive: {
                type: Date,
                default: null,
                required: false
            },
            lastActiveTimestamp: {
                type: Number,
                default: null,
                required: false
            }
        },
        bio: {
            type: String,
            default: null,
            required: false
        },
        badges: {
            type: [String],
            default: []
        },
        password: {
            type: String,
            required: true
        },
        privateKey: {
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
        verified: {
            type: Boolean,
            default: false
        },
        updatedAt: Date,
        updatedTimestamp: Number,
        followers: {
            type: [String],
            ref: "users",
            default: []
        },
        following: {
            type: [String],
            ref: "users",
            default: []
        },
        friends: {
            type: [String],
            ref: "users",
            default: []
        },
        friendRequests: {
            sent: {
                type: [String],
                ref: "users",
                default: []
            },
            received: {
                type: [String],
                ref: "users",
                default: []
            }
        },
        blocks: {
            type: [String],
            ref: "users",
            default: []
        },
        blockedBy: {
            type: [String],
            ref: "users",
            default: []
        },
        privacy: {
            visiblity: {
                type: String,
                default: "public"
            },
            posts: {
                type: String,
                default: "public"
            },
            favorites: {
                type: String,
                default: "public"
            },
            likes: {
                type: String,
                default: "public"
            }
        },
        preferences: {
            mode: {
                type: String,
                default: "servers"
            },
            theme: {
                type: String,
                default: "dark"
            }
        },
        shares: {
            type: [String],
            ref: "posts",
            default: []
        },
        views: {
            type: Number,
            default: 0
        },
        system: {
            type: Boolean,
            default: false
        },
        flags: {
            type: [String],
            default: []
        }
    },
    {
        methods: {
            generateToken: function () {
                return jwt.sign(this.toJSON(), JWT_SECRET!);
            }
        },
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
                delete ret.password;
                delete ret.privateKey;
                delete ret.email;
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

userSchema.pre("save", function (next) {
    this.set({
        updatedAt: new Date(),
        updatedTimestamp: Date.now(),
        activity: {
            lastActive: new Date(),
            lastActiveTimestamp: Date.now()
        },
        nameAcronym: (this.displayName ?? this.username)
            .split(" ")
            .map((n) => n[0])
            .join("")
            .toUpperCase()
    });

    next();
});

userSchema.pre("updateOne", function (next) {
    this.set({
        updatedAt: new Date(),
        updatedTimestamp: Date.now(),
        activity: {
            lastActive: new Date(),
            lastActiveTimestamp: Date.now()
        }
    });

    next();
});

export type IUser = InferSchemaType<typeof userSchema>;

const userModel = model("users", userSchema);

export type UserDocument = ReturnType<(typeof userModel)["hydrate"]>;

export default userModel;
