# Complete Migration: Cloudinary to Cloudflare R2 — Multi-Provider Image Storage

## 1. Project Context

You are working on an existing production application that uses:

- Backend: Node.js (inspect the actual framework and architecture).
- Database: MongoDB with Mongoose.
- Current image storage: Cloudinary.
- New image storage: Cloudflare R2.
- Frontend: Inspect the existing implementation.

We want to migrate the application's image storage system from Cloudinary-only to a multi-provider architecture.

**The main objective is:**

- All existing images must remain stored on Cloudinary.
- All existing image records in the actual MongoDB database must be updated to explicitly identify Cloudinary as their provider.
- Every new image uploaded through the website, regardless of its entity or upload location, must be stored in Cloudflare R2.
- MongoDB must store the correct provider and storage metadata for every image.
- Both providers must coexist and work transparently throughout the application.

This is a complete implementation task, not just an architectural proposal or code example.

---

# PHASE 1 — FULL PROJECT AUDIT

Before changing anything, inspect the entire codebase.

Identify:

1. All Mongoose models and schemas containing image fields.
2. All controllers handling image uploads.
3. All services and utilities interacting with Cloudinary.
4. All image upload routes and API endpoints.
5. All image deletion operations.
6. All frontend components and forms that upload images.
7. All frontend components that display images.
8. All image arrays, nested image objects, and single-image fields.
9. Any existing image optimization, resizing, cropping, or transformation logic.

The audit must cover every entity that supports image uploads, including but not limited to:

- Beneficiaries.
- Initiatives.
- Projects.
- Events.
- Association content.
- User profiles.
- Admin-managed content.
- Any other image-bearing entity discovered in the codebase.

Do not assume that all image fields use the same structure.

Document the existing architecture and identify all locations that must be modified.

Do not modify unrelated functionality.

# PHASE 2 — IMPLEMENT MULTI-PROVIDER ARCHITECTURE

Create a centralized image storage abstraction.

Suggested architecture:

ImageStorageService
│
├── CloudinaryProvider
│   ├── upload()
│   ├── delete()
│   └── getUrl()
│
└── CloudflareR2Provider
    ├── upload()
    ├── delete()
    └── getUrl()

Follow the project's existing architecture and conventions when implementing these components.

Requirements:

- Controllers must not contain duplicated provider-specific upload logic.
- All providers must implement a consistent interface.
- Provider selection must be centralized.
- Adding another storage provider in the future should not require rewriting controllers.
- Preserve existing Cloudinary functionality for legacy images.

# PHASE 3 — CONFIGURE CLOUDFLARE R2

Use Cloudflare R2 as the default storage provider for all new image uploads.

Use the S3-compatible API and the appropriate AWS SDK.

Required environment variables:

```env
DEFAULT_STORAGE_PROVIDER=cloudflare

CLOUDFLARE_ACCOUNT_ID=
CLOUDFLARE_R2_ACCESS_KEY_ID=
CLOUDFLARE_R2_SECRET_ACCESS_KEY=
CLOUDFLARE_R2_BUCKET_NAME=
CLOUDFLARE_R2_PUBLIC_URL=
```

Implementation requirements:

- Never hardcode credentials.
- Never expose secret credentials to the frontend.
- Use a Custom Domain or configured public URL for image delivery.
- Generate unique object keys.
- Preserve appropriate file extensions.
- Set the correct Content-Type.
- Validate file types and sizes.
- Handle upload errors safely.
- Do not use the public r2.dev development URL in production.
- Configure appropriate caching behavior.

Do not assume that the R2 bucket or credentials already exist.

If configuration is missing, implement the integration and document exactly what must be configured manually.

Do not fabricate successful upload results without real credentials and a real bucket.

# PHASE 4 — UPDATE DATABASE IMAGE SCHEMAS

Update the relevant Mongoose schemas to support multiple providers.

Use a consistent image metadata structure.

Conceptual Cloudinary image:

```json
{
  "provider": "cloudinary",
  "url": "https://res.cloudinary.com/...",
  "publicId": "association/events/event-123"
}
```

Conceptual Cloudflare image:

```json
{
  "provider": "cloudflare",
  "url": "https://images.example.com/events/event-123.webp",
  "key": "events/event-123.webp"
}
```

Requirements:

- Every image must have its own provider metadata.
- Support single-image fields.
- Support multiple-image arrays.
- Support nested image objects.
- Support mixed providers within the same entity.
- Preserve Cloudinary public IDs.
- Preserve existing URLs and metadata.
- Maintain backward compatibility with legacy records that store image URLs directly as strings.

Important:

Do not assign a single provider to an entire collection or entity.

