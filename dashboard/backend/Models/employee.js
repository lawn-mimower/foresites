const mongoose = require('mongoose');

const employeeSchema = new mongoose.Schema({
  name: { type: String, required: true },
  phone: { type: String, required: true },
  contractor: { type: String, required: true },
  id: { type: String, required: true, unique: true },
  date: { type: Date, required: true }
}, { timestamps: true });

module.exports = mongoose.model('Employee', employeeSchema);