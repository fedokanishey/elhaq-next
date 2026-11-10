import mongoose, { Schema, Document, Model } from "mongoose";

// --- Base Interface for Common Fields ---
export interface IZkBase {
  clientId?: string;
  createdBy?: string;
  createdByName?: string;
  updatedBy?: string;
  updatedByName?: string;
  version: number;
  deletedAt?: Date | null;
  deletedBy?: string | null;
  deletedByName?: string | null;
}

// --- 1. Settings ---
export interface IZkSettings extends Document {
  season: string; // e.g., "2026"
  opening_barley_kg: number;
  opening_rice_kg: number;
  min_barley_kg: number;
  min_rice_kg: number;
  bag_weight_presets: number[];
  org_name: string;
  org_logo: string;
  updatedAt: Date;
}

const ZkSettingsSchema = new Schema<IZkSettings>(
  {
    season: { type: String, default: "2026", trim: true },
    opening_barley_kg: { type: Number, default: 0, min: 0 },
    opening_rice_kg: { type: Number, default: 0, min: 0 },
    min_barley_kg: { type: Number, default: 500, min: 0 },
    min_rice_kg: { type: Number, default: 500, min: 0 },
    bag_weight_presets: { type: [Number], default: [25, 50, 10, 5] },
    org_name: { type: String, default: "دعوة الحق الزرقا", trim: true },
    org_logo: { type: String, default: "/logos/شعار.png", trim: true },
  },
  { timestamps: true, collection: "zk_settings" }
);

// --- 2. Warehouse / Zakat Donors (المتبرعون الخاصون بالمخزن وزكاة المحصول) ---
export interface IZkDonor extends Document, IZkBase {
  name: string;
  nameNormalized: string;
  phone?: string;
  land_description?: string;
  season: string;
  notes?: string;
  createdAt: Date;
  updatedAt: Date;
}

const ZkDonorSchema = new Schema<IZkDonor>(
  {
    name: { type: String, required: true, trim: true, index: true },
    nameNormalized: { type: String, required: true, trim: true, index: true },
    phone: { type: String, trim: true, default: "" },
    land_description: { type: String, trim: true, default: "" },
    season: { type: String, default: "2026", index: true },
    notes: { type: String, trim: true, default: "" },
    clientId: { type: String, sparse: true, index: true },
    createdBy: { type: String, default: "" },
    createdByName: { type: String, default: "" },
    updatedBy: { type: String, default: "" },
    updatedByName: { type: String, default: "" },
    version: { type: Number, default: 1 },
    deletedAt: { type: Date, default: null, index: true },
    deletedBy: { type: String, default: null },
    deletedByName: { type: String, default: null },
  },
  { timestamps: true, collection: "zk_donors" }
);

// --- 3. Receipts (الاستلامات والتوريدات من المتبرعين أو عمليات الشراء والبيع) ---
export type ZkOperationType = "donation" | "purchase" | "sale";
export type ZkItemType = "barley" | "rice" | "other" | "cash" | "bran";

export interface IZkReceipt extends Document, IZkBase {
  no: string; // e.g. "00001"
  operation_type?: ZkOperationType; // "donation" | "purchase" | "sale"
  donor_id?: mongoose.Types.ObjectId | null;
  donor_name: string;
  date: Date;
  season: string;
  item: ZkItemType; // barley | rice | other | cash | bran
  item_name?: string; // for "other" like "سكر" or custom label
  bags: number;
  bag_kg: number;
  quantity: number; // kg for barley/rice/bran, unit count for other, amount for cash
  unit: string; // "كجم" | "جنيه" | "شيكارة" | "علبة"
  amount?: number; // for cash donation, purchase cost, or sale revenue
  purpose?: string; // for cash e.g. "شراء أرز"
  payment_method?: string; // "نقدًا" | "تحويل" | "شيك"
  store_label: string; // "مخزن الشعير" | "مخزن الأرز" | "—"
  notes?: string;
  createdAt: Date;
  updatedAt: Date;
}

