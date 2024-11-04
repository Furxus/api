import { R2 } from "node-cloudflare-r2";

const r2 = new R2({
    accountId: process.env.AWS_ACCOUNT_ID!,
    accessKeyId: process.env.AWS_ACCESS_KEY!,
    secretAccessKey: process.env.AWS_ACCESS_SECRET!
});

const bucket = r2
    .bucket(process.env.AWS_BUCKET!)
    .provideBucketPublicUrl(process.env.AWS_PUBLIC_URL!);

export default bucket;
