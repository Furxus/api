import { Schema, type InferSchemaType, model } from "mongoose";

const requestLogSchema = new Schema({
    ips: [String],
    agents: [String],
    languages: [String],
    locations: [String],
    associatedUsers: [String],
    firstRequest: {
        type: Date,
        required: true
    },
    firstRequestTimestamp: {
        type: Number,
        required: true
    },
    lastRequest: Date,
    lastRequestTimestamp: Number,
    totalRequests: {
        type: Number,
        default: 0
    }
});

requestLogSchema.pre("save", function (next) {
    this.set({
        lastRequest: new Date(),
        lastRequestTimestamp: Date.now(),
        totalRequests: this.totalRequests + 1
    });

    next();
});

requestLogSchema.pre("updateOne", function (next) {
    this.set({
        lastRequest: new Date(),
        lastRequestTimestamp: Date.now(),
        totalRequests: this.get("totalRequests") + 1
    });

    next();
});

export type IRequestLog = InferSchemaType<typeof requestLogSchema>;

const requestLogModel = model("requestLogs", requestLogSchema);

export type RequestLogDocument = ReturnType<
    (typeof requestLogModel)["hydrate"]
>;

export default requestLogModel;