const ZkReceiptSchema = new Schema<IZkReceipt>(
  {
    no: { type: String, required: true, index: true },
    operation_type: { 
      type: String, 
      enum: ["donation", "purchase", "sale"], 
      default: "donation", 
      index: true 
    },
    donor_id: { type: Schema.Types.ObjectId, ref: "ZkDonor", required: false, default: null, index: true },
    donor_name: { type: String, required: true, trim: true },
    date: { type: Date, required: true, default: Date.now, index: true },
    season: { type: String, required: true, default: "2026", index: true },
    item: { 
      type: String, 
      enum: ["barley", "rice", "other", "cash", "bran"], 
      default: "barley", 
      index: true 
    },
    item_name: { type: String, trim: true, default: "" },
    bags: { type: Number, default: 0, min: 0 },
    bag_kg: { type: Number, default: 0, min: 0 },
    quantity: { type: Number, required: true, default: 0 },
    unit: { type: String, default: "كجم", trim: true },
    amount: { type: Number, default: 0, min: 0 },
    purpose: { type: String, default: "شراء أرز", trim: true },
    payment_method: { type: String, default: "نقدًا", trim: true },
    store_label: { type: String, default: "مخزن الشعير", trim: true },
    notes: { type: String, trim: true, default: "" },
    clientId: { type: String, sparse: true, index: true },
    createdBy: { type: String, default: "" },
    createdByName: { type: String, default: "" },
    updatedBy: { type: String, default: "" },
    updatedByName: { type: String, default: "" },
    version: { type: Number, default: 1 },
    deletedAt: { type: Date, default: null, index: true },
    deletedBy: { type: String, default: null },
    deletedByName: { type: String, default: null },
  },
  { timestamps: true, collection: "zk_receipts" }
);

// --- 4. Milling (عمليات التبييض) + Mill Allocs ---
export interface IZkMillAlloc {
  donor_id?: mongoose.Types.ObjectId | null;
  donor_name: string;
  kg: number;
}

export interface IZkMillCosts {
  millCost: number;
  loadCost: number;
  transportCost: number;
  unloadCost: number;
  labor: number;
  extra: number;
}

export interface IZkMill extends Document, IZkBase {
  no: string;
  date: Date;
  place: string; // المضرب / جهة التبييض
  bags: number;
  in_kg: number; // sum of allocations (barley entered)
  rice_kg: number; // white rice output
  bran_kg: number; // ردة
  waste_kg: number; // فاقد
  other_kg: number; // ناتج إضافي
  season: string;
  notes?: string;
  allocs: IZkMillAlloc[];
  costs: IZkMillCosts;
  createdAt: Date;
  updatedAt: Date;
}

const ZkMillAllocSchema = new Schema<IZkMillAlloc>(
  {
    donor_id: { type: Schema.Types.ObjectId, ref: "ZkDonor", required: false, default: null },
    donor_name: { type: String, required: true },
    kg: { type: Number, required: true, min: 0.1 },
  },
  { _id: false }
);

const ZkMillCostsSchema = new Schema<IZkMillCosts>(
  {
    millCost: { type: Number, default: 0, min: 0 },
    loadCost: { type: Number, default: 0, min: 0 },
    transportCost: { type: Number, default: 0, min: 0 },
    unloadCost: { type: Number, default: 0, min: 0 },
    labor: { type: Number, default: 0, min: 0 },
    extra: { type: Number, default: 0, min: 0 },
  },
  { _id: false }
);

