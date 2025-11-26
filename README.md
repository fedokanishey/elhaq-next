# دعوة الحق - نسخة Next.js

نسخة محدثة من تطبيق دعوة الحق مع Next.js 16 و Clerk و MongoDB و Inngest

## المزايا الرئيسية

- ✅ **Next.js 16** مع App Router و TypeScript
- ✅ **Clerk Auth** لإدارة المصادقة والجلسات
- ✅ **MongoDB** قاعدة البيانات الرئيسية
- ✅ **Inngest** لربط Clerk و MongoDB تلقائياً
- ✅ **Tailwind CSS** للتصميم
- ✅ **RTL Support** دعم العربية والاتجاه من اليمين لليسار
- ✅ **Protected Routes** مع Middleware

## الإعداد السريع

### 1. التثبيت

```bash
npm install
```

### 2. متغيرات البيئة (.env.local)

```env
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=your_key
CLERK_SECRET_KEY=your_secret
MONGODB_URI=mongodb://localhost:27017/elhaq_db
INNGEST_EVENT_KEY=your_key
```

### 3. التشغيل

```bash
npm run dev
```

اذهب إلى: `http://localhost:3000`

## البنية

- `src/app` - الصفحات والـ API routes
- `src/lib` - MongoDB و utilities
- `src/inngest` - Inngest functions

## الأوامر

```bash
npm run dev     # تشغيل
npm run build   # بناء للإنتاج
npm run lint    # فحص الأخطاء
```

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
