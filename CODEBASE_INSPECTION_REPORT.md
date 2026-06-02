# BookVerse Codebase Inspection Report

**Project Type:** React + TanStack Start + Tailwind + Firebase (educational books marketplace)  
**Current Status:** No cart/checkout/payment implementation  
**Inspection Date:** June 2, 2026

---

## 1. PROJECT STRUCTURE

### Folder Tree (excluding node_modules, .git, dist, build, .output, .vercel)

```
BookVerse India/
├── public/
│   ├── assets/logo/
│   ├── assets/testimonials/
│   ├── favicon.ico
│   ├── favicon.png
│   ├── icon-*.png (PWA icons)
│   ├── manifest.webmanifest
│   └── sw.js (service worker)
├── src/
│   ├── components/
│   │   ├── AdminAnalytics.tsx
│   │   ├── AdminMarketplace.tsx
│   │   ├── AuthGate.tsx
│   │   ├── BookCard.tsx
│   │   ├── BookCardSkeleton.tsx
│   │   ├── BuyNowButton.tsx
│   │   ├── Footer.tsx
│   │   ├── Header.tsx
│   │   ├── Illustration.tsx
│   │   ├── MakeOfferButton.tsx
│   │   ├── NotificationsBell.tsx
│   │   ├── OrderStatusBadge.tsx
│   │   ├── PickupMapPreview.tsx
│   │   ├── ReportListingButton.tsx
│   │   ├── SaveButton.tsx (heart icon for wishlist)
│   │   ├── Spinner.tsx
│   │   ├── VerifiedBadge.tsx
│   │   ├── WhatsAppButton.tsx
│   │   ├── dashboard/
│   │   │   └── DashboardKit.tsx
│   │   └── ui/ (radix-ui + shadcn components)
│   ├── hooks/
│   │   ├── use-mobile.tsx
│   │   └── useAuth.tsx (auth context + provider)
│   ├── integrations/
│   │   └── firebase/
│   │       └── client.ts (Firebase init + config)
│   ├── lib/
│   │   ├── admin.server.ts
│   │   ├── analytics.ts
│   │   ├── api-client.ts
│   │   ├── api/
│   │   │   └── example.functions.ts
│   │   ├── confetti.ts
│   │   ├── config.server.ts
│   │   ├── constants.ts (categories, conditions, delivery types)
│   │   ├── error-capture.ts
│   │   ├── error-page.ts
│   │   ├── fulfillment.server.ts
│   │   ├── listings.ts (Firestore queries + mutations)
│   │   ├── lovable-error-reporting.ts
│   │   ├── notifications.ts
│   │   ├── offers.ts (Firestore offers collection)
│   │   ├── orders.ts
│   │   ├── profiles.ts
│   │   ├── razorpay.server.ts (payment gateway integration)
│   │   ├── reconciler.server.ts
│   │   ├── reports.ts
│   │   ├── seed.ts (sample data generation)
│   │   ├── serialize.ts
│   │   ├── shiprocket.server.ts (shipping integration)
│   │   ├── types.ts (TypeScript interfaces)
│   │   ├── utils.ts
│   │   ├── wishlist.ts (Firestore wishlist collection)
│   │   └── [more utility files]
│   ├── routes/
│   │   ├── __root.tsx (root layout + providers)
│   │   ├── index.tsx (home page)
│   │   ├── about.tsx
│   │   ├── browse.tsx (listing search/filter page)
│   │   ├── admin.tsx (admin dashboard)
│   │   ├── sell.tsx (create book listing form)
│   │   ├── my-listings.tsx (seller's listings)
│   │   ├── login.tsx
│   │   ├── profile.tsx
│   │   ├── wishlist.tsx
│   │   ├── offers.tsx (buyer & seller offers)
│   │   ├── orders.tsx (buyer orders)
│   │   ├── sell-orders.tsx (seller orders/sales)
│   │   ├── order.$id.tsx (order detail)
│   │   ├── book.$id.tsx (book detail page)
│   │   ├── seller.$uid.tsx (seller profile)
│   │   ├── notifications.tsx
│   │   ├── buyer-dashboard.tsx
│   │   ├── seller-dashboard.tsx
│   │   ├── checkout.$listingId.tsx
│   │   ├── refunds.tsx
│   │   ├── privacy.tsx
│   │   ├── terms.tsx
│   │   ├── api/
│   │   │   ├── admin/
│   │   │   ├── checkout/
│   │   │   ├── public/ (webhooks)
│   │   │   ├── seller/
│   │   │   └── shipping/
│   │   └── README.md
│   ├── router.tsx (TanStack Router config)
│   ├── routeTree.gen.ts (auto-generated route manifest)
│   ├── server.ts (Nitro server entry)
│   ├── start.ts (TanStack Start entry)
│   └── styles.css (global Tailwind styles)
├── package.json
├── tsconfig.json
├── vite.config.ts
├── firestore.rules (Firestore security rules)
├── storage.rules
├── vercel.json
├── FIREBASE_SETUP.md (setup documentation)
└── [config files: .prettierrc, eslint.config.js, etc.]
```

