// Arabic text normalization & helpers for Zakat Rice / Warehouse

/**
 * Normalizes Arabic text for flexible search and duplicate detection.
 * - Converts Indic/Hindi digits (٠-٩) to standard English digits (0-9)
 * - Removes diacritics / tashkeel
 * - Unifies alefs (أ، إ، آ -> ا)
 * - Unifies yaa / alef maqsura (ي، ى -> ي)
 * - Unifies taa marbuta / haa (ة -> ه)
 * - Removes repeated whitespace
 */
export function normalizeArabicText(text?: string | null): string {
  if (!text) return "";
  let s = String(text);

  // Convert Arabic-Indic numerals
  const hindiDigits = ["٠", "١", "٢", "٣", "٤", "٥", "٦", "٧", "٨", "٩"];
  hindiDigits.forEach((digit, i) => {
    s = s.replace(new RegExp(digit, "g"), String(i));
  });

  // Remove diacritics (tashkeel, tatweel)
  s = s.replace(/[\u064B-\u065F\u0670\u0640]/g, "");

  // Normalize Alefs
  s = s.replace(/[إأآ]/g, "ا");

  // Normalize Yaa / Alef Maqsura
  s = s.replace(/ى/g, "ي");

  // Normalize Taa Marbuta
  s = s.replace(/ة/g, "ه");

  // Trim and collapse whitespace
  s = s.replace(/\s+/g, " ").trim().toLowerCase();

  return s;
}

/**
 * Converts any Arabic numerals in an input string to standard digits
 */
export function parseArabicNumber(val: any): number {
  if (val === undefined || val === null || val === "") return 0;
  if (typeof val === "number") return isNaN(val) ? 0 : val;
  const normalized = normalizeArabicText(String(val)).replace(/,/g, "");
  const num = parseFloat(normalized);
  return isNaN(num) ? 0 : num;
}

/**
 * Formats a number with thousands separators (1,234.5)
 */
export function formatNumber(val: number | null | undefined, decimals = 1): string {
  if (val === null || val === undefined || isNaN(val)) return "0";
  const fixed = decimals > 0 ? Number(val.toFixed(decimals)) : Math.round(val);
  return new Intl.NumberFormat("en-US", {
    minimumFractionDigits: 0,
    maximumFractionDigits: decimals,
  }).format(fixed);
}

/**
 * Formats a number as Egyptian Pounds (1,234.5 ج.م)
 */
export function formatCurrency(val: number | null | undefined): string {
  return `${formatNumber(val, 2)} ج.م`;
}

/**
 * Formats a serial number as 5 digits (e.g. 1 -> "00001")
 */
export function padSerialNo(num: number | string): string {
  const n = parseInt(String(num), 10) || 0;
  return String(n).padStart(5, "0");
}

/**
 * Field translation dictionary for human-readable audit diffs
 */
export const ARABIC_FIELD_LABELS: Record<string, string> = {
  no: "رقم العملية",
  date: "التاريخ",
  season: "الموسم",
  name: "الاسم",
  phone: "الهاتف",
  land_description: "بيانات الأرض",
  item: "نوع الصنف",
  item_name: "اسم الصنف",
  bags: "عدد الشكاير",
  bag_kg: "وزن الشيكارة",
  quantity: "الكمية",
  unit: "الوحدة",
  amount: "المبلغ",
  purpose: "الغرض",
  payment_method: "طريقة الدفع",
  store_label: "المخزن",
  place: "المضرب / المكان",
  in_kg: "الشعير الداخل (كجم)",
  rice_kg: "الأرز الأبيض الناتج (كجم)",
  bran_kg: "الردة (كجم)",
  waste_kg: "الفاقد (كجم)",
  other_kg: "ناتج إضافي (كجم)",
  type: "نوع المصروف",
  qty: "العدد",
  party: "الجهة / المستلم",
  car_driver: "السيارة / السائق",
  ref_text: "العملية المرتبطة",
  area: "المنطقة / العنوان",
  family_size: "أفراد الأسرة",
  extra: "بيانات إضافية",
  entered_qty: "الكمية المدخلة",
  quantity_kg: "الكمية المخصومة (كجم)",
  override: "تجاوز الرصيد",
  store: "المخزن",
  kg: "الكمية (كجم)",
  reason: "السبب",
  notes: "الملاحظات",
  opening_barley_kg: "الرصيد الافتتاحي للشعير",
  opening_rice_kg: "الرصيد الافتتاحي للأرز",
  min_barley_kg: "حد تنبيه الشعير",
  min_rice_kg: "حد تنبيه الأرز",
  org_name: "اسم الجمعية",
};

/**
 * Computes difference between two objects and returns readable Arabic diffs
 */
export function computeFieldDiff(before: any, after: any): Array<{ field: string; label: string; before: any; after: any }> {
  if (!before && !after) return [];
  const diff: Array<{ field: string; label: string; before: any; after: any }> = [];

  const ignoredKeys = new Set(["_id", "id", "__v", "createdAt", "updatedAt", "version", "nameNormalized", "clientId"]);

  const allKeys = new Set([...Object.keys(before || {}), ...Object.keys(after || {})]);

  allKeys.forEach((key) => {
    if (ignoredKeys.has(key)) return;

    const valBefore = before ? before[key] : undefined;
    const valAfter = after ? after[key] : undefined;

    // Deep compare objects / dates
    const strBefore = valBefore instanceof Date ? valBefore.toISOString() : JSON.stringify(valBefore ?? "");
    const strAfter = valAfter instanceof Date ? valAfter.toISOString() : JSON.stringify(valAfter ?? "");

    if (strBefore !== strAfter) {
      diff.push({
        field: key,
        label: ARABIC_FIELD_LABELS[key] || key,
        before: valBefore ?? "—",
        after: valAfter ?? "—",
      });
    }
  });

  return diff;
}

