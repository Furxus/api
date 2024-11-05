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

            await user.save();

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
}