### Routes Summary

Routes live in **`src/routes/`** using TanStack Router file-based routing.

**All Route Files:**

- `__root.tsx` - Root layout (Header, AuthProvider, QueryClient, Toaster)
- `index.tsx` - Home page
- `about.tsx` - About page
- `browse.tsx` - Book listing browser with search/filter
- `sell.tsx` - Create book listing form
- `my-listings.tsx` - Seller's uploaded listings
- `admin.tsx` - Admin dashboard (pending/approved/rejected/sold listings)
- `login.tsx` - Login page
- `profile.tsx` - User profile
- `wishlist.tsx` - Saved books
- `offers.tsx` - Buyer's sent offers & seller's received offers
- `orders.tsx` - Buyer's orders (checkout history)
- `sell-orders.tsx` - Seller's sales orders
- `seller-dashboard.tsx` - Seller analytics
- `buyer-dashboard.tsx` - Buyer analytics
- `notifications.tsx` - User notifications
- `order.$id.tsx` - Order detail page
- `book.$id.tsx` - Book detail page with MakeOfferButton & SaveButton
- `seller.$uid.tsx` - Seller profile page
- `checkout.$listingId.tsx` - Razorpay checkout flow
- `refunds.tsx` - Refund history
- `privacy.tsx` - Privacy policy
- `terms.tsx` - Terms of service
- **API Routes** (Nitro/TanStack Start server functions):
  - `api/checkout/create-order.ts` - Create Razorpay order
  - `api/checkout/verify.ts` - Verify payment
  - `api/admin/*` - Admin operations
  - `api/seller/*` - Seller operations
  - `api/public/razorpay/webhook.ts` - Razorpay webhook
  - `api/public/shiprocket/webhook.ts` - ShipRocket webhook
  - `api/public/cron/reconcile.ts` - Scheduled reconciliation
  - `api/shipping/rates.ts` - Shipping rates

---

## 2. KEY FILE CONTENTS

### Firebase Config

**File:** `src/integrations/firebase/client.ts`

```typescript
import { initializeApp, getApps, getApp } from "firebase/app";
import { getAuth, GoogleAuthProvider } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";

const firebaseConfig = {
  apiKey: "[REDACTED]",
  authDomain: "bookverse-a0024.firebaseapp.com",
  projectId: "bookverse-a0024",
  storageBucket: "bookverse-a0024.firebasestorage.app",
  messagingSenderId: "516406961987",
  appId: "1:516406961987:web:6b9b0d97dd6eb5836c71f6",
  measurementId: "G-TK5YHNHJGC",
};

export const firebaseApp = getApps().length ? getApp() : initializeApp(firebaseConfig);
export const auth = getAuth(firebaseApp);
export const db = getFirestore(firebaseApp);
export const storage = getStorage(firebaseApp);
export const googleProvider = new GoogleAuthProvider();

export const ADMIN_EMAILS = ["harshveernirwan@gmail.com"];
```

**Note:** API key is redacted but structure shown. Secret values available in project settings.

---

### package.json

```json
{
  "name": "tanstack_start_ts",
  "private": true,
  "type": "module",
  "dependencies": {
    "@grpc/grpc-js": "^1.14.4",
    "@grpc/proto-loader": "^0.8.0",
    "@hookform/resolvers": "^5.4.0",
    "@radix-ui/*": "latest",
    "@tanstack/react-query": "^5.83.0",
    "@tanstack/react-router": "^1.168.25",
    "@tanstack/react-start": "^1.167.50",
    "firebase": "^12.14.0",
    "firebase-admin": "^13.10.0",
    "razorpay": "^2.9.6",
    "react": "^19.2.0",
    "react-hook-form": "^7.76.1",
    "recharts": "^2.15.4",
    "tailwindcss": "^4.2.1",
    "zod": "^4.4.3"
  },
  "devDependencies": {
    "typescript": "^5.8.3",
    "vite": "^7.3.1"
  }
}
```

