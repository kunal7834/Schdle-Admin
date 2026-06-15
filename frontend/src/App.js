import React, { useState, useEffect, useCallback } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { Calendar, ChevronLeft, ChevronRight, ChevronDown, MapPin, Users, Upload, Trash2, Lock } from 'lucide-react';
import * as XLSX from 'xlsx';
import {
  fetchEvents, createEvents, deleteEvent as apiDeleteEvent,
  fetchRosters, saveRoster,
  uploadMaster, clearMaster as apiClearMaster, fetchMasterMeta,
} from '@/api';

// ---------------- Constants ----------------
const VENUES = ['A1', 'A2', 'A3', 'B1', 'B2', 'B3', 'CR A1', 'CR A2', 'CR B1', 'CR B2', 'CR C1', 'CR C2', 'CR C3', 'MDC C6', 'Amphitheater', 'PGP Auditorium', 'MDC Auditorium'];

// All sections (used by both admin event creator and section roster manager)
const SECTIONS = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'LSM', 'FIN'];

// PGP-29 standard time slots; "Other" lets admins pick any time
const TIME_SLOTS = ['09.15 – 10.30', '10.45 – 12.00', '12.15 – 13.30', '14.30 – 15.45', '16.00 – 17.15'];

// Tokens in the master schedule grid that aren't a real class
const MASTER_SKIP_TOKENS = new Set(['LUNCH BREAK', 'LUNCH', 'BREAK', '']);

// Admin credentials (email/username + password)
const ADMIN_ACCOUNTS = [
  { username: 'Programme@iimk', password: 'no915class', label: 'Programme Office' },
  { username: 'Placement@iimk', password: 'hojayega',   label: 'Placement Office' },
];

const emptyRosters = () => Object.fromEntries(SECTIONS.map(s => [s, []]));

