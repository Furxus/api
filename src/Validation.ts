import Joi from "joi";

const pswdReqTxt =
    "Password must contain at least one uppercase letter, one lowercase letter, one number, one special character and must be atleast 6 characters long";

const pswdRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*[0-9])(?=.{8,})/;

export const validateRegister = Joi.object({
    email: Joi.string()
        .email({ minDomainSegments: 2, tlds: false })
        .required()
        .messages({
            "string.base": "Email must be a string",
            "string.empty": "Email cannot be empty",
            "string.email": "Email must be a valid email address",
            "any.required": "Email is required"
        }),
    username: Joi.string().alphanum().min(4).max(30).required().messages({
        "string.base": "Username must be a string",
        "string.empty": "Username cannot be empty",
        "string.min": "Username must be at least 4 characters",
        "string.max": "Username must be at most 30 characters",
        "any.required": "Username is required"
    }),
    displayName: Joi.optional().messages({
        "string.base": "Display name must be a string",
        "string.empty": "Display name cannot be empty"
    }),
    password: Joi.string().regex(pswdRegex).required().messages({
        "string.base": "Password must be a string",
        "string.empty": "Password cannot be empty",
        "string.pattern": "Password must be a valid password",
        "any.required": "Password is required",
        "any.only": "Password must match confirm password",
        "string.pattern.base": pswdReqTxt
    }),
    confirmPassword: Joi.string().regex(pswdRegex).required().messages({
        "string.base": "Confirm password must be a string",
        "string.empty": "Confirm password cannot be empty",
        "string.pattern": "Confirm password must be a valid password",
        "any.required": "Confirm password is required",
        "any.only": "Confirm password must match password",
        "string.pattern.base": pswdReqTxt
    })
});

export const validateLogin = Joi.object({
    username: Joi.string().alphanum().min(4).max(30).messages({
        "string.base": "Username must be a string",
        "string.empty": "Username cannot be empty",
        "string.min": "Username must be at least 4 characters",
        "string.max": "Username must be at most 30 characters",
        "any.required": "Username is required"
    }),
    email: Joi.string().email({ minDomainSegments: 2, tlds: false }).messages({
        "string.base": "Email must be a string",
        "string.empty": "Email cannot be empty",
        "string.email": "Email must be a valid email address",
        "any.required": "Email is required"
    }),
    password: Joi.string().required().messages({
        "string.base": "Password must be a string",
        "string.empty": "Password cannot be empty",
        "string.pattern": "Password must be a valid password",
        "any.required": "Password is required",
        "any.only": "Password must match password",
        "string.pattern.base": pswdReqTxt
    })
});
