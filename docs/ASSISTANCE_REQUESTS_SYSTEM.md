# نظام إدارة طلبات المساعدة والتحقق من ارتباطها بالمستفيدين (Elhaq Next — دعوة الحق)

هذا المستند يوثق التصميم والهندسة والضوابط الأمنية لنظام **طلبات المساعدة (`Assistance Requests`)** المدمج مع قاعدة بيانات ونظام تسجيل المستفيدين القائم في مشروع **دعوة الحق (`elhaq-next`)**.

---

## 1. تدقيق استمارة تسجيل المستفيد الحالية (Existing Beneficiary Registration Form Audit)

تم فحص الكود المصدري الفعلي لكل من:
- الواجهة الأمامية: [`BeneficiaryForm.tsx`](../src/app/admin/beneficiaries/components/BeneficiaryForm.tsx) و [`BeneficiaryDetailsView.tsx`](../src/app/admin/beneficiaries/components/BeneficiaryDetailsView.tsx)
- طبقة التطهير والتحويل: [`sanitizePayload.ts`](../src/lib/beneficiaries/sanitizePayload.ts) و [`utils.ts`](../src/app/admin/beneficiaries/utils.ts)
- نموذج قاعدة البيانات: [`Beneficiary.ts`](../src/lib/models/Beneficiary.ts)
- تدقيق فعلي لهيكل البيانات المصدّرة (`Beneficiaries_DB_Export.json` — `1,941` سجل مستفيد حقيقي): أظهر التدقيق وجود **105 سجل يبدأ الرقم القومي فيها بالصفر (`'0'`)**؛ ولذلك يتم تخزين ومعالجة ومطابقة جميع الأرقام القومية **كنصوص (`string`) فقط** دون تحويلها إلى أرقام أبداً.

---

## 2. جدول ربط حقول الرقم القومي والاسم الكامل (Complete National ID Field Mapping)

| الشخص (Person) | حقل الاستمارة (Form Field) | مصدر الاسم (Name Source) | مصدر الرقم القومي (National ID Source) | العلاقة وطريقة الربط | هل هو اختياري؟ | هل يدعم التعدد؟ |
|---|---|---|---|---|---|---|
| **المستفيد الأساسي** | `nationalId` / `name` | `beneficiaries.name` | `beneficiaries.nationalId` | المستفيد الرئيسي صاحب ملف الأسرة (`_id`) | مطلوب (`required`) | سجل واحد لكل فرع |
| **زوج / زوجة المستفيد** | `spouse.nationalId` / `spouse.name` | `beneficiaries.spouse.name` | `beneficiaries.spouse.nationalId` | كائن مدمج `SpouseSchema` داخل سجل المستفيد الأساسي (يظهر عند `maritalStatus === 'married'`) | اختياري | زوج/زوجة واحدة مدمجة |
| **الأبناء (الابن / الابنة)** | `children[i].nationalId` | `beneficiaries.children[i].name` | `beneficiaries.children[i].nationalId` **وكذلك الحقل التراثي** `beneficiaries.children[i].idNumber` | مصفوفة مستندات فرعية `ChildSchema` مدمجة داخل سجل المستفيد الأساسي | اختياري | نعم (عدد غير محدود من الأبناء) |
| **زوج / زوجة الابن المتزوج** | `children[i].spouse.nationalId` | `beneficiaries.children[i].spouse.name` | `beneficiaries.children[i].spouse.nationalId` | كائن `SpouseSchema` مدمج داخل عنصر الابن عندما تكون حالته `maritalStatus === 'married'` | اختياري | ابن متزوج لكل عنصر |
| **العلاقات العائلية المسجلة** | `relationships[i].relativeNationalId` | `beneficiaries.relationships[i].relativeName` | `beneficiaries.relationships[i].relativeNationalId` | مصفوفة `RelationshipSchema` مدمجة مع `relation` (`father`, `mother`, `son`, `daughter`, `brother`, `sister`, `spouse`, `grandfather`, `grandmother`, `other`) ومرجع `relative` اختياري إلى `Beneficiary._id` | اختياري | نعم (عدد غير محدود من الأقارب) |

---

## 3. خريطة العلاقات في قاعدة البيانات (Database Relationship Mapping)

