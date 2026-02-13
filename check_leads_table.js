const { query } = require('./config/database');

async function checkLeadsTableStructure() {
  try {
    console.log('Checking visitor_leads table structure...');
    
    const result = await query(`
      SELECT column_name, data_type, is_nullable 
      FROM information_schema.columns 
      WHERE table_name = 'visitor_leads' 
      ORDER BY ordinal_position;
    `);
    
    console.log('✅ visitor_leads table columns:');
    result.rows.forEach(row => {
      console.log(`  - ${row.column_name} (${row.data_type}, ${row.is_nullable})`);
    });
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Error checking visitor_leads table structure:', error);
    process.exit(1);
  }
}

checkLeadsTableStructure();
