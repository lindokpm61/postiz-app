import { IUploadProvider } from './upload.interface';
import { mkdirSync, unlink, writeFileSync } from 'fs';
// @ts-ignore
import mime from 'mime';
import { extname } from 'path';
import axios from 'axios';

export class LocalStorage implements IUploadProvider {
  constructor(private uploadDirectory: string) {}

  async uploadSimple(path: string) {
    try {
      const loadImage = await axios.get(path, {
        responseType: 'arraybuffer',
        timeout: 15000,
        maxRedirects: 5,
        headers: {
          // Some hosts (incl. LinkedIn assets/CDNs) may 403 “headless” requests
          'User-Agent': 'Mozilla/5.0',
          Accept: 'image/*,*/*;q=0.8',
          Referer: 'https://www.linkedin.com/',
        },
      });

      const contentType =
        loadImage?.headers?.['content-type'] ||
        loadImage?.headers?.['Content-Type'];

      // Fallback extension if content-type is missing/unexpected
      const findExtension = mime.getExtension(contentType) || 'jpg';

      const now = new Date();
      const year = now.getFullYear();
      const month = String(now.getMonth() + 1).padStart(2, '0');
      const day = String(now.getDate()).padStart(2, '0');

      const innerPath = `/${year}/${month}/${day}`;
      const dir = `${this.uploadDirectory}${innerPath}`;
      mkdirSync(dir, { recursive: true });

      const randomName = Array(32)
        .fill(null)
        .map(() => Math.round(Math.random() * 16).toString(16))
        .join('');

      const filePath = `${dir}/${randomName}.${findExtension}`;
      const publicPath = `${innerPath}/${randomName}.${findExtension}`;

      writeFileSync(filePath, loadImage.data);

      return process.env.FRONTEND_URL + '/uploads' + publicPath;
    } catch (err: any) {
      // Critical: do NOT block integration creation if image download fails
      const msg =
        err?.response?.status
          ? `${err.response.status} ${err.response.statusText || ''}`.trim()
          : err?.message || String(err);

      console.warn('[LocalStorage.uploadSimple] Failed to fetch image:', path, msg);

      // Fallback: return original URL so the integration can still be saved
      return path;
    }
  }

  async uploadFile(file: Express.Multer.File): Promise<any> {
    try {
      const now = new Date();
      const year = now.getFullYear();
      const month = String(now.getMonth() + 1).padStart(2, '0');
      const day = String(now.getDate()).padStart(2, '0');

      const innerPath = `/${year}/${month}/${day}`;
      const dir = `${this.uploadDirectory}${innerPath}`;
      mkdirSync(dir, { recursive: true });

      const randomName = Array(32)
        .fill(null)
        .map(() => Math.round(Math.random() * 16).toString(16))
        .join('');

      const filePath = `${dir}/${randomName}${extname(file.originalname)}`;
      const publicPath = `${innerPath}/${randomName}${extname(
        file.originalname
      )}`;

      writeFileSync(filePath, file.buffer);

      return {
        filename: `${randomName}${extname(file.originalname)}`,
        path: process.env.FRONTEND_URL + '/uploads' + publicPath,
        mimetype: file.mimetype,
        originalname: file.originalname,
      };
    } catch (err) {
      console.error('Error uploading file to Local Storage:', err);
      throw err;
    }
  }

  async removeFile(filePath: string): Promise<void> {
    return new Promise((resolve, reject) => {
      unlink(filePath, (err) => {
        if (err) reject(err);
        else resolve();
      });
    });
  }
}