The provider must belong to each individual image because one entity may contain both Cloudinary and Cloudflare images.

If the existing API expects image URLs as strings, preserve the API response contract where possible to avoid unnecessary frontend changes.

# PHASE 5 — MIGRATE ALL EXISTING MONGODB DATA

THIS PHASE IS MANDATORY.

I do not want you to merely create a migration script or modify Mongoose schemas.

I want the ACTUAL EXISTING MONGODB DATABASE to be updated and verified.

## 5.1 Identify the actual database

Inspect the existing environment configuration and database connection implementation.

Determine:

- The actual MongoDB connection.
- The database name.
- All relevant collections.
- All image-bearing fields.
- The number of existing image records.

Never print database credentials or secrets in logs or reports.

Do not switch to a test database or a newly created database and claim that the existing database was migrated.

## 5.2 Create a safe migration script

Create a reusable, idempotent migration script.

It must:

- Scan all image-bearing collections identified during Phase 1.
- Inspect single-image fields, arrays, and nested image objects.
- Identify existing Cloudinary URLs and Cloudinary public IDs.
- Explicitly assign:

```json
{
  "provider": "cloudinary"
}
```

to existing Cloudinary image records.

- Preserve all existing URLs.
- Preserve all Cloudinary public IDs.
- Preserve existing image metadata.
- Preserve unrelated document fields.
- Avoid duplicate image entries.
- Avoid modifying external image URLs incorrectly.
- Skip records that already have valid provider metadata.
- Handle malformed or incomplete records safely.

Do not download, move, re-upload, or delete any existing Cloudinary image.

The migration is metadata-only.

## 5.3 Backup and dry run

Before executing the actual migration:

1. Verify that a database backup exists or create one using an appropriate supported method.
2. Implement a dry-run mode.
3. Show exactly which records and image fields will be updated.
4. Report the expected number of modifications.
5. Identify records that cannot be safely classified.

Do not run destructive operations.

Do not drop collections or overwrite existing image data.

## 5.4 Execute the actual migration

After confirming the correct database target and backup:

Execute the migration against the actual existing MongoDB database.

Do not stop after generating the migration script.

Do not stop after modifying the schemas.

Do not stop after displaying the dry-run report.

The actual existing image records must be updated.

For all existing Cloudinary images, the database must explicitly identify:

```json
{
  "provider": "cloudinary"
}
```

Keep the existing image locations and URLs unchanged.

If access to the actual database is unavailable, do not pretend the migration was executed. Clearly report that manual execution is still required.

## 5.5 Verify the actual database after migration

Run independent verification queries against MongoDB.

Report:

- Collections scanned.
- Total documents examined.
- Total image references examined.
- Existing Cloudinary images identified.
- Cloudinary records updated.
- Records already marked as Cloudinary.
- Records already marked as Cloudflare.
- External images skipped.
- Invalid or ambiguous records.
- Failed updates.

Verify that all previously existing Cloudinary URLs remain unchanged.

The migration must be safe to execute again without producing duplicate or unwanted modifications.

# PHASE 6 — ALL NEW UPLOADS MUST USE CLOUDFLARE

This is another critical requirement.

After implementation, Cloudflare R2 must be the default provider globally.

Every new image uploaded through the website must go to Cloudflare R2.

This includes every existing upload workflow:

- Beneficiary images.
- Initiative images.
- Project images.
- Event images.
- Association images.
- User profile images.
- Admin dashboard image uploads.
- All other image uploads discovered during the audit.

Requirements:

1. Route every upload operation through ImageStorageService.
2. Use Cloudflare R2 as the default provider.
3. Save the resulting Cloudflare URL and object key.
4. Explicitly save `provider: "cloudflare"` in MongoDB.
5. Do not leave any old upload endpoint silently uploading new images to Cloudinary.
6. Do not require frontend developers to specify the provider manually.
7. Keep provider configuration centralized.

The expected behavior is:

```text
New image upload
       |
       v
Backend ImageStorageService
       |
       v
DEFAULT_STORAGE_PROVIDER=cloudflare
       |
       v
Cloudflare R2 Upload
       |
       v
Save metadata in MongoDB
       |
       v
provider = "cloudflare"
```

Cloudinary should remain available for legacy image retrieval and provider-aware deletion.

# PHASE 7 — IMAGE RETRIEVAL AND FRONTEND COMPATIBILITY

The frontend must display images without needing to know which storage provider is being used.

Requirements:

- Existing Cloudinary images must continue working.
- New Cloudflare images must work.
- Mixed-provider image arrays must work.
- Preserve existing image URL response formats wherever possible.
- Avoid unnecessary frontend rewrites.
- Ensure existing pages, cards, galleries, and dashboards display images correctly.

