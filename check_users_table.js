const { query } = require('./config/database');

async function checkUsersTable() {
  try {
    console.log('🔍 Checking users table structure...');
    
    // Get column information for users table
    const result = await query(`
      SELECT column_name, data_type, is_nullable 
      FROM information_schema.columns 
      WHERE table_name = 'users' 
      ORDER BY ordinal_position
    `);
    
    console.log('📋 Users table columns:');
    result.rows.forEach(row => {
      console.log(`  - ${row.column_name}: ${row.data_type} (nullable: ${row.is_nullable})`);
    });
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Error checking users table:', error);
    process.exit(1);
  }
}

checkUsersTable();
