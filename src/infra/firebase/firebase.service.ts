import { Injectable, Logger } from '@nestjs/common';
import * as admin from 'firebase-admin';

@Injectable()
export class FirebaseService {
  private readonly logger = new Logger(FirebaseService.name);
  private _app: admin.app.App;

  constructor() {
    if (admin.apps.length === 0) {
      // Cách 1: dùng biến môi trường (không cần file JSON)
      // Lưu ý: PRIVATE_KEY phải replace \n -> newline
      const privateKey = (process.env.FIREBASE_PRIVATE_KEY || '').replace(/\\n/g, '\n');

      this._app = admin.initializeApp({
        credential: admin.credential.cert({
          projectId: process.env.FIREBASE_PROJECT_ID,
          clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
          privateKey,
        }),
        storageBucket: process.env.FIREBASE_STORAGE_BUCKET, // ví dụ: my-project.appspot.com
      });
      this.logger.log('Firebase admin initialized');
    } else {
      this._app = admin.app();
    }
  }

  get storage() {
    return this._app.storage();
  }

  get bucket() {
    return this._app.storage().bucket(); // mặc định từ storageBucket ở trên
  }
}
