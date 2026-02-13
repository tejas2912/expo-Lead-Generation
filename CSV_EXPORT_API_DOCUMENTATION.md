# CSV Export API Documentation

## Endpoint
```
GET /api/leads/export/csv
```

## Headers
```
Authorization: Bearer <token>
Content-Type: application/json
```

## Query Parameters
All parameters are optional. Only include the ones you want to filter by.

### For Platform Admin:
- `company_id` (UUID): Filter by specific company
- `date_from` (YYYY-MM-DD): Filter leads from this date
- `date_to` (YYYY-MM-DD): Filter leads until this date  
- `search` (string): Search by visitor name, phone, or email
- `status` (string): Filter by lead status
- `employee_id` (UUID): Filter by specific employee

### For Company Admin:
- `date_from` (YYYY-MM-DD): Filter leads from this date
- `date_to` (YYYY-MM-DD): Filter leads until this date
- `search` (string): Search by visitor name, phone, or email
- `status` (string): Filter by lead status
- `employee_id` (UUID): Filter by specific employee (all employees + individual options)

### For Employee:
- `date_from` (YYYY-MM-DD): Filter leads from this date
- `date_to` (YYYY-MM-DD): Filter leads until this date
- `search` (string): Search by visitor name, phone, or email
- `status` (string): Filter by lead status
- (Only their own leads will be returned automatically)

## Example Requests

### Export All Leads (Platform Admin)
```javascript
fetch('http://localhost:5000/api/leads/export/csv', {
  headers: {
    'Authorization': 'Bearer ' + token,
    'Content-Type': 'application/json'
  }
})
```

### Export with Date Range Filter
```javascript
const params = new URLSearchParams({
  date_from: '2024-01-01',
  date_to: '2024-12-31'
});

fetch(`http://localhost:5000/api/leads/export/csv?${params.toString()}`, {
  headers: {
    'Authorization': 'Bearer ' + token,
    'Content-Type': 'application/json'
  }
})
```

### Export with Company Filter (Platform Admin)
```javascript
const params = new URLSearchParams({
  company_id: 'aa93e95e-4a7f-4cc7-b82e-6955a252de30',
  date_from: '2024-01-01'
});

fetch(`http://localhost:5000/api/leads/export/csv?${params.toString()}`, {
  headers: {
    'Authorization': 'Bearer ' + token,
    'Content-Type': 'application/json'
  }
})
```

### Export with Employee Filter (Company Admin)
```javascript
const params = new URLSearchParams({
  employee_id: 'employee-uuid-here',
  search: 'john'
});

fetch(`http://localhost:5000/api/leads/export/csv?${params.toString()}`, {
  headers: {
    'Authorization': 'Bearer ' + token,
    'Content-Type': 'application/json'
  }
})
```

## Response

### Success (200 OK)
- **Content-Type**: `text/csv`
- **Content-Disposition**: `attachment; filename="leads-export-YYYY-MM-DD.csv"`
- **Body**: CSV file content

### Error Responses
- **400 Bad Request**: Invalid parameters
- **401 Unauthorized**: Invalid or missing token
- **404 Not Found**: No leads found for specified filters
- **500 Internal Server Error**: Server error

## CSV Columns
The exported CSV includes the following columns:

| Column | Description |
|---------|-------------|
| Lead ID | Unique identifier for the lead |
| Lead Date | When the lead was created |
| Visitor Name | Full name of the visitor |
| Visitor Phone | Phone number of the visitor |
| Visitor Email | Email address of the visitor |
| Organization | Visitor's organization/company |
| Designation | Visitor's job designation |
| City | Visitor's city |
| Country | Visitor's country |
| Employee Name | Name of employee who captured the lead |
| Employee Email | Email of employee who captured the lead |
| Company Name | Name of the company |
| Notes | Additional notes about the lead |
| Follow-up Date | Scheduled follow-up date |
| Interests | Lead interest level (Hot/Warm/Cold) |
| Status | Current lead status |

## Frontend Implementation Example

### React Component
```javascript
const handleExportCSV = async () => {
  try {
    const params = new URLSearchParams({
      ...(dateFrom && { date_from: dateFrom }),
      ...(dateTo && { date_to: dateTo }),
      ...(selectedEmployee && { employee_id: selectedEmployee }),
      ...(selectedCompany && { company_id: selectedCompany }),
      ...(searchTerm && { search: searchTerm })
    });
    
    const response = await fetch(`${API_BASE_URL}/leads/export/csv?${params.toString()}`, {
      headers: {
        'Authorization': `Bearer ${localStorage.getItem('token')}`,
        'Content-Type': 'application/json',
      },
    });
    
    if (response.ok) {
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `leads-export-${new Date().toISOString().split('T')[0]}.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
    } else {
      alert('Failed to export CSV');
    }
  } catch (error) {
    console.error('Export error:', error);
    alert('Failed to export CSV');
  }
};
```

### Filter State Management
```javascript
const [filters, setFilters] = useState({
  dateFrom: '',
  dateTo: '',
  selectedEmployee: '',
  selectedCompany: '',
  searchTerm: ''
});

// Update filters
const updateFilters = (newFilters) => {
  setFilters(newFilters);
  // Refetch data with new filters
};
```

## Important Notes

1. **Authentication Required**: All requests must include valid JWT token
2. **Role-based Access**: Users can only export leads they have access to
3. **Filtered Export**: Only returns leads matching the applied filters
4. **File Download**: Response is configured as file download
5. **Timestamp**: Filename includes current date
6. **UTF-8 Encoding**: CSV supports special characters
