## Plan: Connect Browse Filters to Firestore Queries

### Problem
The Browse Books page already has UI controls for search, category, city, price range, and condition, but only `category` is pushed to the Firestore query. The rest are applied client-side after fetching **all** approved listings. This wastes bandwidth and slows down as the catalog grows.

### Solution
Push applicable filters to Firestore queries. Firestore-native filters: `category` (==), `condition` (==), `price range` (>= / <=). Client-side filters (Firestore cannot do these): text search on `title`/`author`, and partial city matching.

### Changes

#### 1. `src/lib/listings.ts` — Expand `getApprovedListings`
- Add `condition`, `minPrice`, `maxPrice` to the options object.
- Build Firestore `QueryConstraint[]` dynamically:
  - `where("status", "==", "approved")`
  - `where("category", "==", category)` (if provided)
  - `where("condition", "==", condition)` (if provided)
  - `where("sellingPrice", ">=", minPrice)` (if > 0)
  - `where("sellingPrice", "<==", maxPrice)` (if > 0)
  - `orderBy("createdAt", "desc")`
  - `limit` (if provided)
- Query executed with `getDocs(query(collection(db, COLLECTION), ...constraints))`.

#### 2. `src/routes/browse.tsx` — Refactor to canonical data-loading pattern
- Convert from inline `useQuery` + `isLoading` to:
  - **Loader**: `context.queryClient.ensureQueryData(listingsQueryOptions(params))`
  - **Component**: `useSuspenseQuery(listingsQueryOptions(params))`
- Add `errorComponent` (retry button calling `router.invalidate()`) and `notFoundComponent`.
- Update the `queryKey` to include all active filter params so the cache invalidates correctly when filters change.
- Keep client-side `useMemo` filtering for `q` (text search) and `city` (partial match), applied on top of the Firestore-filtered results.
- The `useQuery` call key becomes: `["listings", "approved", params.q, params.category, params.city, params.condition, params.min, params.max]`.

#### 3. `FIREBASE_SETUP.md` — Document required composite indexes
Add a section listing the composite indexes Firebase will likely ask the user to create via its console link on first query:
- `(status, createdAt)` — base index
- `(status, category, createdAt)` — when filtering by category
- `(status, condition, createdAt)` — when filtering by condition  
- `(status, sellingPrice, createdAt)` — when filtering by price range
- `(status, category, sellingPrice, createdAt)` — combined category + price

Firestore will surface a direct console link if a required index is missing; the user clicks it and Firebase auto-creates it.

### Testing
- Change category → Firestore query should only fetch that category.
- Set price range → Firestore query should only fetch books in that range.
- Type in search → results should still filter by title/author client-side.
- Type in city → results should still filter by partial city match client-side.
- Verify empty state still renders when no results match.
- Verify mobile filter drawer still works.

### Out of scope
- Full-text search via Algolia/Typesense (Firestore does not support native full-text search).
- Firestore `orderBy` on `sellingPrice` (kept as `createdAt` to show newest first).
- Any UI visual redesign — the existing filter controls and layout remain unchanged.