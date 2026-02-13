const { query } = require('./config/database');

async function checkVisitorsTableStructure() {
  try {
    console.log('Checking visitors table structure...');
    
    const result = await query(`
      SELECT column_name, data_type, is_nullable 
      FROM information_schema.columns 
      WHERE table_name = 'visitors' 
      ORDER BY ordinal_position;
    `);
    
    console.log('✅ visitors table columns:');
    result.rows.forEach(row => {
      console.log(`  - ${row.column_name} (${row.data_type}, ${row.is_nullable})`);
    });
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Error checking visitors table structure:', error);
    process.exit(1);
  }
}

checkVisitorsTableStructure();