---

### Firestore Security Rules

**File:** `firestore.rules`

```
rules_version = '2';

service cloud.firestore {
  match /databases/{database}/documents {

    function isSignedIn() { return request.auth != null; }
    function isAdmin() {
      return isSignedIn() && request.auth.token.email in ['harshveernirwan@gmail.com'];
    }

    // LISTINGS: public approved/sold, seller sees own, admin sees all
    match /listings/{listingId} {
      allow read: if resource.data.status in ['approved', 'sold']
                  || (isSignedIn() && resource.data.sellerUid == request.auth.uid)
                  || isAdmin();
      allow create: if isSignedIn()
                    && request.resource.data.sellerUid == request.auth.uid
                    && request.resource.data.status == 'pending';
      allow update: if isAdmin()
                    || (isSignedIn()
                        && resource.data.sellerUid == request.auth.uid
                        && resource.data.status == 'approved'
                        && request.resource.data.status == 'sold');
      allow delete: if isAdmin();
    }

    // PROFILES: world-readable, user can write own
    match /profiles/{uid} {
      allow read: if true;
      allow write: if isSignedIn() && request.auth.uid == uid;
    }

    // ORDERS, PAYMENTS, SHIPMENTS, PAYOUTS: server-only (Admin SDK)
    // Clients read their own or are admin
    match /orders/{orderId} {
      allow read: if isSignedIn() && (
        resource.data.buyerUid == request.auth.uid
        || resource.data.sellerUid == request.auth.uid
        || isAdmin()
      );
      allow write: if isAdmin();
    }

    match /payments/{paymentId} {
      allow read: if isSignedIn() && (
        resource.data.buyerUid == request.auth.uid
        || resource.data.sellerUid == request.auth.uid
        || isAdmin()
      );
      allow write: if isAdmin();
    }

    match /shipments/{shipmentId} {
      allow read: if isSignedIn();
      allow write: if isAdmin();
    }

    match /seller_payouts/{payoutId} {
      allow read: if isSignedIn() && (
        resource.data.sellerUid == request.auth.uid || isAdmin()
      );
      allow write: if isAdmin();
    }

    // DISPUTES: buyers/sellers can raise, admin resolves
    match /disputes/{disputeId} {
      allow read: if isSignedIn() && (
        resource.data.raisedBy == request.auth.uid || isAdmin()
      );
      allow create: if isSignedIn()
                    && request.resource.data.raisedBy == request.auth.uid
                    && request.resource.data.status == 'open';
      allow update, delete: if isAdmin();
    }

    // CARTS: user-scoped
    match /carts/{uid} {
      allow read, write: if isSignedIn() && request.auth.uid == uid;
    }

    // NOTIFICATIONS: user-scoped, admin creates/deletes
    match /notifications/{id} {
      allow read: if isSignedIn() && resource.data.userUid == request.auth.uid;
      allow update: if isSignedIn() && resource.data.userUid == request.auth.uid;
      allow create, delete: if isAdmin();
    }
  }
}
```

---

### Root Route / Layout File

**File:** `src/routes/__root.tsx` (excerpt)

```typescript
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  createRootRouteWithContext,
  HeadContent,
  Scripts,
} from "@tanstack/react-router";
import { AuthProvider } from "../hooks/useAuth";
import { Toaster } from "sonner";

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "BookVerse — Buy & Sell Educational Books Across India" },
      { name: "description", content: "India's marketplace for educational books..." },
    ],
    links: [
      { rel: "manifest", href: "/manifest.webmanifest" },
      { rel: "stylesheet", href: appCss },
    ],
  }),
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootComponent() {
  const { queryClient } = Route.useRouteContext();
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <Outlet /> {/* nested routes render here */}
        <Toaster richColors position="top-center" />
      </AuthProvider>
    </QueryClientProvider>
  );
}
```

**Key Points:**

- `AuthProvider` wraps all routes
- `QueryClientProvider` for React Query
- `Toaster` for notifications
- Service Worker registered on mount
- PWA manifest linked

---

### Header Component

**File:** `src/components/Header.tsx`