const ZkMillSchema = new Schema<IZkMill>(
  {
    no: { type: String, required: true, index: true },
    date: { type: Date, required: true, default: Date.now, index: true },
    place: { type: String, required: true, trim: true },
    bags: { type: Number, default: 0, min: 0 },
    in_kg: { type: Number, required: true, min: 0 },
    rice_kg: { type: Number, required: true, default: 0, min: 0 },
    bran_kg: { type: Number, default: 0, min: 0 },
    waste_kg: { type: Number, default: 0, min: 0 },
    other_kg: { type: Number, default: 0, min: 0 },
    season: { type: String, required: true, default: "2026", index: true },
    notes: { type: String, trim: true, default: "" },
    allocs: { type: [ZkMillAllocSchema], default: [] },
    costs: { type: ZkMillCostsSchema, default: () => ({}) },
    clientId: { type: String, sparse: true, index: true },
    createdBy: { type: String, default: "" },
    createdByName: { type: String, default: "" },
    updatedBy: { type: String, default: "" },
    updatedByName: { type: String, default: "" },
    version: { type: Number, default: 1 },
    deletedAt: { type: Date, default: null, index: true },
    deletedBy: { type: String, default: null },
    deletedByName: { type: String, default: null },
  },
  { timestamps: true, collection: "zk_mills" }
);

// --- 5. Expenses (المصروفات والعمليات التشغيلية) ---
export interface IZkExpense extends Document, IZkBase {
  date: Date;
  type: string; // "تحميل" | "تنزيل" | "نقل" | "تبييض" | "عمالة" | "سيارات" | "تخزين" | "تعبئة" | "أخرى"
  amount: number;
  qty: number;
  unit: string;
  party?: string;
  car_driver?: string;
  payment_method?: string;
  ref_text?: string;
  mill_id?: mongoose.Types.ObjectId | null;
  auto: boolean;
  auto_key?: string; // exp_<millId>_<costField>
  season: string;
  notes?: string;
  createdAt: Date;
  updatedAt: Date;
}

const ZkExpenseSchema = new Schema<IZkExpense>(
  {
    date: { type: Date, required: true, default: Date.now, index: true },
    type: { type: String, required: true, trim: true, index: true },
    amount: { type: Number, required: true, min: 0 },
    qty: { type: Number, default: 1, min: 0 },
    unit: { type: String, default: "شيكارة", trim: true },
    party: { type: String, trim: true, default: "" },
    car_driver: { type: String, trim: true, default: "" },
    payment_method: { type: String, default: "نقدًا", trim: true },
    ref_text: { type: String, trim: true, default: "" },
    mill_id: { type: Schema.Types.ObjectId, ref: "ZkMill", default: null, index: true },
    auto: { type: Boolean, default: false },
    auto_key: { type: String, sparse: true, index: true },
    season: { type: String, default: "2026", index: true },
    notes: { type: String, trim: true, default: "" },
    clientId: { type: String, sparse: true, index: true },
    createdBy: { type: String, default: "" },
    createdByName: { type: String, default: "" },
    updatedBy: { type: String, default: "" },
    updatedByName: { type: String, default: "" },
    version: { type: Number, default: 1 },
    deletedAt: { type: Date, default: null, index: true },
    deletedBy: { type: String, default: null },
    deletedByName: { type: String, default: null },
  },
  { timestamps: true, collection: "zk_expenses" }
);

// --- 6. Beneficiaries (المستفيدون) ---
export interface IZkBeneficiary extends Document, IZkBase {
  name: string;
  nameNormalized: string;
  phone?: string;
  area?: string; // العنوان / المنطقة
  family_size?: number;
  extra?: string;
  notes?: string;
  createdAt: Date;
  updatedAt: Date;
}

const ZkBeneficiarySchema = new Schema<IZkBeneficiary>(
  {
    name: { type: String, required: true, trim: true, index: true },
    nameNormalized: { type: String, required: true, trim: true, index: true },
    phone: { type: String, trim: true, default: "" },
    area: { type: String, trim: true, default: "" },
    family_size: { type: Number, default: 1, min: 1 },
    extra: { type: String, trim: true, default: "" },
    notes: { type: String, trim: true, default: "" },
    clientId: { type: String, sparse: true, index: true },
    createdBy: { type: String, default: "" },
    createdByName: { type: String, default: "" },
    updatedBy: { type: String, default: "" },
    updatedByName: { type: String, default: "" },
    version: { type: Number, default: 1 },
    deletedAt: { type: Date, default: null, index: true },
    deletedBy: { type: String, default: null },
    deletedByName: { type: String, default: null },
  },
  { timestamps: true, collection: "zk_beneficiaries" }
);

