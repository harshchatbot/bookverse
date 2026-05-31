# BookVerse — Firebase Setup

This project uses **Firebase** for Auth, Firestore, and Storage. Before the app works, complete these one-time steps in the [Firebase Console](https://console.firebase.google.com/project/bookverse-a0024):

## 1. Enable Google sign-in
Authentication → Sign-in method → enable **Google**.

## 2. Authorize your domains
Authentication → Settings → **Authorized domains** → add:
- `localhost`
- your Lovable preview domain (e.g. `id-preview--*.lovable.app`)
- your published domain (when you publish)

## 3. Enable Firestore
Build → Firestore Database → **Create database** (production mode, region close to India e.g. `asia-south1`).

## 4. Enable Storage
Build → Storage → **Get started**.

## 5. Paste security rules
- Copy `firestore.rules` from this repo into Firestore → Rules → Publish.
- Copy `storage.rules` from this repo into Storage → Rules → Publish.

## 6. Composite indexes (created on demand)
The first time someone filters by category, condition, or price, Firestore
will print a console link like *"The query requires an index"* — click it
to create the index in one click. Likely indexes for the Browse page:

- `(status ASC, createdAt DESC)` — base feed
- `(status ASC, category ASC, createdAt DESC)` — category filter
- `(status ASC, condition ASC, createdAt DESC)` — condition filter
- `(status ASC, sellingPrice ASC, createdAt DESC)` — price range
- `(status ASC, category ASC, sellingPrice ASC, createdAt DESC)` — category + price
- `(status ASC, condition ASC, sellingPrice ASC, createdAt DESC)` — condition + price

## Admin access
Admins are whitelisted by email in `src/integrations/firebase/client.ts`
(`ADMIN_EMAILS`). Current admin: `harshveernirwan@gmail.com`. The same list
is duplicated inside `firestore.rules` — update both places when adding admins.
