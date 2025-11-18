// models/Admin.cjs
const mongoose = require('mongoose');

const adminSchema = new mongoose.Schema({
  username: { type: String, required: true, unique: true },
  email: { type: String, default: '' },
  password: { type: String, required: true }, // hashed
  role: { type: String, default: 'admin' }
}, { timestamps: true });

module.exports = mongoose.models.Admin ? mongoose.model('Admin') : mongoose.model('Admin', adminSchema);