// --- 7. Distributions (التوزيعات) ---
export interface IZkDistribution extends Document, IZkBase {
  no: string;
  date: Date;
  beneficiary_id: mongoose.Types.ObjectId;
  beneficiary_name: string;
  place?: string;
  season: string;
  unit: "كجم" | "شيكارة";
  entered_qty: number;
  bags: number;
  bag_kg: number;
  quantity_kg: number; // actual deducted kg
  override: boolean;
  notes?: string;
  createdAt: Date;
  updatedAt: Date;
}

const ZkDistributionSchema = new Schema<IZkDistribution>(
  {
    no: { type: String, required: true, index: true },
    date: { type: Date, required: true, default: Date.now, index: true },
    beneficiary_id: { type: Schema.Types.ObjectId, ref: "ZkBeneficiary", required: true, index: true },
    beneficiary_name: { type: String, required: true, trim: true },
    place: { type: String, trim: true, default: "" },
    season: { type: String, required: true, default: "2026", index: true },
    unit: { type: String, enum: ["كجم", "شيكارة"], default: "كجم" },
    entered_qty: { type: Number, required: true, min: 0.1 },
    bags: { type: Number, default: 0, min: 0 },
    bag_kg: { type: Number, default: 0, min: 0 },
    quantity_kg: { type: Number, required: true, min: 0.1 },
    override: { type: Boolean, default: false },
    notes: { type: String, trim: true, default: "" },
    clientId: { type: String, sparse: true, index: true },
    createdBy: { type: String, default: "" },
    createdByName: { type: String, default: "" },
    updatedBy: { type: String, default: "" },
    updatedByName: { type: String, default: "" },
    version: { type: Number, default: 1 },
    deletedAt: { type: Date, default: null, index: true },
    deletedBy: { type: String, default: null },
    deletedByName: { type: String, default: null },
  },
  { timestamps: true, collection: "zk_distributions" }
);

// --- 8. Warehouse Adjustments (تسويات المخزنين) ---
export interface IZkAdjustment extends Document, IZkBase {
  store: "barley" | "rice";
  date: Date;
  kg: number; // positive = increase, negative = decrease, != 0
  reason: string;
  season: string;
  notes?: string;
  createdAt: Date;
  updatedAt: Date;
}

const ZkAdjustmentSchema = new Schema<IZkAdjustment>(
  {
    store: { type: String, enum: ["barley", "rice"], required: true, index: true },
    date: { type: Date, required: true, default: Date.now, index: true },
    kg: { type: Number, required: true },
    reason: { type: String, required: true, trim: true },
    season: { type: String, required: true, default: "2026", index: true },
    notes: { type: String, trim: true, default: "" },
    clientId: { type: String, sparse: true, index: true },
    createdBy: { type: String, default: "" },
    createdByName: { type: String, default: "" },
    updatedBy: { type: String, default: "" },
    updatedByName: { type: String, default: "" },
    version: { type: Number, default: 1 },
    deletedAt: { type: Date, default: null, index: true },
    deletedBy: { type: String, default: null },
    deletedByName: { type: String, default: null },
  },
  { timestamps: true, collection: "zk_adjustments" }
);

// --- 9. Audit Log (سجل المراجعة الصارم) ---
export interface IZkAuditDiff {
  field: string;
  label: string;
  before: any;
  after: any;
}

export interface IZkAudit extends Document {
  ts: Date;
  user_id?: string;
  user_name?: string;
  action: "إضافة" | "تعديل" | "حذف" | "استيراد" | "ترقيم" | "استعادة" | "تسوية";
  entity: "متبرع" | "استلام" | "تبييض" | "مصروف" | "مستفيد" | "توزيع" | "تسوية" | "إعدادات";
  entity_id: string;
  before?: any;
  after?: any;
  diff?: IZkAuditDiff[];
  override?: boolean;
  notes?: string;
}