**Key Features:**

- Desktop nav with Logo, Browse, Sell, About links
- Mobile hamburger menu
- Auth-gated user menu with:
  - Profile, Wishlist, My Listings, My Orders, My Sales, Seller Dashboard, Buyer Dashboard, Offers
  - Admin Dashboard (conditional on `isAdmin`)
  - Sign out button
- Desktop "List a book" CTA button
- Notifications bell (auth-gated)
- Google Sign-in button for non-authenticated users

**Structure:**

- Header wrapper with sticky positioning
- NavLinks array for DRY routing
- Menu state management with useState
- `AuthGate` component for auth-gated sections

---

### Sell Form / Book Submission

**File:** `src/routes/sell.tsx`

**Form Schema (Zod):**

```
- title: string (2-200 chars)
- author: string (1-150 chars)
- category: enum (from CATEGORIES)
- edition: string (optional, max 80)
- originalPrice: number (0-100000)
- sellingPrice: number (1-100000)
- condition: enum (from CONDITIONS)
- city: string (2-80 chars) ← FREE TEXT, NO STATE/VALIDATION
- deliveryType: enum (local|shipping)
- description: string (optional, max 2000)
- sellerName: string (2-80 chars, letters/spaces/apostrophes only)
- sellerMobile: string (10-digit Indian mobile, regex: /^[6-9]\d{9}$/)
```

**Image Upload:**

- Max 6 images per listing
- Allowed types: JPG, PNG, WebP
- Max 5MB per image
- Uploaded to Firebase Storage
- Images array returned before form submission

**Submission Flow:**

1. Upload all images to Storage (with progress tracking)
2. Create listing doc in Firestore with image URLs
3. Status set to "pending" (requires admin approval)
4. User redirected to `/my-listings`

**Important Note:** City is stored as free text (e.g., "Mumbai"). No state/region field.

---

### My Listings Page

**File:** `src/routes/my-listings.tsx`

**Features:**

- Auth-gated (fallback to sign-in page)
- Displays seller's listings in order of creation (newest first)
- Listing card shows: cover image, title, category, price, city, status badge
- Status badges: Pending review, Live (approved), Rejected, Sold
- Actions:
  - Mark sold (for approved listings)
  - Relist (for sold listings)
  - Link to book detail page

**Data Fetched:**

```typescript
const { data: listings = [], isLoading } = useQuery({
  queryKey: ["my-listings", user.uid],
  queryFn: () => getMyListings(user.uid),
});
```

---

### Admin Dashboard

**File:** `src/routes/admin.tsx`

**Features:**

- Auth-gated, requires `isAdmin` from useAuth context
- Tab-based filtering: Pending, Approved, Rejected, Sold
- For each listing, shows:
  - Cover image, title, author, price
  - Category, condition, city tags
  - Seller info (name, mobile, email)
  - Actions based on status:
    - **Pending:** Approve (green) or Reject (red)
    - **Approved:** Mark Sold
    - **Rejected:** Re-approve
- View button to see listing detail
- "Seed sample listings" button for testing

**Data Fetched:**

```typescript
const { data: listings = [], isLoading } = useQuery({
  queryKey: ["admin-listings", tab],
  queryFn: () => getListingsByStatus(tab),
});
```

---

### Offers Page

**File:** `src/routes/offers.tsx`

**Two Tabs:**