// ---------------- Calendar View ----------------
const CalendarView = ({ currentMonth, setCurrentMonth, selectedDate, setSelectedDate, getEventsForDate, userType, viewMode, setViewMode }) => {
  const monthNames = ["January","February","March","April","May","June","July","August","September","October","November","December"];
  const daysOfWeek = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];
  const accent = userType === 'admin' ? 'admin' : 'student';

  const today = new Date();
  const fmt = (d) => `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
  const todayStr = fmt(today);

  // Selected-date anchored week (Sunday to Saturday)
  const selDate = new Date(selectedDate);
  const weekStart = new Date(selDate);
  weekStart.setDate(selDate.getDate() - selDate.getDay());
  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekStart.getDate() + 6);

  const navigate = (offset) => {
    if (viewMode === 'week') {
      const d = new Date(selDate);
      d.setDate(selDate.getDate() + offset * 7);
      setSelectedDate(fmt(d));
      setCurrentMonth({ year: d.getFullYear(), month: d.getMonth() });
    } else {
      const d = new Date(currentMonth.year, currentMonth.month + offset, 1);
      setCurrentMonth({ year: d.getFullYear(), month: d.getMonth() });
    }
  };

  const renderDayCell = (dateStr, dayLabel, key) => {
    const isSelected = dateStr === selectedDate;
    const isToday = dateStr === todayStr;
    const count = getEventsForDate(dateStr).length;
    return (
      <button
        key={key}
        data-testid={`calendar-day-${dateStr}`}
        onClick={() => setSelectedDate(dateStr)}
        className={`aspect-square p-2 rounded-lg transition-all relative ${
          isSelected ? (accent === 'admin' ? 'bg-blue-600 text-white shadow-lg' : 'bg-sky-500 text-white shadow-lg')
            : isToday ? (accent === 'admin' ? 'bg-blue-100 text-blue-800 font-semibold' : 'bg-sky-100 text-sky-700 font-semibold')
            : 'hover:bg-slate-100'
        }`}
      >
        <div className="text-sm">{dayLabel}</div>
        {count > 0 && (
          <div className="absolute bottom-1 left-1/2 transform -translate-x-1/2 flex gap-0.5">
            {[...Array(Math.min(count, 3))].map((_, i) => (
              <div key={i} className={`w-1 h-1 rounded-full ${isSelected ? 'bg-white' : (accent === 'admin' ? 'bg-blue-600' : 'bg-sky-500')}`} />
            ))}
          </div>
        )}
      </button>
    );
  };

  // Month cells
  let cells = [];
  if (viewMode === 'month') {
    const daysInMonth = new Date(currentMonth.year, currentMonth.month + 1, 0).getDate();
    const firstDay = new Date(currentMonth.year, currentMonth.month, 1).getDay();
    for (let i = 0; i < firstDay; i++) cells.push(<div key={`e-${i}`} className="aspect-square" />);
    for (let day = 1; day <= daysInMonth; day++) {
      const dateStr = `${currentMonth.year}-${String(currentMonth.month+1).padStart(2,'0')}-${String(day).padStart(2,'0')}`;
      cells.push(renderDayCell(dateStr, day, day));
    }
  } else {
    for (let i = 0; i < 7; i++) {
      const d = new Date(weekStart);
      d.setDate(weekStart.getDate() + i);
      cells.push(renderDayCell(fmt(d), d.getDate(), i));
    }
  }

  const headerTitle = viewMode === 'month'
    ? `${monthNames[currentMonth.month]} ${currentMonth.year}`
    : (() => {
        const sameMonth = weekStart.getMonth() === weekEnd.getMonth();
        const startStr = `${monthNames[weekStart.getMonth()].slice(0,3)} ${weekStart.getDate()}`;
        const endStr = sameMonth
          ? `${weekEnd.getDate()}, ${weekEnd.getFullYear()}`
          : `${monthNames[weekEnd.getMonth()].slice(0,3)} ${weekEnd.getDate()}, ${weekEnd.getFullYear()}`;
        return `${startStr} – ${endStr}`;
      })();

  const toggleBase = 'px-3 py-1.5 text-xs font-semibold rounded-md transition-colors';
  const activeToggle = accent === 'admin' ? 'bg-blue-600 text-white' : 'bg-sky-500 text-white';
  const inactiveToggle = 'bg-slate-100 text-slate-600 hover:bg-slate-200';

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
      <div className="flex items-center justify-between mb-4">
        <button data-testid="calendar-prev-month" onClick={() => navigate(-1)} className={`p-2 rounded-lg transition-colors ${accent === 'admin' ? 'hover:bg-blue-100 text-blue-600' : 'hover:bg-sky-100 text-sky-500'}`}>
          <ChevronLeft className="w-6 h-6" />
        </button>
        <h2 className="text-xl sm:text-2xl font-bold text-slate-900 text-center">{headerTitle}</h2>
        <button data-testid="calendar-next-month" onClick={() => navigate(1)} className={`p-2 rounded-lg transition-colors ${accent === 'admin' ? 'hover:bg-blue-100 text-blue-600' : 'hover:bg-sky-100 text-sky-500'}`}>
          <ChevronRight className="w-6 h-6" />
        </button>
      </div>
      <div className="flex justify-center gap-1 mb-4 bg-slate-50 p-1 rounded-lg w-fit mx-auto">
        <button
          data-testid="calendar-view-month"
          onClick={() => setViewMode('month')}
          className={`${toggleBase} ${viewMode === 'month' ? activeToggle : inactiveToggle}`}
        >Month</button>
        <button
          data-testid="calendar-view-week"
          onClick={() => setViewMode('week')}
          className={`${toggleBase} ${viewMode === 'week' ? activeToggle : inactiveToggle}`}
        >Week</button>
      </div>
      <div className="grid grid-cols-7 gap-2 mb-2">
        {daysOfWeek.map(d => <div key={d} className="text-center text-sm font-semibold text-slate-600 py-2">{d}</div>)}
      </div>
      <div className="grid grid-cols-7 gap-2">{cells}</div>
    </div>
  );
};

// ---------------- Section Roster Parser ----------------
// Parses a "Sec X.xlsx" roster file in the IIMK format
// Header row layout: Sl. No | Application Number | Roll Number | Candidate Name | IIMK Email | Gender
const parseSectionRoster = async (file) => {
  const buf = await file.arrayBuffer();
  const wb = XLSX.read(buf, { type: 'array' });
  const sheet = wb.Sheets[wb.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, blankrows: false });
  // Find the header row containing 'Candidate Name' and 'IIMK Email'
  let headerIdx = -1;
  for (let i = 0; i < rows.length; i++) {
    const lower = rows[i].map(c => String(c ?? '').trim().toLowerCase());
    if (lower.includes('candidate name') && lower.includes('iimk email')) {
      headerIdx = i;
      break;
    }
  }
  if (headerIdx === -1) {
    throw new Error('Could not find header row with "Candidate Name" and "IIMK Email" columns.');
  }
  const headers = rows[headerIdx].map(c => String(c ?? '').trim().toLowerCase());
  const colName = headers.indexOf('candidate name');
  const colEmail = headers.indexOf('iimk email');
  const colRoll = headers.indexOf('roll number');
  const colGender = headers.indexOf('gender');

  const students = [];
  for (let i = headerIdx + 1; i < rows.length; i++) {
    const r = rows[i];
    const name = String(r[colName] ?? '').trim();
    const email = String(r[colEmail] ?? '').trim().toLowerCase();
    if (!name || !email || !email.includes('@')) continue;
    students.push({
      name,
      email,
      rollNumber: colRoll >= 0 ? String(r[colRoll] ?? '').trim() : '',
      gender: colGender >= 0 ? String(r[colGender] ?? '').trim() : '',
    });
  }
  return students;
};

// ---------------- Master Schedule Parser ----------------
// Parses PGP-29 master schedule and returns array of generated events
// Returns: { events: [{ id, title, time, venue, date, sections, courseCode, source: 'master' }], skipped }
const parseMasterSchedule = async (file, createdBy) => {
  const buf = await file.arrayBuffer();
  const wb = XLSX.read(buf, { type: 'array' });
  const sheetName = wb.SheetNames.find(n => /schedule/i.test(n)) || wb.SheetNames[0];
  const sheet = wb.Sheets[sheetName];
  const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, blankrows: false, raw: true });

  // Find venue row (contains "Date" and "Time") and section row (below it)
  let venueRowIdx = -1;
  for (let i = 0; i < rows.length; i++) {
    const lower = rows[i].map(c => String(c ?? '').trim().toLowerCase());
    if (lower.includes('date') && lower.includes('time')) {
      venueRowIdx = i; break;
    }
  }
  if (venueRowIdx === -1) throw new Error('Master schedule: header row with "Date" and "Time" not found.');

  const venueRow = rows[venueRowIdx].map(c => String(c ?? '').trim());
  const sectionRow = (rows[venueRowIdx + 1] || []).map(c => String(c ?? '').trim());

  // For each col index >= 2, map to { venue, section }
  const colMap = {};
  for (let c = 2; c < venueRow.length; c++) {
    const venue = venueRow[c];
    const sec = sectionRow[c] || '';
    const m = sec.match(/sec\s*([A-Z])/i);
    if (m && venue) {
      colMap[c] = { venue, section: m[1].toUpperCase() };
    }
  }

  const events = [];
  let skipped = 0;
  const fmt = (d) => `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
  for (let i = venueRowIdx + 2; i < rows.length; i++) {
    const r = rows[i];
    if (!r) continue;
    let dateCell = r[0];
    const timeCell = String(r[1] ?? '').trim();
    if (!dateCell || !timeCell) continue;
    // Normalize date — Excel may give Date object or serial number
    let dateStr = '';
    if (dateCell instanceof Date) dateStr = fmt(dateCell);
    else if (typeof dateCell === 'number') {
      const d = new Date(Date.UTC(1899, 11, 30) + dateCell * 86400000);
      dateStr = fmt(d);
    } else {
      const parsed = new Date(dateCell);
      if (!isNaN(parsed)) dateStr = fmt(parsed);
    }
    if (!dateStr) continue;
    if (/lunch/i.test(timeCell)) continue;

    for (const [cStr, { venue, section }] of Object.entries(colMap)) {
      const code = String(r[Number(cStr)] ?? '').trim();
      if (!code || MASTER_SKIP_TOKENS.has(code.toUpperCase())) { if (code) skipped++; continue; }
      events.push({
        id: `master-${dateStr}-${timeCell}-${section}-${code}`,
        title: code,
        courseCode: code,
        description: '',
        time: timeCell,
        venue,
        date: dateStr,
        sections: [section],
        source: 'master',
        createdBy,
        createdAt: new Date().toISOString(),
      });
    }
  }
  return { events, skipped };
};

