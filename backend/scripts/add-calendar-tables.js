/**
 * Add Calendar and Booking Tables
 * Extends the database with calendar functionality
 */

const sqlite3 = require('sqlite3').verbose();
const config = require('../config/config');
const logger = require('../utils/logger');

class CalendarDatabaseUpdater {
  constructor() {
    this.dbPath = config.get('database.path');
    this.db = null;
  }

  async addCalendarTables() {
    try {
      console.log('📅 Adding Calendar and Booking Tables...\n');
      
      // Connect to database
      this.db = new sqlite3.Database(this.dbPath, (err) => {
        if (err) {
          console.error('❌ Database connection error:', err.message);
          throw err;
        }
        console.log('✅ Connected to database:', this.dbPath);
      });

      // Add new tables
      await this.createCalendarTables();
      
      // Add sample calendar data
      await this.addSampleCalendarData();
      
      console.log('🎉 Calendar tables added successfully!');
      
    } catch (error) {
      console.error('❌ Calendar setup failed:', error.message);
      throw error;
    } finally {
      if (this.db) {
        this.db.close();
      }
    }
  }

  async createCalendarTables() {
    console.log('📋 Creating calendar tables...');

    const tables = [
      // Calendar settings table
      `CREATE TABLE IF NOT EXISTS calendar_settings (
        id TEXT PRIMARY KEY,
        agent_id TEXT NOT NULL,
        timezone TEXT DEFAULT 'UTC',
        working_hours_start TEXT DEFAULT '09:00',
        working_hours_end TEXT DEFAULT '17:00',
        working_days TEXT DEFAULT '1,2,3,4,5',
        slot_duration INTEGER DEFAULT 30,
        buffer_time INTEGER DEFAULT 15,
        advance_booking_days INTEGER DEFAULT 30,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (agent_id) REFERENCES agents (id)
      )`,

      // Available slots table
      `CREATE TABLE IF NOT EXISTS available_slots (
        id TEXT PRIMARY KEY,
        agent_id TEXT NOT NULL,
        date TEXT NOT NULL,
        start_time TEXT NOT NULL,
        end_time TEXT NOT NULL,
        is_available BOOLEAN DEFAULT 1,
        is_booked BOOLEAN DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (agent_id) REFERENCES agents (id)
      )`,

      // Bookings table
      `CREATE TABLE IF NOT EXISTS bookings (
        id TEXT PRIMARY KEY,
        agent_id TEXT NOT NULL,
        call_id TEXT,
        customer_name TEXT NOT NULL,
        customer_phone TEXT NOT NULL,
        customer_email TEXT,
        slot_id TEXT NOT NULL,
        booking_date TEXT NOT NULL,
        start_time TEXT NOT NULL,
        end_time TEXT NOT NULL,
        service_type TEXT,
        notes TEXT,
        status TEXT DEFAULT 'confirmed',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (agent_id) REFERENCES agents (id),
        FOREIGN KEY (call_id) REFERENCES calls (id),
        FOREIGN KEY (slot_id) REFERENCES available_slots (id)
      )`,

      // Blocked dates/times table
      `CREATE TABLE IF NOT EXISTS blocked_periods (
        id TEXT PRIMARY KEY,
        agent_id TEXT NOT NULL,
        start_date TEXT NOT NULL,
        end_date TEXT NOT NULL,
        start_time TEXT,
        end_time TEXT,
        reason TEXT,
        is_recurring BOOLEAN DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (agent_id) REFERENCES agents (id)
      )`
    ];

    for (const table of tables) {
      await this.runQuery(table);
    }

    console.log('✅ Calendar tables created successfully');
  }

  async addSampleCalendarData() {
    console.log('📝 Adding sample calendar data...');

    // Add calendar settings for sample agents
    const calendarSettings = [
      {
        id: 'calendar-sales-agent',
        agent_id: 'sample-sales-agent',
        timezone: 'America/New_York',
        working_hours_start: '09:00',
        working_hours_end: '17:00',
        working_days: '1,2,3,4,5',
        slot_duration: 30,
        buffer_time: 15,
        advance_booking_days: 30
      },
      {
        id: 'calendar-support-agent',
        agent_id: 'sample-customer-support',
        timezone: 'America/New_York',
        working_hours_start: '08:00',
        working_hours_end: '18:00',
        working_days: '1,2,3,4,5,6',
        slot_duration: 20,
        buffer_time: 10,
        advance_booking_days: 14
      },
      {
        id: 'calendar-appointment-agent',
        agent_id: 'sample-appointment-bot',
        timezone: 'America/New_York',
        working_hours_start: '08:00',
        working_hours_end: '20:00',
        working_days: '1,2,3,4,5,6,7',
        slot_duration: 60,
        buffer_time: 30,
        advance_booking_days: 60
      }
    ];

    for (const setting of calendarSettings) {
      await this.insertCalendarSetting(setting);
    }

    // Generate sample available slots for the next 7 days
    await this.generateSampleSlots();

    console.log('✅ Sample calendar data added successfully');
  }