- تخزن بيانات **الزوج/الزوجة** و**الأبناء** و**زوج/زوجة الابن** و**العلاقات العائلية** كمستندات فرعية مدمجة داخل مجموعة `beneficiaries`.
- أضيفت 5 فهارس متفرقة (`sparse`) غير تدميرية على مجموعة `beneficiaries` لتمكين البحث التام السريع بدون تكرار بيانات:
  - `spouse.nationalId`
  - `children.nationalId`
  - `children.idNumber`
  - `children.spouse.nationalId`
  - `relationships.relativeNationalId`
- أضيف سكربت الهجرة الآمن غير التدميري [`scripts/migrate-assistance-indexes.mjs`](../scripts/migrate-assistance-indexes.mjs) مع أوامر التراجع الموثقة.

---

## 4. هيكل بيانات طلبات المساعدة والمراجعة (Assistance Request Schema)

### 4.1 مجموعة `assistancerequests` (`src/lib/models/AssistanceRequest.ts`)
- **بيانات مقدم الطلب**: `fullName`, `nationalIdEncrypted` (AES-256-GCM), `nationalIdBlindIndex` (HMAC-SHA256 مفهرس), `nationalIdMasked`, `phone`, `whatsapp`, `address`, `familyMembersCount`, `maritalStatus`, `monthlyIncome`, `assistanceCategory`, `assistanceCategoryCustom` (النص الحر عند إضافة نوع مساعدة جديد غير موجود بالقائمة، ويُخزن التصنيف كـ `other`), `description`, `attachments`, `submittedByClerkId`.
- **نتيجة التحقق والربط**:
  - `verificationStatus`: `'matched_primary_beneficiary' | 'matched_spouse' | 'matched_child' | 'matched_other_dependent' | 'not_matched' | 'manual_review'`
  - `relationshipType`: `'primary_beneficiary' | 'beneficiary_spouse' | 'beneficiary_child' | 'other_dependent' | 'unknown'`
  - `beneficiary`: مرجع `ObjectId` إلى `Beneficiary` (ملف الأسرة الأساسي) + `beneficiarySnapshot` (`name`, `internalId`, `status`, `branchId`, `branchName`) لحفظ اسم الملف حتى في حال تغير الحالة لاحقاً.
  - `matchedPerson`: يميّز بين الشخص المطابق (`name`, `personType`, `subId`, `specificRelation`, `gender`, `relatedViaName`) وبين المستفيد الأساسي دون دمج الهويتين.
  - `verificationWarnings`: مصفوفة تحذيرات التحقق والتطابق.
  - `candidateMatches`: قائمة التطابقات المحتملة (بدون أرقام قومية صريحة) لتمكين المسؤول من المراجعة اليدوية عند الغموض.
  - `manualResolution`: توثيق القرار اليدوي الأخير للمسؤول (`resolvedByName`, `resolvedAt`, `decisionNote`).
- **سير العمل الإداري**: `status` (`new`, `under_review`, `reviewed`, `approved`, `rejected`, `completed`), `statusPriority` (`1` للجديد لضمان ظهوره أولاً), `assignedReviewerId`, `adminNotes`, `statusHistory` (غير قابل للتعديل), `branch`, `version` (للتحكم بالتزامن المتفائل Optimistic Concurrency).

### 4.2 مجموعة `assistanceauditlogs` (`src/lib/models/AssistanceAuditLog.ts`)
- سجل أمني غير قابل للتعديل (`timestamps: { createdAt: true, updatedAt: false }`) يسجل عمليات: `status_changed`, `note_added`, `national_id_revealed`, `manual_verification_resolved`, `verification_rerun`, `reviewer_assigned`.
- يتم تطهير كائن `details` تلقائياً عبر `sanitizeAuditDetails` في خطاف `pre("save")` لمنع تخزين أي رقم قومي صريح داخل السجل.

---

## 5. محرك التحقق وخوارزمية المطابقة (Verification Algorithm — `src/lib/assistance/verification.ts`)

