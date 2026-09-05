
import { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { v4 as uuidv4 } from "uuid";
import path from "path";
import { SESClient, SendEmailCommand } from "@aws-sdk/client-ses";

const urlCache = new Map();

const s3 = new S3Client({
  region: process.env.AWS_REGION
});

const sesClient = new SESClient({
  region: process.env.AWS_REGION,
});

// ✅ Get pre-signed upload URL
export async function getUploadUrl_aws({ fileName, fileType, folder_name, UniqueFileName }) {
  if (!fileName) throw new Error("fileName required");
  if (!fileType) throw new Error("fileType required");
  if (!UniqueFileName) throw new Error("UniqueFileName required");

  if (!fileType.startsWith("image/")) throw new Error("Only images allowed");

  const ext = path.extname(fileName) || ".bin";
  const safeFileName = String(UniqueFileName || "unknown").replace(/[^a-zA-Z0-9-_]/g, "-");

  const key = `${process.env.isProd === "true" ? "" : "test/"}${folder_name}/${safeFileName+ext}`;

  const cmd = new PutObjectCommand({
    Bucket: process.env.S3_BUCKET,
    Key: key,
    ContentType: fileType
  });

  const uploadUrl = await getSignedUrl(s3, cmd, { expiresIn: 60 });
  return { uploadUrl, key };
}

// ✅ Get pre-signed upload URL
export async function getUploadUrl_aws_policy({ fileName, fileType }) {
  if (!fileName) throw new Error("fileName required");
  if (!fileType) throw new Error("fileType required");

  if (!fileType.startsWith("image/")) throw new Error("Only images allowed");

  const safeText = Date.now();

  const key = `${process.env.isProd === "true" ? "" : "test/"}SchemePolicy/${safeText}.png`;

  const cmd = new PutObjectCommand({
    Bucket: process.env.S3_BUCKET,
    Key: key,
    ContentType: fileType
  });

  const uploadUrl = await getSignedUrl(s3, cmd, { expiresIn: 60 });
  return { uploadUrl, key };
}

// ✅ Get pre-signed upload URL for PDFs (flipbook / approved manuscripts)
export async function getPdfUploadUrl_aws({ fileName, fileType, folder_name, UniqueFileName }) {
  if (!fileName) throw new Error("fileName required");
  if (!fileType) throw new Error("fileType required");
  if (!UniqueFileName) throw new Error("UniqueFileName required");

  if (fileType !== "application/pdf") throw new Error("Only PDF files allowed");

  const safeFileName = String(UniqueFileName || "unknown").replace(/[^a-zA-Z0-9-_]/g, "-");

  const key = `${process.env.isProd === "true" ? "" : "test/"}${folder_name}/${safeFileName}.pdf`;

  const cmd = new PutObjectCommand({
    Bucket: process.env.S3_BUCKET,
    Key: key,
    ContentType: fileType
  });

  const uploadUrl = await getSignedUrl(s3, cmd, { expiresIn: 60 });
  return { uploadUrl, key };
}

// ✅ Get pre-signed view URL
export async function getViewUrl_aws(key) {
  if (!key) throw new Error("key required");

  const cmd = new GetObjectCommand({
    Bucket: process.env.S3_BUCKET,
    Key: key
  });

  return await getSignedUrl(s3, cmd, { expiresIn: 600 });
}

// ✅ Delete an object — used to clean up superseded images (e.g. when an
// editor re-crops/re-zooms a photo and the old version is no longer
// referenced anywhere), so storage doesn't accumulate orphaned files.
export async function deleteFile_aws(key) {
  if (!key) return;
  const cmd = new DeleteObjectCommand({
    Bucket: process.env.S3_BUCKET,
    Key: key,
  });
  await s3.send(cmd);
}

// ✅ Cached view URL
export async function getCachedViewUrl(key) {
  if (process.env.isProd !== "true") {
    return "/aws.png";
  }

  const now = Date.now();
  const cached = urlCache.get(key);

  if (cached && cached.expiresAt > now) {
    return cached.url;
  }

  const url = await getViewUrl_aws(key);
  urlCache.set(key, { url, expiresAt: now + 600_000 }); // 10 min
  return url;
}

export async function sendMail(to, subject, body) {
  if (!to) throw new Error("Parameter 'to' is required");
  if (!subject) throw new Error("Parameter 'subject' is required");
  if (!body) throw new Error("Parameter 'body' is required");
  console.log(process.env.isProd)

  if (process.env.isProd == 'false') {
    console.error('-----------------------------------------------')
    console.error('------------- Mail Send ------------------');
    console.error("To: " + to);
    console.error("Subject: " + subject);
    console.error("Body: " + body);
    console.error('-----------------------------------------------')
    return 0;
  }

  const cc = ['snc.rahulpatel@gmail.com'];

  const params = {
    Destination: {
      ToAddresses: [to],
      ...(cc.length ? { CcAddresses: Array.isArray(cc) ? cc : [cc] } : {}),
    },
    Message: {
      Body: {
        Html: {
          Data: body,
          Charset: "UTF-8",
        },
      },
      Subject: {
        Data: subject,
        Charset: "UTF-8",
      },
    },

    Source: 'admin@info.snckids.in', // Your verified sender email or domain
  };

  try {
    const command = new SendEmailCommand(params);
    const response = await sesClient.send(command);
    return response; // Contains MessageId and response metadata
  } catch (error) {
    console.error("Error sending email:", error);
    throw error;
  }
}


