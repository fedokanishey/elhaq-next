# دليل الإعدادات والتشغيل - دعوة الحق

## التشغيل السريع

```bash
# 1. التأكد من أن الخادم يعمل
# الموقع متاح على: http://localhost:3000

# 2. إذا توقف الخادم:
Set-Location D:\Projects\elhaq-next
npm run dev
```

## إعدادات Cloudinary (تحميل الصور)

### الخطوة 1: إنشاء حساب Cloudinary
1. اذهب إلى [cloudinary.com](https://cloudinary.com)
2. أنشئ حساب جديد (مجاني)
3. اذهب إلى Dashboard

### الخطوة 2: الحصول على بيانات الاتصال

في Cloudinary Dashboard:
- **Cloud Name**: ستجده في الأعلى
- **API Key**: اذهب إلى Settings > API Keys

### الخطوة 3: إنشاء Upload Preset

في Cloudinary Dashboard:
1. اذهب إلى Upload > Upload Presets
2. انقر "Create upload preset"
3. الاسم: `elhaq_beneficiaries`
4. Mode: **Unsigned** (مهم!)
5. Save

### الخطوة 4: تحديث .env.local

```env
NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME=your_cloud_name
```

## البيانات والمتطلبات

### تخطيط المستفيدين
- **الاسم**: نص مطلوب
- **رقم الهوية**: فريد، مطلوب
- **الهاتف**: مطلوب
- **البريد**: اختياري
- **العنوان**: مطلوب
- **عدد الأفراد**: رقم
- **الحالة الاجتماعية**: single/married/divorced/widowed
- **الدخل**: اختياري
- **الأولوية**: 1-10
- **الصور**: محلية على Cloudinary
- **الأطفال**: قائمة (اسم، تاريخ ميلاد، الجنس)

### قاعدة البيانات
- **MongoDB**: بالفعل متصل
- **Mongoose Models**: 
  - User
  - Beneficiary

## الصفحات والمسارات

### عام
- `/` - الرئيسية
- `/sign-in` - تسجيل الدخول
- `/sign-up` - إنشاء حساب
- `/beneficiaries` - عرض المستفيدين (قراءة فقط للمستخدمين العاديين)
- `/profile` - الملف الشخصي

### للمسؤول (admin)
- `/admin/dashboard` - لوحة التحكم
- `/admin/beneficiaries` - إدارة المستفيدين
- `/admin/beneficiaries/add` - إضافة مستفيد جديد
- `/admin/beneficiaries/:id` - تعديل مستفيد
- `/admin/beneficiaries/:id/view` - عرض تفاصيل

## نظام الأدوار (Roles)

### إعداد Admin في Clerk

1. اذهب إلى Clerk Dashboard
2. اختر المستخدم (في مثالك)
3. اذهب إلى "Unsafe Metadata"
4. أضف:
```json
{
  "role": "admin"
}
```

### التحقق من الدور
- في التطبيق: `user?.publicMetadata?.role === "admin"`
- المسؤولين فقط يستطيعون:
  - إضافة مستفيدين
  - تعديل البيانات
  - حذف المستفيدين
  - الوصول إلى /admin/

## API Routes

### GET /api/beneficiaries
جلب جميع المستفيدين (مع pagination)

### POST /api/beneficiaries
إضافة مستفيد جديد (يتطلب Clerk authentication)

```json
{
  "name": "أحمد",
  "nationalId": "123456",
  "phone": "0501234567",
  "address": "الرياض",
  "familyMembers": 3,
  "maritalStatus": "married",
  "priority": 8,
  "profileImage": "https://cloudinary.../image.jpg",
  "children": [
    { "name": "محمد" },
    { "name": "فاطمة" }
  ]
}
```

## استكشاف الأخطاء

### الصور لا تحمّل
- تأكد من `NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME`
- تحقق من Upload Preset: `elhaq_beneficiaries`
- تأكد من أن Mode = Unsigned

### 404 على الصفحات
- تأكد من تسجيل الدخول
- تحقق من الدور (admin/user)

### MongoDB لا يتصل
- تحقق من `MONGODB_URI` في .env.local
- تأكد من أن قاعدة البيانات موجودة

## التطوير المستقبلي

- [ ] صفحة تعديل المستفيد
- [ ] حذف المستفيد
- [ ] البحث والتصفية
- [ ] التقارير والإحصائيات
- [ ] إدارة المستخدمين والأدوار
- [ ] المبادرات والمشاريع
