const { query } = require('./config/database');

async function testCompanies() {
  try {
    console.log('🔍 Testing companies table...');
    
    // Check if companies table exists and has data
    const companiesResult = await query('SELECT * FROM companies ORDER BY created_at DESC LIMIT 10');
    console.log('📊 Companies found:', companiesResult.rows.length);
    
    if (companiesResult.rows.length > 0) {
      console.log('📋 Sample companies:');
      companiesResult.rows.forEach((company, index) => {
        console.log(`${index + 1}. ${company.name} (${company.company_code}) - ID: ${company.id}`);
      });
    } else {
      console.log('❌ No companies found in database');
    }
    
    // Check if there are any users with company_admin role
    const adminsResult = await query('SELECT * FROM users WHERE role = $1', ['company_admin']);
    console.log('👥 Company admins found:', adminsResult.rows.length);
    
    if (adminsResult.rows.length > 0) {
      console.log('📋 Sample company admins:');
      adminsResult.rows.forEach((admin, index) => {
        console.log(`${index + 1}. ${admin.full_name} (${admin.email}) - Company ID: ${admin.company_id}`);
      });
    }
    
  } catch (error) {
    console.error('❌ Database test failed:', error.message);
  } finally {
    process.exit(0);
  }
}

testCompanies();