1. التحقق من أن الرقم القومي المرسل هو نص صحيح (`string`) من أرقام ASCII مع الحفاظ التام على الأصفار البادئة (`"0..."`).
2. إجراء استعلام واحد مفهرس (`$or`) عبر المسارات الستة في `Beneficiary`: `nationalId`، `spouse.nationalId`، `children.nationalId`، `children.idNumber`، `children.spouse.nationalId`، `relationships.relativeNationalId`.
3. تنفيذ الدالة النقية `evaluateVerificationCandidates`:
   - عدم وجود أي تطابق ← `not_matched` / `unknown`.
   - دمج التكرار داخل نفس السجل فقط عندما يتطابق إدخال الزوج/الابن في القسم المدمج ومع قسم `relationships[]` بنفس الاسم والصفة بدون تعارض.
   - تطابق واحد نظيف ← تحديد `matched_primary_beneficiary` أو `matched_spouse` أو `matched_child` أو `matched_other_dependent` وربطه بملف الأسرة الأساسي وحفظ هوية الشخص المطابق.
   - تطابقان أو أكثر (عبر ملفات متعددة أو بصفات متعارضة)، أو نقص اسم الزوج/الابن المطابق، أو فقدان بيانات المستفيد الأساسي، أو حالة مستفيد `cancelled`، أو تعارض بيانات الأسرة (مثل وجود زوج لملف حالته `divorced`)، أو تعذر الاتصال بقاعدة البيانات ← **`manual_review`** مع حفظ جميع التطابقات المحتملة والتحذيرات المناسبة (`duplicate_national_id`, `conflicting_relationship_types`, `multiple_possible_matches`, `invalid_primary_beneficiary`, `incomplete_matched_person_data`, `inconsistent_family_relationship`, `beneficiary_inactive`, `verification_source_unavailable`) دون اختيار أي سجل عشوائياً.

---

## 6. التصميم الأمني وحماية الخصوصية (Security & Privacy Design)

- **استقلالية استجابة التقديم (`src/app/api/assistance-requests/route.ts`)**:
  - لا يكشف الرد أبداً عن وجود تطابق أو نوعه أو تحذيرات التحقق (`sanitizePublicSubmissionResponse` يرجع فقط `{ ok, submittedAt, message }`).
  - تطبيق حد أدنى لزمن الاستجابة (`250ms`) لمنع هجمات التوقيت (`timing side-channel`) بين الحالات المطابقة وغير المطابقة، مع Rate Limiting لكل IP وحماية من التكرار المتطابق خلال 5 دقائق.
- **التشفير والفهرسة العمياء (`src/lib/assistance/crypto.ts`)**:
  - اشتقاق مفتاحين مستقلين عبر **HKDF-SHA256** من `ASSISTANCE_NATIONAL_ID_SECRET` (أو `CLERK_SECRET_KEY` عند غيابه، دون أي مفتاح ثابت في الكود).
  - تشفير الرقم القومي الكامل بـ **AES-256-GCM** (`nationalIdEncrypted`).
  - فهرسة مطابقة تامة بـ **HMAC-SHA256 بمفتاح سري** (`nationalIdBlindIndex`) بدلاً من تجزئة غير مملحة.
  - قناع افتراضي في جميع قوائم الإدارة وشاشات التفاصيل (`**********0744`).
- **الكشف والتمرير الآمن**:
  - البحث بالرقم القومي في لوحة المسؤول يتم حصراً عبر جسم `POST /api/admin/assistance-requests/query` حتى لا يظهر الرقم القومي في روابط URL أو سجلات المتصفح.
  - كشف الرقم القومي الكامل يتم حصراً عبر `POST /api/admin/assistance-requests/[id]/reveal-national-id` مع تسجيل الحدث في `AssistanceAuditLog` وترويسة `Cache-Control: no-store`.
- **عزل الصلاحيات ومنع الثغرات**:
  - طبقة حماية Clerk middleware تشمل `/admin(.*)` و `/api/admin(.*)` و `/assistance-request(.*)` و `/api/assistance-requests(.*)`.
  - الدالة `evaluateAssistanceSubmitAccess` تتيح الوصول وتقديم الطلبات عبر `استبيان طلب مساعدة` (`/assistance-request` و `/api/assistance-requests`) لأي مستخدم مسجل الدخول بغض النظر عن دوره (`user`, `member`, `admin`, `superadmin`) وتمنع الزوار فقط (`401`). كما يتيح `/profile` (`PATCH /api/users`) للمستخدم العادي تحديد فرعه بحيث يتوجه طلبه والتحقق من المستفيدين حصراً لهذا الفرع فقط.
  - الدالة `evaluateAssistanceReadAccess` تمنح صلاحية **العرض فقط** لطلبات المساعدة في نفس الفرع لدور **`member` (`عضو`)** وللمسؤولين (`admin` نفس الفرع و`superadmin` جميع الفروع أو فرع محدد)، وتمنع `user` (`403`) وفروعاً أخرى (`403` IDOR).
  - الدالة `evaluateAssistanceAdminAccess` تقصر جميع عمليات التعديل والحذف وحسم التحقق وإضافة الملاحظات وتعيين المراجعين حصراً على `admin` (نفس الفرع) و`superadmin`، وتمنع تماماً غير المسجلين (`401`)، وذوي دور `user` (`403`)، وذوي دور **`member`** (`403`)، ومسؤولي الفروع الأخرى (`403` IDOR).
  - **عزل الإشعارات العامة**: نظراً لأن `NotificationBell` يعرض مجموعة `Notification` لدور `member`، لا تُرسل أي أحداث تخص طلبات المساعدة إلى `Notification` بتاتاً.

