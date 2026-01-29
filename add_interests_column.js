const { query } = require('./config/database');

async function addInterestsColumn() {
  try {
    console.log('Adding interests column to visitors table...');
    
    const result = await query('ALTER TABLE visitors ADD COLUMN IF NOT EXISTS interests TEXT;');
    
    console.log('✅ Interests column added successfully!');
    console.log('Result:', result);
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Error adding interests column:', error);
    process.exit(1);
  }
}

addInterestsColumn();
