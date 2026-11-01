import http from 'k6/http';
import { check, sleep } from 'k6';

export const options = {
  stages: [
    { duration: '30s', target: 20 }, // Ramp up to 20 users
    { duration: '1m', target: 50 },  // Stay at 50 users
    { duration: '30s', target: 100 }, // Spike to 100 users
    { duration: '30s', target: 0 },   // Ramp down
  ],
  thresholds: {
    http_req_duration: ['p(95)<500'], // 95% requests should be below 500ms
    http_req_failed: ['rate<0.01'],    // Error rate must be under 1%
  },
};

const BASE_URL = __ENV.API_BASE_URL || 'http://localhost:3000/api/v1';

export default function () {
  // 1. Health check
  const healthRes = http.get(`${BASE_URL}/health`);
  check(healthRes, {
    'health status is 200': (r) => r.status === 200,
  });

  // 2. User Login
  const loginPayload = JSON.stringify({
    email: 'linh.nguyen@meetcall.local',
    password: 'Password123!',
  });

  const loginRes = http.post(`${BASE_URL}/auth/login`, loginPayload, {
    headers: { 'Content-Type': 'application/json' },
  });

  const loginSuccess = check(loginRes, {
    'login status is 200': (r) => r.status === 200,
    'has access token': (r) => JSON.parse(r.body).accessToken !== undefined,
  });

  if (!loginSuccess) {
    sleep(1);
    return;
  }

  const token = JSON.parse(loginRes.body).accessToken;
  const authHeaders = {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${token}`,
  };

  // 3. Discovery Candidates (PostGIS ST_DWithin query)
  const discoverRes = http.get(`${BASE_URL}/discover?limit=10`, { headers: authHeaders });
  check(discoverRes, {
    'discover status is 200': (r) => r.status === 200,
    'candidates returned': (r) => Array.isArray(JSON.parse(r.body)),
  });

  // 4. Random Call Eligibility Check
  const randomRes = http.get(`${BASE_URL}/random/eligibility`, { headers: authHeaders });
  check(randomRes, {
    'eligibility status is 200 or 403': (r) => [200, 403].includes(r.status),
  });

  // 5. Matches list
  const matchesRes = http.get(`${BASE_URL}/matches`, { headers: authHeaders });
  check(matchesRes, {
    'matches status is 200': (r) => r.status === 200,
  });

  sleep(1);
}