  async insertCalendarSetting(setting) {
    const sql = `
      INSERT OR REPLACE INTO calendar_settings 
      (id, agent_id, timezone, working_hours_start, working_hours_end, working_days, slot_duration, buffer_time, advance_booking_days)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;

    await this.runQuery(sql, [
      setting.id,
      setting.agent_id,
      setting.timezone,
      setting.working_hours_start,
      setting.working_hours_end,
      setting.working_days,
      setting.slot_duration,
      setting.buffer_time,
      setting.advance_booking_days
    ]);

    console.log(`  ✅ Added calendar settings for agent: ${setting.agent_id}`);
  }

  async generateSampleSlots() {
    console.log('📅 Generating sample available slots...');

    const agents = ['sample-sales-agent', 'sample-customer-support', 'sample-appointment-bot'];
    const today = new Date();

    for (const agentId of agents) {
      // Get calendar settings for this agent
      const settings = await this.getCalendarSettings(agentId);
      if (!settings) continue;

      // Generate slots for next 7 days
      for (let dayOffset = 0; dayOffset < 7; dayOffset++) {
        const date = new Date(today);
        date.setDate(today.getDate() + dayOffset);
        const dateStr = date.toISOString().split('T')[0];
        const dayOfWeek = date.getDay() + 1; // 1 = Monday, 7 = Sunday

        // Check if this day is a working day
        const workingDays = settings.working_days.split(',').map(d => parseInt(d));
        if (!workingDays.includes(dayOfWeek)) continue;

        // Generate time slots
        const startHour = parseInt(settings.working_hours_start.split(':')[0]);
        const endHour = parseInt(settings.working_hours_end.split(':')[0]);
        const slotDuration = settings.slot_duration;

        for (let hour = startHour; hour < endHour; hour++) {
          for (let minute = 0; minute < 60; minute += slotDuration) {
            const startTime = `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`;
            const endMinute = minute + slotDuration;
            const endHourAdjusted = endMinute >= 60 ? hour + 1 : hour;
            const endMinuteAdjusted = endMinute >= 60 ? endMinute - 60 : endMinute;
            const endTime = `${endHourAdjusted.toString().padStart(2, '0')}:${endMinuteAdjusted.toString().padStart(2, '0')}`;

            if (endHourAdjusted > endHour) break;

            const slotId = `slot-${agentId}-${dateStr}-${startTime.replace(':', '')}`;
            
            await this.runQuery(`
              INSERT OR REPLACE INTO available_slots 
              (id, agent_id, date, start_time, end_time, is_available, is_booked)
              VALUES (?, ?, ?, ?, ?, 1, 0)
            `, [slotId, agentId, dateStr, startTime, endTime]);
          }
        }
      }

      console.log(`  ✅ Generated slots for agent: ${agentId}`);
    }
  }

  async getCalendarSettings(agentId) {
    return new Promise((resolve, reject) => {
      this.db.get(
        'SELECT * FROM calendar_settings WHERE agent_id = ?',
        [agentId],
        (err, row) => {
          if (err) reject(err);
          else resolve(row);
        }
      );
    });
  }

  runQuery(sql, params = []) {
    return new Promise((resolve, reject) => {
      this.db.run(sql, params, function(err) {
        if (err) {
          console.error('❌ Database query error:', err.message);
          reject(err);
        } else {
          resolve({ id: this.lastID, changes: this.changes });
        }
      });
    });
  }
}

// Run the update if this file is executed directly
if (require.main === module) {
  const updater = new CalendarDatabaseUpdater();
  updater.addCalendarTables()
    .then(() => {
      console.log('\n🎉 Calendar setup completed successfully!');
      console.log('📅 Your AI agents now support calendar and booking functionality!');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n❌ Calendar setup failed:', error.message);
      process.exit(1);
    });
}

module.exports = CalendarDatabaseUpdater;
