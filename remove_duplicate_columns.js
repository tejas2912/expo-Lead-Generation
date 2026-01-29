const { query } = require('./config/database');

async function removeDuplicateColumns() {
  try {
    console.log('Removing duplicate visitor columns from visitor_leads table...');
    
    // Remove columns that should only exist in visitors table
    const columnsToRemove = [
      'organization',
      'designation', 
      'city',
      'country',
      'interests'
    ];
    
    for (const column of columnsToRemove) {
      try {
        await query(`ALTER TABLE visitor_leads DROP COLUMN IF EXISTS ${column};`);
        console.log(`✅ Removed column: ${column}`);
      } catch (error) {
        console.log(`⚠️ Column ${column} may not exist or cannot be dropped: ${error.message}`);
      }
    }
    
    console.log('✅ All duplicate columns removed successfully!');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error removing columns:', error);
    process.exit(1);
  }
}

removeDuplicateColumns();
