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

const validDate = (v) => !isNaN(new Date(v).getTime());
const day = (v) => new Date(v).toISOString().slice(0, 10);

module.exports = async (req, res) => {
  // Enable CORS so GitHub Pages can communicate with this API
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    await connectToDatabase();

    // ---------- READ: all students ----------
    if (req.method === 'GET') {
      const records = await Attendance.find({}).sort({ studentName: 1 });
      return res.status(200).json(records);
    }

    // ---------- CREATE: add an attendance date for a student ----------
    if (req.method === 'POST') {
      const { studentName, date, subjectName, section, status } = req.body || {};
      if (!studentName || !date || !subjectName || !section) {
        return res.status(400).json({
          error: 'studentName, date, subjectName and section are required'
        });
      }
      if (!validDate(date)) {
        return res.status(400).json({ error: 'Invalid date' });
      }

      const when = new Date(date);
      const filter = {
        studentName: studentName.trim(),
        subjectName: subjectName.trim(),
        section: section.trim()
      };
      const entryStatus = status || 'Present';

      let doc = await Attendance.findOne(filter);

      if (!doc) {
        doc = await Attendance.create({ ...filter, dates: [{ date: when, status: entryStatus }] });
        return res.status(201).json(doc);
      }

      const existing = doc.dates.find(d => day(d.date) === day(when));
      if (existing) {
        existing.status = entryStatus;
      } else {
        doc.dates.push({ date: when, status: entryStatus });
      }
      await doc.save();
      return res.status(200).json(doc);
    }

    // ---------- UPDATE ----------
    // Edit student info:  { id, studentName, subjectName, section }
    // Edit one date:      { id, date, newDate?, status? }
    if (req.method === 'PUT') {
      const { id, studentName, subjectName, section, date, newDate, status } = req.body || {};
      if (!id || !mongoose.isValidObjectId(id)) {
        return res.status(400).json({ error: 'A valid id is required' });
      }

      const doc = await Attendance.findById(id);
      if (!doc) {
        return res.status(404).json({ error: 'Record not found' });
      }

      if (date) {
        if (!validDate(date)) return res.status(400).json({ error: 'Invalid date' });
        const entry = doc.dates.find(d => day(d.date) === day(date));
        if (!entry) return res.status(404).json({ error: 'That date was not found' });

        if (status) entry.status = status;

        if (newDate && day(newDate) !== day(date)) {
          if (!validDate(newDate)) return res.status(400).json({ error: 'Invalid new date' });
          const clash = doc.dates.find(d => d !== entry && day(d.date) === day(newDate));
          if (clash) {
            return res.status(409).json({ error: 'That student already has a record on the new date' });
          }
          entry.date = new Date(newDate);
        }
      } else {
        if (studentName) doc.studentName = studentName.trim();
        if (subjectName) doc.subjectName = subjectName.trim();
        if (section) doc.section = section.trim();
      }

      await doc.save();
      return res.status(200).json(doc);
    }

    // ---------- DELETE ----------
    // /api/index?id=<id>               -> delete the whole student record
    // /api/index?id=<id>&date=YYYY-MM-DD -> delete just that date
    if (req.method === 'DELETE') {
      const { id, date } = req.query || {};
      if (!id || !mongoose.isValidObjectId(id)) {
        return res.status(400).json({ error: 'A valid id is required' });
      }

      if (date) {
        if (!validDate(date)) return res.status(400).json({ error: 'Invalid date' });
        const doc = await Attendance.findById(id);
        if (!doc) return res.status(404).json({ error: 'Record not found' });
        doc.dates = doc.dates.filter(d => day(d.date) !== day(date));
        await doc.save();
        return res.status(200).json(doc);
      }

      const removed = await Attendance.findByIdAndDelete(id);
      if (!removed) return res.status(404).json({ error: 'Record not found' });
      return res.status(200).json({ ok: true });
    }

    return res.status(405).json({ error: 'Method Not Allowed' });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: 'Server error' });
  }
};
