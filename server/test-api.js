// Quick API test script
const BASE = 'http://localhost:3001';

async function test() {
    // 1. Login
    console.log('\n=== LOGIN ===');
    const loginRes = await fetch(`${BASE}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: 'admin', password: 'admin123' })
    });
    const loginData = await loginRes.json();
    console.log(JSON.stringify(loginData, null, 2));

    if (!loginData.data?.accessToken) {
        console.error('Login failed, aborting');
        process.exit(1);
    }

    const token = loginData.data.accessToken;
    const headers = { Authorization: `Bearer ${token}` };

    // 2. List devices
    console.log('\n=== DEVICES ===');
    const devRes = await fetch(`${BASE}/devices`, { headers });
    console.log(JSON.stringify(await devRes.json(), null, 2));

    // 3. Device info
    console.log('\n=== DEVICE INFO ===');
    const infoRes = await fetch(`${BASE}/devices/METER-001/info`, { headers });
    console.log(JSON.stringify(await infoRes.json(), null, 2));

    // 4. Historical (page 1, limit 3)
    console.log('\n=== HISTORICAL (page 1, limit 3) ===');
    const histRes = await fetch(`${BASE}/data/METER-001/historical?page=1&limit=3`, { headers });
    console.log(JSON.stringify(await histRes.json(), null, 2));

    // 5. Summary
    console.log('\n=== SUMMARY ===');
    const sumRes = await fetch(`${BASE}/data/METER-001/historical/summary`, { headers });
    console.log(JSON.stringify(await sumRes.json(), null, 2));

    // 6. Peak demand
    console.log('\n=== PEAK DEMAND ===');
    const peakRes = await fetch(`${BASE}/insights/METER-001/peak-demand`, { headers });
    console.log(JSON.stringify(await peakRes.json(), null, 2));

    // 7. Energy cost
    console.log('\n=== ENERGY COST ===');
    const costRes = await fetch(`${BASE}/insights/METER-001/energy-cost?unitPrice=0.12`, { headers });
    console.log(JSON.stringify(await costRes.json(), null, 2));

    // 8. Live snapshot
    console.log('\n=== LIVE SNAPSHOT ===');
    const liveRes = await fetch(`${BASE}/data/METER-001/live`, { headers });
    console.log(JSON.stringify(await liveRes.json(), null, 2));

    // 9. Anomalies (just summary)
    console.log('\n=== ANOMALIES (summary only) ===');
    const anomRes = await fetch(`${BASE}/insights/METER-001/anomalies`, { headers });
    const anomData = await anomRes.json();
    console.log(JSON.stringify({
        totalEvents: anomData.data?.totalEvents,
        summary: anomData.data?.summary
    }, null, 2));

    // 10. Consumption
    console.log('\n=== CONSUMPTION (daily, first 3 entries) ===');
    const consRes = await fetch(`${BASE}/data/METER-001/historical/consumption?interval=daily`, { headers });
    const consData = await consRes.json();
    console.log(JSON.stringify({
        interval: consData.data?.interval,
        entries: consData.data?.entries?.slice(0, 3)
    }, null, 2));

    // 11. Admin endpoint
    console.log('\n=== ADMIN STATUS ===');
    const adminRes = await fetch(`${BASE}/admin/status`, { headers });
    console.log(JSON.stringify(await adminRes.json(), null, 2));

    // 12. Refresh token
    console.log('\n=== REFRESH TOKEN ===');
    const refreshRes = await fetch(`${BASE}/auth/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken: loginData.data.refreshToken })
    });
    const refreshData = await refreshRes.json();
    console.log(JSON.stringify({ success: refreshData.success, message: refreshData.message }, null, 2));

    // 13. Viewer role test
    console.log('\n=== VIEWER LOGIN ===');
    const viewerLogin = await fetch(`${BASE}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: 'viewer', password: 'viewer123' })
    });
    const viewerData = await viewerLogin.json();
    console.log(JSON.stringify({ success: viewerData.success, role: viewerData.data?.user?.role }, null, 2));

    // Viewer trying admin endpoint
    console.log('\n=== VIEWER → ADMIN (should fail) ===');
    const viewerAdminRes = await fetch(`${BASE}/admin/status`, {
        headers: { Authorization: `Bearer ${viewerData.data.accessToken}` }
    });
    console.log(JSON.stringify(await viewerAdminRes.json(), null, 2));

    console.log('\n✅ All tests complete!');
}

test().catch(console.error);
