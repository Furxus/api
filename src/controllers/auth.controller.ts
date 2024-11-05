import {
    Router,
    type NextFunction,
    type Request,
    type Response
} from "express";
import logger from "../structures/Logger";
import moment from "moment";
import { HttpException } from "../exceptions/HttpException";
import { validateLogin, validateRegister } from "../Validation";
import userModel from "../models/User";

import bcrypt from "bcrypt";
import crypto from "crypto";
import Cryptr from "cryptr";
import { decrypt, encrypt } from "../structures/Crypt";

import bucket from "../structures/AssetManagement";
import { colorThief, genRandColor, genSnowflake } from "../structures/Util";
import verificationModel from "../models/Verification";
import { mailgun } from "../App";
import type { RequestWithUser } from "@furxus/types";

const emailRegex = /^[a-zA-Z0-9._-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,4}$/;

const species = [
    "cat",
    "dog",
    "dragon",
    "fox",
    "hyena",
    "rabbit",
    "raccoon",
    "wolf"
];

export class AuthController {
    path = "/auth";
    router = Router();

    constructor() {
        this.router.post(`${this.path}/register`, this.register);
        this.router.post(`${this.path}/login`, this.login);
        this.router.post(`${this.path}/verify`, this.verify);
        this.router.post(`${this.path}/resend-email`, this.resendEmail as any);
    }

    async register(req: Request, res: Response, next: NextFunction) {
        try {
            const ogEmail = req.body.email.toLowerCase().trim();
            const ogUsername = req.body.username.toLowerCase().trim();

            const dateOfBirth = moment(
                new Date(req.body.dateOfBirth),
                "MM/DD/YYYY"
            );
            if (!dateOfBirth.isValid())
                throw new HttpException(400, "Invalid date of birth", [
                    {
                        type: "dateOfBirth",
                        message: "Make sure the date is in MM/DD/YYYY format"
                    }
                ]);

            if (moment().diff(dateOfBirth, "years") < 13)
                throw new HttpException(
                    400,
                    "You must be at least 13 years old",
                    [
                        {
                            type: "dateOfBirth",
                            message: "You must be at least 13 years old"
                        }
                    ]
                );

            const errors = [];

            if (emailRegex.test(ogUsername))
                errors.push("Username cannot be an email");

            const { error, value } = validateRegister.validate(
                {
                    email: ogEmail,
                    username: ogUsername,
                    displayName: req.body.displayName,
                    password: req.body.password,
                    confirmPassword: req.body.confirmPassword
                },
                {
                    abortEarly: false
                }
            );

            if (error)
                error.details.forEach((err) =>
                    errors.push({
                        type: err.path[0],
                        message: err.message
                    })
                );

            if (errors.length > 0)
                throw new HttpException(400, "Invalid fields", errors);

            // Grab validated values

            const { username, email, password, confirmPassword, displayName } =
                value;

            if (username === email)
                throw new HttpException(
                    400,
                    "Username and email cannot be the same",
                    [
                        {
                            type: "username",
                            message: "Username and email cannot be the same"
                        },
                        {
                            type: "email",
                            message: "Username and email cannot be the same"
                        }
                    ]
                );

            const userExists = await userModel.findOne({
                $or: [{ email }, { username }]
            });

            if (userExists) {
                if (userExists.username === username)
                    throw new HttpException(400, "Username is taken", [
                        {
                            type: "username",
                            message: "Username is taken"
                        }
                    ]);

                if (userExists.email === email)
                    throw new HttpException(400, "Email is taken", [
                        {
                            type: "email",
                            message: "Email is taken"
                        }
                    ]);
            }

            if (password !== confirmPassword)
                throw new HttpException(400, "Passwords do not match", [
                    {
                        type: "password",
                        message: "Passwords do not match"
                    },
                    {
                        type: "confirmPassword",
                        message: "Passwords do not match"
                    }
                ]);

            // Generate salt for the user's password
            const salt = bcrypt.genSaltSync(11);
            // Hash the password
            const hash = bcrypt.hashSync(password, salt);

            // Create a random generated private key for the user
            const privateKey = crypto.randomBytes(256).toString("base64");
            // Double encrypt it (Not telling you the second one :3)
            const encrypted = new Cryptr(privateKey).encrypt(hash);
            const newPass = encrypt(encrypted);

            // Choose a random default avatar for the user
            const randomSpecies =
                species[Math.floor(Math.random() * species.length)];
            const imageUrl = bucket.getObjectPublicUrls(
                `defaultAvatar/${randomSpecies}.png`
            )[0];

            let { dominantColor } = (await colorThief.getColorAsync(imageUrl, {
                colorType: "hex"
            })) as any;

            if (!dominantColor) dominantColor = genRandColor();

            const user = new userModel({
                _id: genSnowflake(),
                username,
                email,
                displayName,
                password: newPass,
                privateKey,
                defaultAvatar: imageUrl,
                accentColor: "#" + dominantColor,
                dateOfBirth: dateOfBirth.toDate(),
                createdAt: new Date(),
                createdTimestamp: Date.now()
            });

            const code = crypto.randomBytes(6).toString("hex");

            // Create verification document

            // Create a verification document
            const verification = new verificationModel({
                _id: genSnowflake(),
                user: user.id,
                code,
                expiresAt: moment().add(1, "day").toDate(),
                expiresTimestamp: moment().add(1, "day").unix()
            });

            const verificationUrl = `${process.env.FRONTEND_URL}/verify/${verification.code}`;

            await mailgun.messages.create("furxus.com", {
                from: "verify@furxus.com",
                to: user.email,
                subject: "Furxus - Verify your email",
                template: "email verification template",
                "h:X-Mailgun-Variables": JSON.stringify({
                    verification_url: verificationUrl
                })
            });

            await user.save();
            await verification.save();

            res.status(201).json({
                success: true
            });
        } catch (err) {
            logger.error(err);
            next(err);
        }
    }
    async login(req: Request, res: Response, next: NextFunction) {
        try {
            const usernameOrEmail = req.body.usernameOrEmail
                .toLowerCase()
                .trim();

            const validate: {
                password: string;
                email?: string;
                username?: string;
            } = {
                password: req.body.password
            };

            if (emailRegex.test(usernameOrEmail))
                validate.email = usernameOrEmail;
            else validate.username = usernameOrEmail;

            const { error } = validateLogin.validate(validate, {
                abortEarly: false
            });

            if (error)
                throw new HttpException(
                    400,
                    "Invalid fields",
                    error.details.map((err) => ({
                        type: err.path[0],
                        message: err.message
                    }))
                );

            const userCreds = await userModel.findOne({
                $or: [{ email: usernameOrEmail }, { username: usernameOrEmail }]
            });

            if (!userCreds)
                throw new HttpException(400, "Invalid username or password", [
                    {
                        type: "password",
                        message: "Invalid username or password"
                    }
                ]);

            // revalidate the password
            const {
                error: passwordError,
                value: { password }
            } = validateLogin.validate({
                password: req.body.password
            });

            if (passwordError)
                throw new HttpException(400, "Invalid username or password", [
                    {
                        type: "password",
                        message: "Invalid username or password"
                    }
                ]);

            // Decrypt the password
            const decrypted = decrypt(userCreds.password);
            // Compare hashes
            const pass = bcrypt.compareSync(
                password,
                new Cryptr(userCreds.privateKey).decrypt(decrypted)
            );

            if (!pass)
                throw new HttpException(400, "Invalid username or password", [
                    {
                        type: "password",
                        message: "Invalid username or password"
                    }
                ]);

            const user = await userModel.findOne({
                $or: [{ email: usernameOrEmail }, { username: usernameOrEmail }]
            });

            if (!user)
                throw new HttpException(400, "Invalid username or password", [
                    {
                        type: "password",
                        message: "Invalid username or password"
                    }
                ]);

            await user.save();

            res.json({
                token: encrypt(user.generateToken()),
                ...user.toJSON()
            });
        } catch (err) {
            logger.error(err);
            next(err);
        }
    }

