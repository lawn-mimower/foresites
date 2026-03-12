const axios = require('axios');

const API_BASE = 'http://localhost:9999/api';

async function testAuthFlow() {
  console.log('🧪 Testing Authentication Flow...\n');

  try {
    // Test 1: Health check (should work without auth)
    console.log('1. Testing health check (public endpoint)...');
    const healthResponse = await axios.get(`${API_BASE}/dashboard/health`);
    console.log('✅ Health check passed:', healthResponse.data);

    // Test 2: Try to access protected endpoint without auth (should fail)
    console.log('\n2. Testing protected endpoint without auth...');
    try {
      await axios.get(`${API_BASE}/dashboard/feedbacks`);
      console.log('❌ This should have failed!');
    } catch (error) {
      if (error.response?.status === 401) {
        console.log('✅ Protected endpoint correctly rejected unauthorized access');
      } else {
        console.log('❌ Unexpected error:', error.response?.status, error.response?.data);
      }
    }

    // Test 3: Login with super admin credentials
    console.log('\n3. Testing login with super admin credentials...');
    const loginResponse = await axios.post(`${API_BASE}/auth/login`, {
      email: 'admin@mdconsultants.com',
      password: 'SuperAdmin123!'
    });
    
    if (loginResponse.data.token) {
      console.log('✅ Login successful');
      console.log('User:', loginResponse.data.user.username, '- Role:', loginResponse.data.user.role);
      
      const token = loginResponse.data.token;

      // Test 4: Access protected endpoint with valid token
      console.log('\n4. Testing protected endpoint with valid token...');
      const protectedResponse = await axios.get(`${API_BASE}/dashboard/feedbacks`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      console.log('✅ Protected endpoint accessible with valid token');
      console.log('Feedbacks count:', Array.isArray(protectedResponse.data) ? protectedResponse.data.length : 'N/A');

      // Test 5: Test admin-only endpoint
      console.log('\n5. Testing admin-only endpoint...');
      try {
        const adminResponse = await axios.get(`${API_BASE}/auth/users`, {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });
        console.log('✅ Admin endpoint accessible');
        console.log('Users count:', adminResponse.data.users?.length || 0);
      } catch (error) {
        console.log('❌ Admin endpoint failed:', error.response?.status, error.response?.data);
      }

      // Test 6: Test logout
      console.log('\n6. Testing logout...');
      const logoutResponse = await axios.post(`${API_BASE}/auth/logout`, {}, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      console.log('✅ Logout successful:', logoutResponse.data.message);

    } else {
      console.log('❌ Login failed - no token received');
    }

  } catch (error) {
    console.error('❌ Test failed:', error.response?.data || error.message);
  }

  console.log('\n🏁 Authentication flow test completed!');
}

// Run the test
testAuthFlow();