// ---------------- Section Rosters Manager ----------------
const SectionRostersManager = ({ rosters, onUploadSection, onClearSection }) => {
  const [open, setOpen] = useState(false);
  const [activeSec, setActiveSec] = useState('A');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const handleFile = async (section, e) => {
    setError(''); setBusy(true);
    const file = e.target.files?.[0];
    if (!file) { setBusy(false); return; }
    try {
      const students = await parseSectionRoster(file);
      if (students.length === 0) {
        setError(`No valid students found in ${file.name}. Check the file format.`);
      } else {
        await onUploadSection(section, students);
      }
    } catch (err) {
      setError(`${file.name}: ${err.message || 'parse error'}`);
    } finally {
      e.target.value = '';
      setBusy(false);
    }
  };

  const clearSection = (section) => {
    onClearSection(section);
  };

  const total = SECTIONS.reduce((s, sec) => s + (rosters[sec]?.length || 0), 0);
  const activeList = rosters[activeSec] || [];

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
      <button
        data-testid="rosters-toggle-btn"
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between p-6 hover:bg-blue-50/40 transition-colors"
      >
        <h3 className="text-lg font-semibold text-slate-900 flex items-center gap-2 tracking-tight">
          <Users className="w-5 h-5 text-blue-600" /> Section Rosters
          <span className="text-xs font-normal text-slate-500 ml-2">({total} students across {SECTIONS.filter(s => (rosters[s]?.length || 0) > 0).length} sections)</span>
        </h3>
        <ChevronDown className={`w-5 h-5 text-slate-500 transition-transform duration-300 ${open ? 'rotate-180' : ''}`} />
      </button>

      <div className={`grid transition-all duration-300 ease-out ${open ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0'}`}>
        <div className="overflow-hidden">
          <div className="p-6 pt-0 space-y-4">
            <p className="text-xs text-slate-500">
              Upload one Excel file per section. Expected columns: <span className="font-mono">Sl. No · Application Number · Roll Number · Candidate Name · IIMK Email · Gender</span>.
            </p>

            {error && <div data-testid="rosters-error" className="text-red-600 text-xs bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</div>}

            <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
              {SECTIONS.map(sec => {
                const count = rosters[sec]?.length || 0;
                const filled = count > 0;
                const isActive = activeSec === sec;
                return (
                  <div key={sec} className={`rounded-xl border ${isActive ? 'border-blue-400 ring-2 ring-blue-100' : 'border-slate-200'} bg-white p-3 transition-shadow`}>
                    <button
                      data-testid={`rosters-sec-tab-${sec}`}
                      onClick={() => setActiveSec(sec)}
                      className="w-full text-left"
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-semibold text-slate-900 text-sm">Sec {sec}</span>
                        <span className={`text-xs px-2 py-0.5 rounded-full ${filled ? 'bg-blue-50 text-blue-700' : 'bg-slate-100 text-slate-500'}`} data-testid={`rosters-sec-count-${sec}`}>
                          {count}
                        </span>
                      </div>
                    </button>
                    <label data-testid={`rosters-upload-${sec}`} className="mt-2 cursor-pointer inline-flex items-center gap-1.5 text-xs font-medium text-blue-600 hover:text-blue-700">
                      <Upload className="w-3.5 h-3.5" /> {filled ? 'Replace' : 'Upload'}
                      <input type="file" accept=".xlsx,.xls" onChange={(e) => handleFile(sec, e)} className="hidden" data-testid={`rosters-file-${sec}`} />
                    </label>
                    {filled && (
                      <button data-testid={`rosters-clear-${sec}`} onClick={() => clearSection(sec)} className="ml-3 text-xs text-slate-500 hover:text-red-600">Clear</button>
                    )}
                  </div>
                );
              })}
            </div>

            {busy && <p className="text-xs text-slate-500">Parsing file…</p>}

            <div className="border border-slate-200 rounded-xl overflow-hidden">
              <div className="bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-700 flex justify-between">
                <span>Section {activeSec} students</span>
                <span data-testid="rosters-active-count">{activeList.length} student(s)</span>
              </div>
              <div className="max-h-72 overflow-y-auto divide-y divide-slate-100">
                {activeList.length === 0 ? (
                  <p className="text-slate-500 text-center py-6 text-sm">No students uploaded for Section {activeSec} yet.</p>
                ) : activeList.map((s, i) => (
                  <div key={`${s.email}-${i}`} className="px-3 py-2 text-sm flex justify-between items-center gap-2" data-testid={`rosters-row-${activeSec}-${i}`}>
                    <span className="text-slate-900 truncate">{s.name}</span>
                    <span className="text-slate-500 font-mono text-xs truncate">{s.email}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

// ---------------- Master Schedule Uploader ----------------
const MasterScheduleUploader = ({ events, currentUser, masterMeta, onUploadMaster, onClearMaster }) => {
  const [open, setOpen] = useState(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const masterEventCount = events.filter(e => e.source === 'master').length;

  const handleFile = async (e) => {
    setError(''); setBusy(true);
    const file = e.target.files?.[0];
    if (!file) { setBusy(false); return; }
    try {
      const { events: parsed, skipped } = await parseMasterSchedule(file, currentUser);
      if (parsed.length === 0) {
        setError('No class entries found in the master schedule.');
      } else {
        const meta = { uploadedAt: new Date().toISOString(), fileName: file.name, classCount: parsed.length, skipped };
        await onUploadMaster(parsed, meta);
      }
    } catch (err) {
      setError(`${file.name}: ${err.message || 'parse error'}`);
    } finally {
      e.target.value = '';
      setBusy(false);
    }
  };

  const clearMasterHandler = () => {
    onClearMaster();
  };

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
      <button
        data-testid="master-toggle-btn"
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between p-6 hover:bg-blue-50/40 transition-colors"
      >
        <h3 className="text-lg font-semibold text-slate-900 flex items-center gap-2 tracking-tight">
          <Upload className="w-5 h-5 text-blue-600" /> Master Schedule
          <span className="text-xs font-normal text-slate-500 ml-2">({masterEventCount} class entries)</span>
        </h3>
        <ChevronDown className={`w-5 h-5 text-slate-500 transition-transform duration-300 ${open ? 'rotate-180' : ''}`} />
      </button>

      <div className={`grid transition-all duration-300 ease-out ${open ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0'}`}>
        <div className="overflow-hidden">
          <div className="p-6 pt-0 space-y-3">
            <p className="text-xs text-slate-500">
              Upload the PGP master schedule Excel. The system reads venue columns (e.g. <span className="font-mono">CR A1</span>, <span className="font-mono">CR A2</span>…) and section labels (<span className="font-mono">Sec A</span>, <span className="font-mono">Sec B</span>…) from the header rows, then creates one calendar event per non-empty cell. Re-uploading replaces all previous master-schedule entries.
            </p>

            <div className="flex flex-wrap gap-2">
              <label data-testid="master-upload-btn" className="cursor-pointer inline-flex items-center gap-2 bg-blue-600 text-white px-3 py-2 rounded-lg hover:bg-blue-700 text-sm font-semibold">
                <Upload className="w-4 h-4" /> {masterMeta ? 'Replace Master Schedule' : 'Upload Master Schedule'}
                <input type="file" accept=".xlsx,.xls" onChange={handleFile} className="hidden" data-testid="master-file-input" />
              </label>
              {masterMeta && (
                <button data-testid="master-clear-btn" onClick={clearMasterHandler} className="inline-flex items-center gap-2 bg-slate-100 text-slate-700 px-3 py-2 rounded-lg hover:bg-slate-200 text-sm">
                  <Trash2 className="w-4 h-4" /> Clear Master Schedule
                </button>
              )}
            </div>

            {busy && <p className="text-xs text-slate-500">Parsing master schedule…</p>}
            {error && <div data-testid="master-error" className="text-red-600 text-xs bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</div>}

            {masterMeta && (
              <div data-testid="master-meta" className="text-xs bg-blue-50 border border-blue-200 rounded-lg px-3 py-2 text-blue-900">
                Loaded <strong>{masterMeta.fileName}</strong> · {masterMeta.classCount} classes generated · {new Date(masterMeta.uploadedAt).toLocaleString()}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

// ---------------- Admin Platform ----------------
const AdminPlatform = () => {
  const [currentUser, setCurrentUser] = useState(null);
  const [events, setEvents] = useState([]);
  const [rosters, setRosters] = useState(emptyRosters());
  const [masterMeta, setMasterMeta] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [showAddEvent, setShowAddEvent] = useState(false);
  const today = new Date();
  const [currentMonth, setCurrentMonth] = useState({ year: today.getFullYear(), month: today.getMonth() });
  const [selectedDate, setSelectedDate] = useState(`${today.getFullYear()}-${String(today.getMonth()+1).padStart(2,'0')}-${String(today.getDate()).padStart(2,'0')}`);
  const [viewMode, setViewMode] = useState('month');
  const [sectionFilter, setSectionFilter] = useState([]); // empty = all sections

  const blankEvent = { title: '', description: '', time: '', useCustomTime: false, venue: VENUES[0], sections: [], repeatWeekly: false };
  const [newEvent, setNewEvent] = useState(blankEvent);

  // Load data from the API once the admin is logged in
  useEffect(() => {
    if (!currentUser) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      setLoadError('');
      try {
        const [eventsData, rostersData, masterMetaData] = await Promise.all([
          fetchEvents(),
          fetchRosters(),
          fetchMasterMeta(),
        ]);
        if (cancelled) return;
        setEvents(eventsData);
        setRosters({ ...emptyRosters(), ...rostersData });
        setMasterMeta(masterMetaData);
      } catch (err) {
        if (!cancelled) setLoadError(err.message || 'Failed to load data from the server.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [currentUser]);

  // Filter events by section filter (empty = show all)
  const visibleEvents = sectionFilter.length === 0
    ? events
    : events.filter(e => (e.sections || []).some(s => sectionFilter.includes(s)));

  const getEventsForDate = (date) => visibleEvents.filter(e => e.date === date);

  // Slot availability for the Add Event form: returns { [slot]: { booked: bool, by: 'section' or null } }
  const slotAvailability = (() => {
    const map = {};
    for (const slot of TIME_SLOTS) {
      const conflict = events.some(e =>
        e.date === selectedDate && e.time === slot
        && (newEvent.sections.length === 0 || (e.sections || []).some(s => newEvent.sections.includes(s)))
      );
      map[slot] = { booked: conflict };
    }
    return map;
  })();

  const toggleSection = (s) => {
    setNewEvent(prev => ({
      ...prev,
      sections: prev.sections.includes(s) ? prev.sections.filter(x => x !== s) : [...prev.sections, s]
    }));
  };

  const toggleFilterSection = (s) => {
    setSectionFilter(prev => prev.includes(s) ? prev.filter(x => x !== s) : [...prev, s]);
  };

  const handleAddEvent = async () => {
    if (!newEvent.title || !newEvent.time || newEvent.sections.length === 0) return;
    const toAdd = [];
    const base = {
      title: newEvent.title,
      description: newEvent.description,
      time: newEvent.time,
      venue: newEvent.venue,
      sections: newEvent.sections,
      source: 'manual',
      createdBy: currentUser,
      createdAt: new Date().toISOString(),
    };
    if (newEvent.repeatWeekly) {
      const sel = new Date(selectedDate);
      const dow = sel.getDay();
      const { year, month } = currentMonth;
      const dim = new Date(year, month + 1, 0).getDate();
      for (let day = 1; day <= dim; day++) {
        const d = new Date(year, month, day);
        if (d.getDay() === dow) {
          const ds = `${year}-${String(month+1).padStart(2,'0')}-${String(day).padStart(2,'0')}`;
          toAdd.push({ ...base, id: `${Date.now()}-${day}-${Math.random().toString(36).slice(2,7)}`, date: ds });
        }
      }
    } else {
      toAdd.push({ ...base, id: `${Date.now()}-${Math.random().toString(36).slice(2,7)}`, date: selectedDate });
    }
    try {
      await createEvents(toAdd);
      setEvents(prev => [...prev, ...toAdd]);
      setNewEvent(blankEvent);
      setShowAddEvent(false);
    } catch (err) {
      setLoadError(err.message || 'Failed to create event.');
    }
  };

  const handleDelete = async (id) => {
    try {
      await apiDeleteEvent(id);
      setEvents(prev => prev.filter(e => e.id !== id));
    } catch (err) {
      setLoadError(err.message || 'Failed to delete event.');
    }
  };

  const handleClearAllEvents = async () => {
    if (events.length === 0) return;
    const ok = window.confirm(`Delete all ${events.length} scheduled event(s)? This cannot be undone.`);
    if (!ok) return;
    try {
      await Promise.all(events.map(e => apiDeleteEvent(e.id)));
      await apiClearMaster();
      setEvents([]);
      setMasterMeta(null);
    } catch (err) {
      setLoadError(err.message || 'Failed to clear events.');
    }
  };

  const handleUploadMaster = async (parsedEvents, meta) => {
    try {
      await uploadMaster(parsedEvents, meta);
      setEvents(prev => [...prev.filter(ev => ev.source !== 'master'), ...parsedEvents]);
      setMasterMeta(meta);
    } catch (err) {
      setLoadError(err.message || 'Failed to upload master schedule.');
    }
  };

  const handleClearMaster = async () => {
    try {
      await apiClearMaster();
      setEvents(prev => prev.filter(ev => ev.source !== 'master'));
      setMasterMeta(null);
    } catch (err) {
      setLoadError(err.message || 'Failed to clear master schedule.');
    }
  };

  const handleUploadSection = async (section, students) => {
    try {
      await saveRoster(section, students);
      setRosters(prev => ({ ...prev, [section]: students }));
    } catch (err) {
      setLoadError(err.message || 'Failed to save roster.');
    }
  };

  const handleClearSection = async (section) => {
    try {
      await saveRoster(section, []);
      setRosters(prev => ({ ...prev, [section]: [] }));
    } catch (err) {
      setLoadError(err.message || 'Failed to clear roster.');
    }
  };

  if (!currentUser) {
    return <AdminLogin onLogin={setCurrentUser} />;
  }

  const selectedDateEvents = getEventsForDate(selectedDate).sort((a, b) => a.time.localeCompare(b.time));

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="bg-white border-b border-slate-200 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto flex justify-between items-center px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="inline-flex items-center justify-center w-9 h-9 rounded-xl bg-blue-600">
              <Calendar className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-base font-semibold text-slate-900 tracking-tight">Administration Platform</h1>
              <p className="text-xs text-slate-500" data-testid="admin-current-user">
                {ADMIN_ACCOUNTS.find(a => a.username === currentUser)?.label || currentUser} · {currentUser}
              </p>
            </div>
          </div>
          <button data-testid="admin-logout-btn" onClick={() => setCurrentUser(null)} className="bg-slate-900 hover:bg-slate-700 text-white px-4 py-2 rounded-lg transition-colors text-sm font-medium">Logout</button>
        </div>
      </div>

      <div className="max-w-7xl mx-auto p-6">
        {loadError && (
          <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-4 py-3 mb-4">{loadError}</div>
        )}
        {loading ? (
          <div className="text-center py-20 text-slate-500 text-sm">Loading…</div>
        ) : (
        <>
        {/* Section filter bar */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4 mb-6 flex items-center gap-3 flex-wrap" data-testid="section-filter-bar">
          <span className="text-xs font-semibold text-slate-700 mr-1">Filter by section:</span>
          <button
            data-testid="filter-all"
            onClick={() => setSectionFilter([])}
            className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${sectionFilter.length === 0 ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
          >All</button>
          {SECTIONS.map(s => {
            const active = sectionFilter.includes(s);
            return (
              <button
                key={s}
                data-testid={`filter-${s}`}
                onClick={() => toggleFilterSection(s)}
                className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${active ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
              >Sec {s}</button>
            );
          })}
          {sectionFilter.length > 0 && (
            <span className="text-xs text-slate-500 ml-auto" data-testid="filter-count">
              Showing {visibleEvents.length} of {events.length} events
            </span>
          )}
        </div>

        <div className="grid lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            <CalendarView
              currentMonth={currentMonth}
              setCurrentMonth={setCurrentMonth}
              selectedDate={selectedDate}
              setSelectedDate={setSelectedDate}
              getEventsForDate={getEventsForDate}
              userType="admin"
              viewMode={viewMode}
              setViewMode={setViewMode}
            />
            <MasterScheduleUploader events={events} currentUser={currentUser} masterMeta={masterMeta} onUploadMaster={handleUploadMaster} onClearMaster={handleClearMaster} />
            <SectionRostersManager rosters={rosters} onUploadSection={handleUploadSection} onClearSection={handleClearSection} />
          </div>

          <div className="space-y-6">
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
              <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
                <h3 className="text-lg font-semibold text-slate-900 tracking-tight">
                  {new Date(selectedDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                </h3>
                <div className="flex gap-2">
                  <button
                    data-testid="admin-clear-all-events"
                    onClick={handleClearAllEvents}
                    disabled={events.length === 0}
                    className="bg-red-50 text-red-600 border border-red-200 px-3 py-2 rounded-lg hover:bg-red-100 transition-colors text-xs font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
                    title="Delete every scheduled event"
                  >
                    Clear All ({events.length})
                  </button>
                  <button
                    data-testid="admin-add-event-toggle"
                    onClick={() => setShowAddEvent(!showAddEvent)}
                    className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors text-sm font-semibold"
                  >
                    + Add Event
                  </button>
                </div>
              </div>

              {showAddEvent && (
                <div className="mb-4 p-4 bg-blue-50 rounded-xl border border-blue-100">
                  <div className="space-y-3">
                    <input
                      data-testid="event-title-input"
                      type="text" placeholder="Event Title"
                      value={newEvent.title}
                      onChange={(e) => setNewEvent({ ...newEvent, title: e.target.value })}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm bg-white"
                    />
                    <textarea
                      data-testid="event-description-input"
                      placeholder="Description (optional)"
                      value={newEvent.description}
                      onChange={(e) => setNewEvent({ ...newEvent, description: e.target.value })}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm bg-white"
                      rows="2"
                    />

                    {/* Sections (first so slot availability is meaningful) */}
                    <div>
                      <label className="text-xs text-slate-700 font-semibold mb-1.5 block">Target Sections</label>
                      <div className="grid grid-cols-5 gap-1">
                        {SECTIONS.map(s => (
                          <label key={s} data-testid={`event-section-${s}`} className={`flex items-center justify-center gap-1 text-xs cursor-pointer rounded-md py-1.5 border transition-colors ${newEvent.sections.includes(s) ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-slate-700 border-slate-200 hover:border-blue-300'}`}>
                            <input type="checkbox" checked={newEvent.sections.includes(s)} onChange={() => toggleSection(s)} className="hidden" />
                            <span className="font-medium">{s}</span>
                          </label>
                        ))}
                      </div>
                    </div>

                    {/* Time slots with availability */}
                    <div>
                      <label className="text-xs text-slate-700 font-semibold mb-1.5 block">
                        Time Slot
                        {newEvent.sections.length > 0 && <span className="text-slate-400 font-normal ml-1">· green = free, red = booked for selected section(s)</span>}
                      </label>
                      <div className="grid grid-cols-2 gap-1.5">
                        {TIME_SLOTS.map(slot => {
                          const isBooked = slotAvailability[slot].booked;
                          const isSelected = newEvent.time === slot && !newEvent.useCustomTime;
                          let cls;
                          if (isSelected) {
                            cls = isBooked ? 'bg-red-600 text-white border-red-600' : 'bg-emerald-600 text-white border-emerald-600';
                          } else if (newEvent.sections.length === 0) {
                            cls = 'bg-white text-slate-700 border-slate-200 hover:border-blue-300';
                          } else {
                            cls = isBooked
                              ? 'bg-red-50 text-red-700 border-red-200 hover:border-red-400'
                              : 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:border-emerald-400';
                          }
                          return (
                            <button
                              key={slot}
                              type="button"
                              data-testid={`event-slot-${slot}`}
                              onClick={() => setNewEvent({ ...newEvent, time: slot, useCustomTime: false })}
                              className={`text-xs font-medium py-2 px-2 rounded-lg border transition-colors ${cls}`}
                            >{slot}</button>
                          );
                        })}
                        <button
                          type="button"
                          data-testid="event-slot-other"
                          onClick={() => setNewEvent({ ...newEvent, useCustomTime: true, time: newEvent.time || '' })}
                          className={`text-xs font-medium py-2 px-2 rounded-lg border transition-colors col-span-2 ${newEvent.useCustomTime ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-slate-700 border-slate-200 hover:border-blue-300'}`}
                        >Other (custom time)…</button>
                      </div>
                      {newEvent.useCustomTime && (
                        <input
                          data-testid="event-time-input"
                          type="time"
                          value={newEvent.time}
                          onChange={(e) => setNewEvent({ ...newEvent, time: e.target.value })}
                          className="mt-2 w-full px-3 py-2 border border-slate-300 rounded-lg text-sm bg-white"
                        />
                      )}
                    </div>

                    <div>
                      <label className="text-xs text-slate-700 font-semibold mb-1.5 block flex items-center gap-1">
                        <MapPin className="w-3 h-3" /> Venue
                      </label>
                      <select
                        data-testid="event-venue-select"
                        value={newEvent.venue}
                        onChange={(e) => setNewEvent({ ...newEvent, venue: e.target.value })}
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm bg-white"
                      >
                        {VENUES.map(v => <option key={v} value={v}>{v}</option>)}
                      </select>
                    </div>

                    <div className="border-t border-blue-200 pt-3">
                      <label className="flex items-center gap-2 text-sm cursor-pointer">
                        <input
                          data-testid="event-repeat-weekly"
                          type="checkbox"
                          checked={newEvent.repeatWeekly}
                          onChange={(e) => setNewEvent({ ...newEvent, repeatWeekly: e.target.checked })}
                          className="w-4 h-4"
                        />
                        <span className="text-slate-700 font-medium">
                          Repeat weekly for this month
                          {newEvent.repeatWeekly && (
                            <span className="text-blue-600 text-xs ml-1">
                              (All {['Sundays','Mondays','Tuesdays','Wednesdays','Thursdays','Fridays','Saturdays'][new Date(selectedDate).getDay()]} this month)
                            </span>
                          )}
                        </span>
                      </label>
                    </div>

                    <div className="flex gap-2">
                      <button
                        data-testid="event-create-btn"
                        onClick={handleAddEvent}
                        disabled={!newEvent.title || !newEvent.time || newEvent.sections.length === 0}
                        className="flex-1 bg-blue-600 text-white py-2 rounded-lg hover:bg-blue-700 text-sm font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {newEvent.repeatWeekly ? 'Create Recurring Events' : 'Create'}
                      </button>
                      <button
                        data-testid="event-cancel-btn"
                        onClick={() => { setShowAddEvent(false); setNewEvent(blankEvent); }}
                        className="px-4 bg-slate-200 text-slate-700 py-2 rounded-lg hover:bg-slate-300 text-sm"
                      >Cancel</button>
                    </div>
                  </div>
                </div>
              )}

              <div className="space-y-2 max-h-96 overflow-y-auto">
                {selectedDateEvents.length === 0 ? (
                  <p data-testid="admin-no-events" className="text-slate-500 text-center py-4 text-sm">No events for this date</p>
                ) : (
                  selectedDateEvents.map(event => (
                    <div key={event.id} data-testid={`admin-event-${event.id}`} className="border border-slate-200 rounded-xl p-3 hover:shadow-md transition-shadow">
                      <div className="flex justify-between items-start">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-blue-700 font-semibold text-sm">{event.time}</span>
                            {event.venue && (
                              <span className="inline-flex items-center gap-1 text-xs bg-blue-50 text-blue-700 px-2 py-0.5 rounded">
                                <MapPin className="w-3 h-3" /> {event.venue}
                              </span>
                            )}
                            {event.source === 'master' && (
                              <span className="text-[10px] uppercase tracking-wide bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded">master</span>
                            )}
                          </div>
                          <h4 className="font-semibold text-slate-900 mt-1">{event.title}</h4>
                          {event.description && <p className="text-slate-600 text-xs mt-1">{event.description}</p>}
                          <div className="flex items-center justify-between mt-1 flex-wrap gap-1">
                            <p className="text-xs text-blue-600">
                              Sec {(event.sections || []).join(', ')}
                            </p>
                            <p className="text-xs text-slate-500">by {event.createdBy}</p>
                          </div>
                        </div>
                        {event.createdBy === currentUser || event.source === 'master' ? (
                          <button
                            data-testid={`admin-delete-${event.id}`}
                            onClick={() => handleDelete(event.id)}
                            className="text-red-500 hover:text-red-700 p-1 ml-2"
                            title="Delete event"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        ) : (
                          <div className="text-slate-300 p-1 ml-2" title="Only the creator can delete this event">
                            <Lock className="w-4 h-4" />
                          </div>
                        )}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>
        </>
        )}
      </div>
    </div>
  );
};

// ---------------- Admin Login ----------------
const AdminLogin = ({ onLogin }) => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  const submit = (e) => {
    e?.preventDefault();
    const match = ADMIN_ACCOUNTS.find(a => a.username === username.trim() && a.password === password);
    if (!match) {
      setError('Invalid username or password.');
      return;
    }
    setError('');
    onLogin(match.username);
  };

  return (
    <div className="min-h-screen bg-white flex flex-col relative overflow-hidden">
      <div className="pointer-events-none absolute -top-32 -left-32 w-96 h-96 rounded-full bg-blue-100/60 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-40 -right-32 w-[28rem] h-[28rem] rounded-full bg-sky-100/60 blur-3xl" />
      <div className="bg-white border-b border-slate-200 relative">
        <div className="max-w-6xl mx-auto flex items-center gap-3 px-6 py-4">
          <div className="inline-flex items-center justify-center w-9 h-9 rounded-xl bg-blue-600">
            <Calendar className="w-5 h-5 text-white" />
          </div>
          <h1 className="text-base font-semibold text-slate-900 tracking-tight">Administration Platform</h1>
        </div>
      </div>
      <div className="flex-1 flex items-center justify-center p-6 relative">
        <form onSubmit={submit} className="bg-white rounded-2xl border border-slate-200 shadow-sm p-8 max-w-md w-full space-y-4">
          <div>
            <h2 className="text-2xl font-semibold text-slate-900 tracking-tight">Administrator Login</h2>
            <p className="text-sm text-slate-500 mt-1">Sign in with your office credentials.</p>
          </div>
          <div>
            <label className="text-xs font-medium text-slate-600 mb-1.5 block">Username</label>
            <input
              data-testid="admin-username-input"
              type="text"
              autoComplete="username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="w-full px-3.5 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-shadow"
              placeholder="e.g. Programme@iimk"
            />
          </div>
          <div>
            <label className="text-xs font-medium text-slate-600 mb-1.5 block">Password</label>
            <input
              data-testid="admin-password-input"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-3.5 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-shadow"
              placeholder="••••••••"
            />
          </div>
          {error && <div data-testid="admin-login-error" className="text-red-600 text-sm">{error}</div>}
          <button
            data-testid="admin-login-submit"
            type="submit"
            className="w-full bg-blue-600 text-white py-2.5 rounded-xl hover:bg-blue-700 font-medium transition-all text-sm shadow-sm shadow-blue-600/20"
          >
            Sign In
          </button>
          <div className="text-xs text-slate-400 pt-3 border-t border-slate-100">
            Authorized offices: Programme Office, Placement Office
          </div>
        </form>
      </div>
    </div>
  );
};

// ---------------- App ----------------
function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<AdminPlatform />} />
        <Route path="/admin" element={<AdminPlatform />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Router>
  );
}

export default App;