    async verify(req: Request, res: Response, next: NextFunction) {
        // Find the verification document in the database
        try {
            const { code } = req.body;

            const verification = await verificationModel
                .findOne({
                    code
                })
                .populate("user");

            console.log(verification);

            if (!verification)
                throw new HttpException(400, "Invalid verification code", [
                    {
                        type: "code",
                        message: "Invalid verification code"
                    }
                ]);

            // Find the user in the database
            const user = await userModel.findById(verification.user);

            if (!user)
                throw new HttpException(400, "Invalid verification code", [
                    {
                        type: "code",
                        message: "Invalid verification code"
                    }
                ]);

            // Check if the verification has expired
            if (moment().isAfter(verification.expiresAt)) {
                await verification.deleteOne();

                const code = crypto.randomBytes(6).toString("hex");
                const newVerification = new verificationModel({
                    _id: genSnowflake(),
                    user: user.id,
                    code,
                    expiresAt: moment().add(1, "day").toDate(),
                    expiresTimestamp: moment().add(1, "day").unix()
                });

                const verificationUrl = `${process.env.FRONTEND_URL}/verify/${newVerification.code}`;

                await mailgun.messages.create("furxus.com", {
                    from: "verify@furxus.com",
                    to: user.email,
                    subject: "Furxus - Verify your email",
                    template: "email verification template",
                    "h:X-Mailgun-Variables": JSON.stringify({
                        verification_url: verificationUrl
                    })
                });

                await newVerification.save();

                throw new HttpException(400, "Verification code has expired", [
                    {
                        type: "code",
                        message: "Verification code has expired"
                    }
                ]);
            }

            // Verify the user
            user.verified = true;
            await user.save();
            await verification.deleteOne();

            res.json({
                success: true
            });
        } catch (err) {
            logger.error(err);
            next(err);
        }
    }

    async resendEmail(req: RequestWithUser, res: Response, next: NextFunction) {
        try {
            const { user } = req;

            // Delete the old verification document (if it exists)
            const dbUser = await userModel.findById(user.id);

            if (!dbUser)
                throw new HttpException(400, "Email not found", [
                    {
                        type: "email",
                        message: "Email not found"
                    }
                ]);

            await verificationModel.deleteOne({
                user: user.id
            });

            // END: Delete the old verification document

            // Create a new verification document
            const code = crypto.randomBytes(6).toString("hex");

            const verification = new verificationModel({
                _id: genSnowflake(),
                user: user.id,
                code,
                expiresAt: moment().add(1, "day").toDate(),
                expiresTimestamp: moment().add(1, "day").unix()
            });

            const verificationUrl = `${process.env.FRONTEND_URL}/verify/${verification.code}`;

            await mailgun.messages.create("furxus.com", {
                from: "verify@furxus.com",
                to: dbUser.email,
                subject: "Furxus - Verify your email",
                template: "email verification template",
                "h:X-Mailgun-Variables": JSON.stringify({
                    verification_url: verificationUrl
                })
            });

            await verification.save();

            res.json({
                success: true
            });
        } catch (err) {
            logger.error(err);
            next(err);
        }
    }
}