If the frontend uses a centralized image component or utility, update it appropriately.

Do not introduce hardcoded Cloudinary or Cloudflare domains throughout the frontend.

# PHASE 8 — PROVIDER-AWARE IMAGE DELETION

Update every image deletion workflow.

Expected behavior:

If:

```js
image.provider === "cloudinary"
```

Delete using Cloudinary and its existing public ID.

If:

```js
image.provider === "cloudflare"
```

Delete using Cloudflare R2 and its object key.

Requirements:

- Never delete an image from the wrong provider.
- Handle missing provider metadata safely.
- Maintain compatibility with legacy image records.
- Handle failed deletions properly.
- Preserve existing entity deletion behavior.
- Avoid orphaned objects where possible.

When replacing an image:

1. Upload the replacement first.
2. Confirm the upload succeeded.
3. Update MongoDB.
4. Delete the old image from its original provider only after the database update is confirmed.

# PHASE 9 — SECURITY AND RELIABILITY

Implement appropriate protections:

- Validate MIME types and file extensions.
- Enforce file size limits.
- Keep all credentials server-side.
- Handle upload and deletion failures.
- Prevent accidental public exposure of private images if the application supports private images.
- Use unique object keys.
- Prevent unintended deletion of images.
- Avoid orphaned files.
- Keep error handling consistent with the existing backend.

Do not weaken existing security or validation rules.

# PHASE 10 — TESTING

Add or update tests for:

1. Cloudinary legacy image retrieval.
2. Cloudflare R2 uploads.
3. Cloudflare R2 image URLs.
4. Provider-aware deletion.
5. Mixed-provider image arrays.
6. Legacy string-based image records.
7. All existing upload endpoints.
8. Migration dry-run.
9. Migration idempotency.
10. Database update failures.
11. Upload failures.
12. Image replacement workflows.

Run:

- Existing test suite.
- Relevant integration tests.
- Type checking if applicable.
- Production build.

Do not claim that R2 integration has been fully tested against a real bucket if credentials are unavailable.

# PHASE 11 — DOCUMENTATION

Update project documentation.

Include:

- New storage architecture.
- Provider interface and responsibilities.
- Cloudflare R2 setup.
- Required environment variables.
- Upload workflow.
- Retrieval workflow.
- Deletion workflow.
- MongoDB schema changes.
- Actual migration procedure.
- Dry-run instructions.
- Backup and rollback instructions.
- Troubleshooting.

Provide environment variable examples without real secrets.

# PHASE 12 — FINAL ACCEPTANCE CRITERIA

The implementation is considered complete only when:

1. The existing Cloudinary images remain accessible.
2. Existing Cloudinary image records in the actual MongoDB database explicitly have `provider: "cloudinary"`.
3. Every new website image upload uses Cloudflare R2.
4. Every new image record explicitly has `provider: "cloudflare"`.
5. All image-bearing entities and upload endpoints are covered.
6. Both providers coexist within the same collections and entities.
7. Image retrieval works for both providers.
8. Image deletion targets the correct provider.
9. Existing frontend behavior remains intact.
10. The actual database migration has been executed and independently verified.
11. Migration is idempotent and has a working dry-run mode.
12. Existing tests and production build pass.

# EXECUTION RULES

- Work directly in the existing project.
- Inspect the architecture before modifying files.
- Implement the complete solution rather than only proposing it.
- Do not rewrite unrelated code.
- Do not remove Cloudinary support.
- Do not move or delete existing Cloudinary images.
- Do not invent database structures without inspecting the actual models.
- Do not claim a database migration succeeded unless it was actually executed and verified.
- Do not claim an R2 upload succeeded without real credentials and a real bucket.
- Do not expose secrets.
- Do not perform destructive production operations.
- Preserve existing application functionality.

If an operation requires credentials, permissions, or manual configuration that are unavailable, implement everything possible safely and list the remaining manual steps explicitly.

# FINAL DELIVERY REPORT

When finished, provide a detailed report with:

1. Architecture changes.
2. Files created and modified.
3. Mongoose models and collections updated.
4. All upload endpoints migrated to Cloudflare.
5. All deletion workflows updated.
6. Database migration execution status.
7. Actual database migration statistics.
8. Verification results.
9. Test and build results.
10. Missing credentials or manual configuration.
11. Any remaining issues.

Clearly distinguish between:

- Implemented and verified.
- Implemented but not verified.
- Not implemented.
- Requires manual action.

Final expected architecture:

OLD EXISTING IMAGES → Cloudinary → provider: "cloudinary"

ALL NEW IMAGE UPLOADS → Cloudflare R2 → provider: "cloudflare"

Both providers must work together transparently throughout the existing application.