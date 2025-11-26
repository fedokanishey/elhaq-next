# دليل إعداد dعوة الحق - Next.js Edition

## الخطوات الأساسية

### 1️⃣ إنشاء حساب Clerk

1. اذهب إلى [clerk.com](https://clerk.com)
2. أنشئ تطبيق جديد
3. انسخ:
   - `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`
   - `CLERK_SECRET_KEY`

### 2️⃣ إعداد MongoDB

**الخيار 1: MongoDB محلي**
```bash
# تحميل MongoDB Community
# ثم تشغيله
mongod
```

**الخيار 2: MongoDB Atlas (سحابي)**
1. اذهب إلى [mongodb.com/cloud/atlas](https://mongodb.com/cloud/atlas)
2. أنشئ cluster جديد
3. انسخ Connection String

### 3️⃣ إعداد Inngest (اختياري)

1. اذهب إلى [inngest.com](https://inngest.com)
2. أنشئ تطبيق جديد
3. انسخ المفاتيح

### 4️⃣ ملف .env.local

```env
# Clerk
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_xxxxx
CLERK_SECRET_KEY=sk_test_xxxxx
NEXT_PUBLIC_CLERK_SIGN_IN_URL=/sign-in
NEXT_PUBLIC_CLERK_SIGN_UP_URL=/sign-up
NEXT_PUBLIC_CLERK_AFTER_SIGN_IN_URL=/
NEXT_PUBLIC_CLERK_AFTER_SIGN_UP_URL=/

# MongoDB
MONGODB_URI=mongodb://localhost:27017/elhaq_db
# أو
# MONGODB_URI=mongodb+srv://user:pass@cluster.mongodb.net/elhaq_db

# Inngest (اختياري)
INNGEST_EVENT_KEY=your_event_key
INNGEST_SIGNING_KEY=your_signing_key

# App
NEXT_PUBLIC_APP_NAME=دعوة الحق
NODE_ENV=development
```

### 5️⃣ التشغيل

```bash
# 1. التثبيت
npm install

# 2. تشغيل dev server
npm run dev

# 3. اذهب إلى http://localhost:3000
```

## الاختبار

### اختبر الدخول
1. اضغط "إنشاء حساب" أو "تسجيل دخول"
2. ملأ البيانات
3. يجب أن ترى تحية مخصصة
4. تحقق من أن المستخدم محفوظ في MongoDB

### اختبر API
```bash
# بعد تسجيل الدخول
curl http://localhost:3000/api/users
```

## استكشاف الأخطاء

### MongoDB لا تعمل
```bash
# تأكد من التشغيل
mongosh

# أو إذا كنت تستخدم Atlas، تحقق من Connection String
```

### Clerk لا يعمل
- تأكد من المفاتيح في .env.local
- تحقق من Clerk Dashboard

### Inngest لا يعمل
- اذهب إلى http://localhost:3000/api/inngest (يجب أن ترى صفحة Inngest)
- جرب: `curl http://localhost:3000/api/inngest`

## الخطوات التالية

1. ترحيل باقي المكونات من Vite
2. إضافة نماذج البيانات (Beneficiary, Initiative, etc)
3. إعداد API routes كاملة
4. النشر على Vercel

## المراجع

- [Clerk Documentation](https://clerk.com/docs)
- [MongoDB Mongoose](https://mongoosejs.com)
- [Inngest Documentation](https://www.inngest.com/docs)
- [Next.js Documentation](https://nextjs.org/docs)
