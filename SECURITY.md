# Smart Farm Manager - Security Documentation
## Production-Ready Security Improvements

### 1. Firestore Security Rules (Hardened)
We have implemented granular rules in `firestore.rules` that enforce:
- **Ownership Isolation**: Farmer A cannot read or write Farmer B's data using `isDocOwner()` and `isMfaAuthenticated()`.
- **MFA Enforcement**: Sensitive data (Livestock, Revenue, Inventory) now requires `isMfaAuthenticated()`, which checks for a second-factor sign-in token.
- **Data Validation**: Added `isValidString` and type checks (e.g., `is number`) to prevent schema corruption.
- **PII Protection**: The `users` collection is now restricted so users can only read their own profile.

### 2. 2FA Logic & Recovery
**Implementation Strategy:**
- **Session Persistence**: Using `browserLocalPersistence` for standard sessions. For high-security environments, consider `browserSessionPersistence`.
- **MFA Bypass Prevention**: The `isMfaAuthenticated()` rule in Firestore is the ultimate fallback. Even if the client-side is bypassed, the database will reject requests without the MFA token.
- **Recovery Codes**: Recovery codes should be stored in a separate, encrypted collection (e.g., `/recovery_codes/{userId}`) with `allow read: if isOwner(userId)` and `allow write: if false` (only writable via Admin SDK/Cloud Functions).

### 3. API & Function Security
**Internal-Only Functions:**
- Use **IAM Roles** to restrict function execution.
- Implement **App Check enforcement** in Cloud Functions:
  ```javascript
  if (context.app === undefined) {
    throw new functions.https.HttpsError('failed-precondition', 'The function must be called from a verified app.');
  }
  ```
- Use `runWith({ ingressSettings: 'ALLOW_INTERNAL_ONLY' })` for functions that should only be triggered by other GCP services.

### 4. Data Sanitization Checklist
- [ ] **Input Length Limits**: Enforced in Firestore rules (e.g., `isValidString('name', 2, 50)`).
- [ ] **Type Enforcement**: Ensure numeric fields are actually numbers to prevent NoSQL injection patterns.
- [ ] **No Raw HTML**: Use libraries like `DOMPurify` if rendering user-generated content.
- [ ] **Parameterized Queries**: Firestore's SDK naturally prevents SQL-style injection, but always avoid building query strings dynamically from user input.

### 5. Environment Hardening (App Check)
- **Configuration**: Initialized in `src/firebase.ts` using `ReCaptchaV3Provider`.
- **Enforcement**: Once enabled in the Firebase Console, all requests without a valid App Check token will be blocked at the infrastructure level, protecting against bots and scrapers.

---
*Prepared by Senior Cybersecurity Engineer*
