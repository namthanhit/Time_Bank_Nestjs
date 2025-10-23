import { Injectable, Logger } from '@nestjs/common';
import * as admin from 'firebase-admin';

@Injectable()
export class FirebaseService {
  private readonly logger = new Logger(FirebaseService.name);
  private _app: admin.app.App;

  constructor() {
    if (!admin.apps.length) {
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

  // ====== Core getters ======
  get app() {
    return this._app;
  }

  get auth(): admin.auth.Auth {
    return this._app.auth();
  }

  get storage() {
    return this._app.storage();
  }

  get bucket() {
    return this._app.storage().bucket();
  }

  // ====== Auth helpers ======

  /** Phát hành Firebase Custom Token để client signInWithCustomToken(...) */
  async issueCustomToken(uid: string, claims?: Record<string, any>): Promise<string> {
    return this.auth.createCustomToken(uid, claims || {});
  }

  /** Xác minh ID token (nếu cần), checkRevoked = true để từ chối token đã revoke */
  async verifyIdToken(idToken: string, checkRevoked = false) {
    return this.auth.verifyIdToken(idToken, checkRevoked);
  }

  /** Revoke tất cả refresh tokens của user trên Firebase (đăng xuất trên tất cả thiết bị) */
  async revokeUserTokens(uid: string): Promise<void> {
    await this.auth.revokeRefreshTokens(uid);
  }
}
