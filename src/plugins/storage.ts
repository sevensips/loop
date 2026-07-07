import fp from 'fastify-plugin';
import { randomUUID } from 'node:crypto';
import {
  S3Client,
  PutObjectCommand,
  DeleteObjectCommand,
  HeadBucketCommand,
  CreateBucketCommand,
  PutBucketPolicyCommand,
} from '@aws-sdk/client-s3';
import type { FastifyInstance } from 'fastify';

declare module 'fastify' {
  interface FastifyInstance {
    storage: {
      /** Загружает буфер в бакет, возвращает публичный URL объекта */
      upload: (buffer: Buffer, contentType: string, prefix: string) => Promise<string>;
      /** Удаляет объект по его ключу (не по полному URL) */
      remove: (key: string) => Promise<void>;
    };
  }
}

// Разрешённые типы фото — режем всё остальное ещё до похода в S3.
const ALLOWED_MIME = new Set(['image/jpeg', 'image/png', 'image/webp']);
const EXT_BY_MIME: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
};

export default fp(async (app: FastifyInstance) => {
  const endpoint = process.env.S3_ENDPOINT ?? 'http://localhost:9000';
  const bucket = process.env.S3_BUCKET ?? 'partyloop';
  const publicUrl = (process.env.S3_PUBLIC_URL ?? endpoint).replace(/\/$/, '');

  const client = new S3Client({
    endpoint,
    region: process.env.S3_REGION ?? 'us-east-1',
    credentials: {
      accessKeyId: process.env.S3_ACCESS_KEY ?? 'partyloop',
      secretAccessKey: process.env.S3_SECRET_KEY ?? 'partyloop-secret',
    },
    // MinIO — не AWS, ему нужен path-style: http://host:9000/bucket/key
    forcePathStyle: true,
  });

  // Бакет создаём сам при старте — на MVP-стадии не хочется отдельного
  // шага провижининга. В проде обычно создают заранее через IaC.
  let bucketReady = false;
  try {
    await client.send(new HeadBucketCommand({ Bucket: bucket }));
    bucketReady = true;
  } catch {
    try {
      await client.send(new CreateBucketCommand({ Bucket: bucket }));
      app.log.info({ bucket }, 'Создан S3-бакет для фото');
      bucketReady = true;
    } catch (err) {
      app.log.error({ err, bucket }, 'Не удалось создать/проверить S3-бакет');
    }
  }

  // Фото вечеринок/аватары отдаём напрямую по URL, без pre-signed ссылок —
  // поэтому бакету нужна публичная политика на чтение (GetObject).
  if (bucketReady) {
    try {
      await client.send(
        new PutBucketPolicyCommand({
          Bucket: bucket,
          Policy: JSON.stringify({
            Version: '2012-10-17',
            Statement: [
              {
                Effect: 'Allow',
                Principal: '*',
                Action: ['s3:GetObject'],
                Resource: [`arn:aws:s3:::${bucket}/*`],
              },
            ],
          }),
        })
      );
    } catch (err) {
      app.log.warn({ err, bucket }, 'Не удалось выставить публичную read-политику бакета');
    }
  }

  app.decorate('storage', {
    async upload(buffer: Buffer, contentType: string, prefix: string): Promise<string> {
      if (!ALLOWED_MIME.has(contentType)) {
        throw new Error('Недопустимый тип файла: разрешены только JPEG, PNG, WEBP');
      }
      const ext = EXT_BY_MIME[contentType];
      const key = `${prefix}/${randomUUID()}.${ext}`;

      await client.send(
        new PutObjectCommand({
          Bucket: bucket,
          Key: key,
          Body: buffer,
          ContentType: contentType,
        })
      );

      return `${publicUrl}/${bucket}/${key}`;
    },

    async remove(key: string): Promise<void> {
      await client.send(new DeleteObjectCommand({ Bucket: bucket, Key: key }));
    },
  });
});
