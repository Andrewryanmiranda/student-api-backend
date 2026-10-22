// api/index.js
const connectToDatabase = require('../db');
const mongoose = require('mongoose');

// Matches the existing daily_attendance documents:
// { studentName, subjectName, section, dates: [{ date, status }] }
const AttendanceSchema = new mongoose.Schema({
  studentName: { type: String, required: true, trim: true },
  subjectName: { type: String, required: true, trim: true },
  section:     { type: String, required: true, trim: true },
  dates: [{
    _id: false,
    date:   { type: Date, required: true },
    status: { type: String, default: 'Present' }
  }]
}, { collection: 'daily_attendance', timestamps: false });

const Attendance =
  mongoose.models.Attendance || mongoose.model('Attendance', AttendanceSchema);

const day = (d) => new Date(d).toISOString().slice(0, 10);

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

    // Fetch all students (GET)
    if (req.method === 'GET') {
      const records = await Attendance.find({}).sort({ studentName: 1 });
      return res.status(200).json(records);
    }

    // Add an attendance date for a student (POST)
    if (req.method === 'POST') {
      const { studentName, date, subjectName, section, status } = req.body || {};
      if (!studentName || !date || !subjectName || !section) {
        return res.status(400).json({
          error: 'studentName, date, subjectName and section are required'
        });
      }

      const when = new Date(date);
      if (isNaN(when.getTime())) {
        return res.status(400).json({ error: 'Invalid date' });
      }

      const filter = {
        studentName: studentName.trim(),
        subjectName: subjectName.trim(),
        section: section.trim()
      };
      const entryStatus = status || 'Present';

      let doc = await Attendance.findOne(filter);

      if (!doc) {
        // New student/subject/section: create a document with one date
        doc = await Attendance.create({ ...filter, dates: [{ date: when, status: entryStatus }] });
        return res.status(201).json(doc);
      }

      // Existing document: update that day's status, or add a new date
      const existing = doc.dates.find(d => day(d.date) === day(when));
      if (existing) {
        existing.status = entryStatus;
      } else {
        doc.dates.push({ date: when, status: entryStatus });
      }
      await doc.save();
      return res.status(200).json(doc);
    }

    return res.status(405).json({ error: 'Method Not Allowed' });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: 'Database connection failed' });
  }
};