---

## 7. تفسير سجل المساعدات السابقة (Assistance History — `src/lib/assistance/history.ts`)

| مصدر السجل | مستوى الربط المتاح في قاعدة البيانات | كيفية العرض لحالات **الزوج/الزوجة أو الأبناء/الأقارب** |
|---|---|---|
| **مصروفات الخزينة (`TreasuryTransaction`)** | معرف `Beneficiary._id` فقط (لا يحدد أي فرد داخل الأسرة استلم) | يُصنّف في القسم الثاني ويعرض صراحة بشارة **`مساعدة على مستوى الأسرة`** |
| **المبادرات الخيرية (`Initiative`)** | معرف `Beneficiary._id` فقط | يُصنّف في القسم الثاني ويعرض صراحة بشارة **`مساعدة على مستوى الأسرة`** |
| **حالات تيسير الزواج (`MarriageCase`)** | قد يحتوي `nationalId` اختياري للفرد أو مرجع `beneficiary` فقط | يُعرض في القسم الفردي **فقط** إذا تطابق `mc.nationalId` تطابقاً تاماً مع الرقم القومي لمقدم الطلب (أو `self` للمستفيد الأساسي)؛ وغير ذلك يُصنّف كـ **`مساعدة على مستوى الأسرة`** دون تخمين بالاسم |
| **القروض الحسنة (`Loan`)** | يحتوي `nationalId` اختياري | يُعرض في القسم الفردي **فقط** عند تطابق `loan.nationalId` مع الرقم القومي لمقدم الطلب؛ وقروض المستفيد الأساسي تُعرض تحت **`مساعدة على مستوى الأسرة`** |
| **طلبات مساعدة سابقة (`AssistanceRequest`)** | `nationalIdBlindIndex` + `beneficiary` | طلبات نفس الرقم القومي في القسم الفردي؛ وطلبات أفراد آخرين بنفس الملف في قسم الأسرة |
| **زكاة الأرز/المحاصيل (`ZkDistribution`)** | كيان مستقل `ZkBeneficiary` بالاسم والهاتف بدون رقم قومي أو مرجع `Beneficiary` | **لا يُربط تلقائياً** تجنباً للتشابه الخاطئ بالأسماء، وتُعرض هذه الملاحظة للمسؤول داخل قسم قيود البيانات التاريخية |

---

## 8. سير العمل الإداري (Admin Workflow)

- **الصفحات والواجهات**:
  - واجهة تقديم الطلبات المخصصة للمستخدمين العاديين فقط (`role === "user"`): `/assistance-request` (تظهر في الشريط العلوي والصفحة الرئيسية للمستخدمين العاديين فقط بعنوان **`استبيان طلب مساعدة`**، مع تحديد الفرع من `/profile` أو النموذج وحفظه تلقائياً لعزل طلبات كل فرع وتحقق المستفيدين داخله).
  - لوحة قائمة طلبات المساعدة للمسؤولين والأعضاء: `/admin/assistance-requests` (تظهر للأعضاء بصلاحية عرض فقط لطلبات فرعهم مع شارة **`وضع العرض فقط (عضو)`** بدون أزرار حذف، وللمسؤولين والسوبر ادمن بصلاحية إدارة كاملة وزر **`حذف`** بجانب **`مراجعة الطلب`** مع نافذة تأكيد عبر `DELETE /api/admin/assistance-requests/[id]`).
  - صفحة مراجعة تفاصيل الطلب: `/admin/assistance-requests/[id]` مقسمة للأقسام: (أ) بيانات مقدم الطلب والقناع/الكشف، (ب) نتيجة التحقق وربط الفرد بالأساسي، (ج) السياق العائلي، (د) التحذيرات والمراجعة اليدوية، (هـ) سجل المساعدات السابقة (الفردية مقابل الأسرية)، (و) تعيين المراجع، الملاحظات الداخلية غير المرئية للمستخدم، سجل تغييرات الحالة غير القابل للتعديل، وسجل المراجعة الأمنية؛ وتُخفى جميع أزرار التعديل والمراجعة اليدوية وإضافة الملاحظات وتغيير الحالة والحذف النهائي عن دور **`member`** وتقتصر على **`admin`** (بنفس الفرع) و**`superadmin`**.