1. **Received Offers** (seller's perspective)
   - Shows offers buyers sent for seller's books
   - Fetches from `getOffersForSeller(user.uid)`

2. **Sent Offers** (buyer's perspective)
   - Shows offers buyer sent to other sellers
   - Fetches from `getOffersForBuyer(user.uid)`

**Offer Structure:**

```typescript
interface Offer {
  id: string;
  listingId: string;
  listingTitle: string;
  listingPrice: number;
  sellerUid: string;
  buyerUid: string;
  buyerName: string;
  buyerEmail: string | null;
  amount: number;
  message: string;
  status: "pending" | "accepted" | "declined";
  createdAt: string | null;
}
```

---

### Wishlist Page

**File:** `src/routes/wishlist.tsx`

**Features:**

- Auth-gated
- Displays saved books in grid layout (2-4 columns responsive)
- Books shown as `BookCard` components
- Newest saved books appear first

**Data Flow:**

1. Fetch wishlist IDs: `getWishlistIds(user.uid)` → returns string array
2. Fetch full listing docs: `getListingsByIds(ids)` → returns Listing[]
3. Render as grid

**Storage Structure:**

```typescript
// wishlists/{uid}
{
  ids: ["listingId1", "listingId2", ...],
  updatedAt: timestamp
}
```

---

### Auth Hook / Context

**File:** `src/hooks/useAuth.tsx`

```typescript
interface AuthContextValue {
  user: User | null;
  loading: boolean;
  isAdmin: boolean;
  signInWithGoogle: () => Promise<void>;
  signOut: () => Promise<void>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
```

**How Admin is Determined:**

```typescript
const isAdmin = !!user?.email && ADMIN_EMAILS.includes(user.email.toLowerCase());
// ADMIN_EMAILS = ["harshveernirwan@gmail.com"]
```

**Login State:**

- Accessed via `useAuth()` hook
- Returns `user` (Firebase User object) or null
- `loading` boolean during auth state resolution
- Sign-in/out via Google OAuth

---

## 3. FIRESTORE COLLECTIONS & FIELDS

### Collections Used in Code

| Collection         | Access                                             | Fields Written/Read                                                                                                                                                                                        |
| ------------------ | -------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **listings**       | public read (approved/sold), seller own, admin all | title, author, category, edition, originalPrice, sellingPrice, condition, city, deliveryType, description, images[], sellerName, sellerMobile, sellerUid, sellerEmail, status, createdAt, updatedAt, views |
| **profiles**       | world-readable                                     | [user profile fields]                                                                                                                                                                                      |
| **orders**         | seller own, buyer own, admin all                   | buyerUid, sellerUid, listingId, amount, status, paymentId, shipmentId, ...                                                                                                                                 |
| **payments**       | seller own, buyer own, admin all                   | buyerUid, sellerUid, amount, razorpayOrderId, razorpayPaymentId, status, createdAt                                                                                                                         |
| **shipments**      | auth users                                         | shipmentId, status, trackingUrl, ...                                                                                                                                                                       |
| **seller_payouts** | seller own, admin all                              | sellerUid, amount, status, createdAt                                                                                                                                                                       |
| **disputes**       | raiser own, admin all                              | raisedBy, orderId, reason, status, resolution                                                                                                                                                              |
| **carts**          | user own                                           | [items array]                                                                                                                                                                                              |
| **notifications**  | user own                                           | userUid, type, title, body, link, listingId, offerId, read, createdAt                                                                                                                                      |
| **wishlists**      | (direct doc per user)                              | ids: string[], updatedAt                                                                                                                                                                                   |
| **offers**         | seller own (received), buyer own (sent)            | listingId, listingTitle, listingPrice, sellerUid, buyerUid, buyerName, buyerEmail, amount, message, status, createdAt                                                                                      |

### Key Field Patterns

**Listings Status:** `"pending" | "approved" | "rejected" | "sold"`

**Offer Status:** `"pending" | "accepted" | "declined"`

**City:** Stored as plain text string (e.g., "Mumbai", "Delhi", "Bangalore"). No state/region field used.

---

## 4. CURRENT BEHAVIOR NOTES

### How Logged-In User is Accessed

**Via Hook:**

```typescript
const { user, isAdmin, signInWithGoogle, signOut } = useAuth();
```

- `user` is Firebase `User` object (Firebase Auth SDK)
- Has properties: `uid`, `email`, `displayName`, `photoURL`
- Check with: `if (user) { /* authenticated */ }`

**Via AuthGate Component:**

```typescript
<AuthGate
  fallback={<SignInPrompt />}
  requireAdmin={true}
>
  {({ user, isAdmin }) => (
    /* user is guaranteed non-null here */
  )}
</AuthGate>
```

---

### Admin Determination

**Single Admin Check:**

```typescript
export const ADMIN_EMAILS = ["harshveernirwan@gmail.com"];

const isAdmin = !!user?.email && ADMIN_EMAILS.includes(user.email.toLowerCase());
```

- Only one admin email hardcoded
- Checked in client-side `useAuth` hook
- Also enforced server-side in Firestore rules
- Admin has full access to all listings, orders, disputes, etc.

---

### City/State Storage

**Current Implementation:**

- **City:** Stored as free-text string in listing
- **State/Region:** Not captured in form or stored in Firestore
- **Delivery Types:** "local" (pickup only) or "shipping" (across India)

**Form Field (sell.tsx, line 443):**

```typescript
<Field label="City" error={errors.city?.message}>
  <Input {...register("city")} placeholder="Mumbai" />
</Field>
```

Validation: min 2 chars, max 80 chars, no regex (any characters allowed).

---

### Wishlist Heart Functionality

**SaveButton Component:**

- Clicking heart toggles wishlist status
- Updates `wishlists/{uid}` doc with `arrayUnion` or `arrayRemove` of listingId
- Server-side stored as array of listing IDs only
- No metadata (timestamp, notes) stored per item

**Wishlist Page Display:**

- Fetches IDs from `wishlists/{uid}`
- Fetches full listing docs via `getListingsByIds(ids)` (batched in 10-doc chunks)
- Shows newest saved first (IDs array reversed)

---

### Offers Storage & Flow

**Where Offers Stored:**

- Firestore collection: `offers`
- Each offer doc contains: listingId, sellerUid, buyerUid, amount, message, status, createdAt

**Creating an Offer:**

```typescript
await createOffer({
  listingId: string,
  listingTitle: string,
  listingPrice: number,
  sellerUid: string,
  buyerUid: string,
  buyerName: string,
  buyerEmail: string | null,
  amount: number,
  message?: string,
});
```

**Status Lifecycle:**

1. Created as `"pending"`
2. Seller can accept → `"accepted"`
3. Seller can decline → `"declined"`
4. Buyer can cancel → deleted from Firestore

**Notification:**

- When offer created, a notification doc is created for the seller
- Seller receives notification: `"New offer received from {buyerName} for ₹{amount}"`

---

## 5. INTEGRATION POINTS (Not Fully Implemented)

### Payment Gateway

- **Razorpay** integrated (razorpay npm package imported)
- Endpoints: `api/checkout/create-order.ts`, `api/checkout/verify.ts`
- Webhook: `api/public/razorpay/webhook.ts`
- Status: Checkout page exists but no cart/cart checkout flow

### Shipping

- **ShipRocket** integration (shiprocket.server.ts)
- Endpoint: `api/shipping/rates.ts`
- Webhook: `api/public/shiprocket/webhook.ts`
- Status: Infrastructure exists, unclear if fully wired

### Notifications

- Firestore `notifications` collection
- Types: `"offer_received"`, etc.
- NotificationsBell component in header

### Seller Payouts

- `seller_payouts` collection in Firestore
- Status: Server-side only (Admin SDK)

---

## 6. TESTING & SEED DATA

**Seed Function (admin.tsx):**

```typescript
<button onClick={handleSeed} disabled={seeding}>
  Seed 5 sample listings
</button>
```

- Creates 5 approved demo listings under admin account
- Useful for previewing Browse and detail pages

---

## 7. TECH STACK SUMMARY

| Layer                | Technology                             |
| -------------------- | -------------------------------------- |
| **Framework**        | React 19 + TanStack Router             |
| **Server**           | TanStack Start (Nitro)                 |
| **Form Validation**  | Zod + React Hook Form                  |
| **State Management** | React Query (TanStack Query)           |
| **Styling**          | Tailwind CSS v4 + shadcn/ui (Radix)    |
| **Database**         | Firebase Firestore                     |
| **Storage**          | Firebase Cloud Storage                 |
| **Auth**             | Firebase Authentication (Google OAuth) |
| **Payments**         | Razorpay                               |
| **Shipping**         | ShipRocket                             |
| **Notifications**    | Sonner toast + Firestore               |
| **Image Carousel**   | Embla Carousel                         |
| **Charts**           | Recharts                               |
| **Icons**            | Lucide React                           |

---

## 8. ENV & BUILD INFO

**Build Tool:** Vite v7.3.1  
**Package Manager:** npm/bun  
**TypeScript:** v5.8.3  
**Deploy:** Vercel (vercel.json present, .vercel/ config exists)

---

## END OF REPORT

This codebase is a **functional educational books marketplace** with:

- ✅ Listing creation & management
- ✅ Admin approval workflow
- ✅ Wishlist (saved books)
- ✅ Offer system (price negotiation)
- ✅ User authentication (Google)
- ✅ Payment infrastructure (Razorpay)
- ✅ Shipping infrastructure (ShipRocket)
- ⚠️ NO cart/checkout/complete transaction flow
- ⚠️ Admin currently hardcoded to single email

Ready for implementing fixes/features without rewriting.