const ZkAuditSchema = new Schema<IZkAudit>(
  {
    ts: { type: Date, default: Date.now, index: true },
    user_id: { type: String, default: "", index: true },
    user_name: { type: String, default: "" },
    action: { 
      type: String, 
      enum: ["إضافة", "تعديل", "حذف", "استيراد", "ترقيم", "استعادة", "تسوية"], 
      required: true, 
      index: true 
    },
    entity: { 
      type: String, 
      enum: ["متبرع", "استلام", "تبييض", "مصروف", "مستفيد", "توزيع", "تسوية", "إعدادات"], 
      required: true, 
      index: true 
    },
    entity_id: { type: String, required: true, index: true },
    before: { type: Schema.Types.Mixed, default: null },
    after: { type: Schema.Types.Mixed, default: null },
    diff: { 
      type: [{
        field: String,
        label: String,
        before: Schema.Types.Mixed,
        after: Schema.Types.Mixed,
      }], 
      default: [] 
    },
    override: { type: Boolean, default: false },
    notes: { type: String, default: "" },
  },
  { timestamps: false, collection: "zk_audit" }
);

// --- 10. User Roles for Zakat Rice ---
export interface IZkUserRole extends Document {
  user_id: string;
  user_name: string;
  role: "admin" | "store" | "dist" | "acct" | "viewer";
  permissions: string[];
  createdAt: Date;
  updatedAt: Date;
}

const ZkUserRoleSchema = new Schema<IZkUserRole>(
  {
    user_id: { type: String, required: true, unique: true, index: true },
    user_name: { type: String, default: "" },
    role: { 
      type: String, 
      enum: ["admin", "store", "dist", "acct", "viewer"], 
      default: "viewer", 
      index: true 
    },
    permissions: { type: [String], default: [] },
  },
  { timestamps: true, collection: "zk_user_roles" }
);

// --- Export Models (Singleton safe in Next.js) ---
export const ZkSettings: Model<IZkSettings> = 
  mongoose.models.ZkSettings || mongoose.model<IZkSettings>("ZkSettings", ZkSettingsSchema);

export const ZkDonor: Model<IZkDonor> = 
  mongoose.models.ZkDonor || mongoose.model<IZkDonor>("ZkDonor", ZkDonorSchema);

export const ZkReceipt: Model<IZkReceipt> = 
  mongoose.models.ZkReceipt || mongoose.model<IZkReceipt>("ZkReceipt", ZkReceiptSchema);

export const ZkMill: Model<IZkMill> = 
  mongoose.models.ZkMill || mongoose.model<IZkMill>("ZkMill", ZkMillSchema);

export const ZkExpense: Model<IZkExpense> = 
  mongoose.models.ZkExpense || mongoose.model<IZkExpense>("ZkExpense", ZkExpenseSchema);

export const ZkBeneficiary: Model<IZkBeneficiary> = 
  mongoose.models.ZkBeneficiary || mongoose.model<IZkBeneficiary>("ZkBeneficiary", ZkBeneficiarySchema);

export const ZkDistribution: Model<IZkDistribution> = 
  mongoose.models.ZkDistribution || mongoose.model<IZkDistribution>("ZkDistribution", ZkDistributionSchema);

export const ZkAdjustment: Model<IZkAdjustment> = 
  mongoose.models.ZkAdjustment || mongoose.model<IZkAdjustment>("ZkAdjustment", ZkAdjustmentSchema);

export const ZkAudit: Model<IZkAudit> = 
  mongoose.models.ZkAudit || mongoose.model<IZkAudit>("ZkAudit", ZkAuditSchema);

export const ZkUserRole: Model<IZkUserRole> = 
  mongoose.models.ZkUserRole || mongoose.model<IZkUserRole>("ZkUserRole", ZkUserRoleSchema);