- التحديثات تتحقق من `version` لمنع التضارب (`409 Conflict` عند التعديل المتزامن من مسؤولين).

---

## 9. تغطية الاختبارات والنتائج (Automated Tests)

تم بناء 4 مجموعات اختبارات آلية باستخدام `node:test` + `node:assert/strict` في `src/lib/assistance/__tests__/`:
1. `verification.test.ts`: **15 اختباراً** تغطي جميع سيناريوهات المرحلة 10.1 (المستفيد الأساسي، الزوج والزوجة، الأبناء في الحقلين `nationalId` و`idNumber`، زوجة/زوج الابن، `relationships[]`، عدم التطابق، التطابق المتعدد، تعارض العلاقات، نقص الاسم، فقدان سجل الأساسي، تعارض الحالة الاجتماعية، المستفيد الملغى، تعذر قاعدة البيانات، الأصفار البادئة، المطابقة التامة غير الضبابية).
2. `privacy-and-auth.test.ts`: **9 اختبارات** تغطي تشفير AES-256-GCM مع الأصفار البادئة ومنع التلاعب، الفهرسة العمياء HMAC-SHA256، القناع، خلو استجابة التقديم من أي تسريب، منع التعديل والحذف عن `member` و`user` والفروع الأخرى (`401`/`403` IDOR)، منح صلاحية العرض فقط لدور `member` على فرعه (`403` للفروع الأخرى وللمستخدم `user`)، قصر الاستبيان حصراً على دور **`user`** (`401`/`403` لـ `member`/`admin`/`superadmin`)، التحقق من روابط مرفقات Cloudinary، ومنع تسجيل الرقم القومي في `AssistanceAuditLog`.
3. `history.test.ts`: **3 اختبارات** تغطي سجل المستفيد الأساسي، الفصل الصارم لمساعدات الزوج/الزوجة والأبناء الفردية عن **`مساعدة على مستوى الأسرة`**.
4. `workflow.test.ts`: **5 اختبارات** تغطي الحالة الافتراضية، أولوية الترتيب، سجل تغييرات الحالة غير القابل للتعديل والتحكم المتفائل `409`، مرشحات الاستعلام بالفهرس الأعمى، ومنع التكرار المتزامن خلال 5 دقائق مقابل تحذير الطلب المفتوح.

---

## 10. القيود المعروفة والتوصيات المستقبلية (Known Limitations & Recommendations)

1. **مفتاح التشفير المستقل في الإنتاج**: يُنصح بإضافة متغير بيئة مخصص `ASSISTANCE_NATIONAL_ID_SECRET` (32+ حرفاً عشوائياً) في بيئة الإنتاج بدلاً من الاعتماد الاحتياطي على `CLERK_SECRET_KEY` لتسهيل تدوير المفاتيح بشكل مستقل.
2. **أرقام الهويات القومية للزوج والأبناء في السجلات التاريخية**: أظهر تدقيق `Beneficiaries_DB_Export.json` أن كثيراً من السجلات القديمة المستوردة لا تحتوي على `spouse.nationalId` أو `children`; سيطابق النظام أي سجل يحتوي عليها فور إدخالها، وتساعد أداة **"إعادة الفحص التلقائي"** المسؤولين بعد استكمال ملفات الأسر.
3. **التكامل المستقبلي مع مخزن زكاة الأرز (`zk_beneficiaries`)**: إضافة حقل مرجعي اختياري `beneficiaryId` في `IZkBeneficiary` مستقبلاً سيتيح عرض توزيعات زكاة المحاصيل في سجل المساعدات الأسرية بدقة دون اعتماد على مطابقة الأسماء.
4. **تنفيذ هجرة الفهارس على قاعدة البيانات الفعلية**: تشغيل `node scripts/migrate-assistance-indexes.mjs` عند النشر لضمان إنشاء الفهارس على مجموعة `beneficiaries` والمجموعات الجديدة.
