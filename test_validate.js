const mongoose = require("mongoose");
const s = new mongoose.Schema({ type: { type: String, enum: ["income", "expense"], required: true } });
const M = mongoose.model('M3', s);
try {
  const m = new M({ type: "income" });
  console.log("Validation error:", m.validateSync());
} catch(e) {
  console.log(e);
}
