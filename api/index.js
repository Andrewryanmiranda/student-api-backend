// api/index.js
const connectToDatabase = require('../db');
const mongoose = require('mongoose');

// Schema: one attendance record per student per class
const AttendanceSchema = new mongoose.Schema({
  studentName: { type: String, required: true, trim: true },
  date:        { type: Date,   required: true },
  subjectName: { type: String, required: true, trim: true },
  section:     { type: String, required: true, trim: true }
}, { timestamps: true, collection: 'daily_attendance' });

const Attendance =
  mongoose.models.Attendance || mongoose.model('Attendance', AttendanceSchema);

module.exports = async (req, res) => {
  // Enable CORS so GitHub Pages can communicate with this API
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    await connectToDatabase();

    // Fetch all records, newest date first (GET)
    if (req.method === 'GET') {
      const records = await Attendance.find({}).sort({ date: -1, createdAt: -1 });
      return res.status(200).json(records);
    }

    // Save a new record (POST)
    if (req.method === 'POST') {
      const { studentName, date, subjectName, section } = req.body || {};
      if (!studentName || !date || !subjectName || !section) {
        return res.status(400).json({
          error: 'studentName, date, subjectName and section are required'
        });
      }
      const newRecord = await Attendance.create({ studentName, date, subjectName, section });
      return res.status(201).json(newRecord);
    }

    return res.status(405).json({ error: 'Method Not Allowed' });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: 'Database connection failed' });
  }
};
