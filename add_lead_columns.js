const { query } = require('./config/database');

async function addLeadColumns() {
  try {
    console.log('Adding priority and tags columns to visitor_leads table...');
    
    // Add priority column
    const priorityResult = await query('ALTER TABLE visitor_leads ADD COLUMN IF NOT EXISTS priority VARCHAR(20);');
    console.log('✅ Priority column added');
    
    // Add tags column
    const tagsResult = await query('ALTER TABLE visitor_leads ADD COLUMN IF NOT EXISTS tags TEXT;');
    console.log('✅ Tags column added');
    
    console.log('✅ All columns added successfully!');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error adding columns:', error);
    process.exit(1);
  }
}

addLeadColumns();
