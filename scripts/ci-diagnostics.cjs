const fs = require('fs');
const path = require('path');

/**
 * SCORA QA - Master Diagnostic Parser
 * Parses Monocart JSON reports and outputs GitHub-flavored Markdown.
 */
function run() {
    const reportPath = path.join(process.cwd(), 'test-results', 'report.json');
    
    if (!fs.existsSync(reportPath)) {
        console.log("### 🚨 CRITICAL: Test Report Missing");
        console.log("> **Diagnosis**: The E2E environment likely crashed or timed out before generating results.");
        console.log("> **Action**: Check the 'Run E2E Tests' logs for Vercel or Docker errors.");
        return;
    }

    let report;
    try {
        report = JSON.parse(fs.readFileSync(reportPath, 'utf8'));
    } catch (e) {
        console.log("❌ Failed to parse report.json: " + e.message);
        return;
    }

    const failedTests = [];
    const statusDiscovery = new Set();
    const typeDiscovery = new Set();

    function findFailed(rows) {
        if (!rows || !Array.isArray(rows)) return;
        rows.forEach(r => {
            if (r.status) statusDiscovery.add(r.status);
            if (r.type) typeDiscovery.add(r.type);

            // Monocart Status check
            const isFailed = r.status === 'failed' || r.status === 'error';
            // In Monocart, case nodes are often type 'case' or have caseType defined
            const isTestCase = r.type === 'case' || r.caseType === 'test' || r.caseNum > 0;

            if (isFailed && isTestCase && r.title) {
                failedTests.push(r);
            }
            
            // 🛠️ THE FIX: Monocart uses 'subs' for nested suites/tests
            if (r.subs) findFailed(r.subs);
            if (r.children) findFailed(r.children);
        });
    }

    findFailed(report.rows);

    if (failedTests.length === 0) {
        console.log("### ✅ E2E Test Summary");
        console.log("#### **STATUS: 100% PASS**");
        console.log("The Scora Integrity Engine has verified all rendering matrices. No regressions detected.");
        
        const totalTests = report.summary?.stats?.total || 'Verified';
        console.log("\n| Metric | Result |");
        console.log("|:-------|:-------|");
        console.log("| Total Tests | " + totalTests + " |");
        console.log("| Failures | 0 |");
        console.log("| Environment | Docker (Linux) |");
    } else {
        console.log("### 🔍 Failure Diagnosis Summary");
        console.log("| Test Case | Error Snippet | Location |");
        console.log("|:----------|:--------------|:---------|");
        
        failedTests.forEach(t => {
            // Monocart keeps errors in an array 'errors' or results[0].error
            const errorObj = (t.errors && t.errors[0]) || (t.results && t.results[0] && t.results[0].error);
            const errorMsg = errorObj?.message || 'Check detailed report';
            const cleanError = errorMsg.split('\n')[0].replace(/\|/g, '-').trim().slice(0, 150);
            const location = t.location ? (t.location.file + ':' + t.location.line) : 'Unknown';
            console.log("| " + t.title + " | " + cleanError + "... | " + location + " |");
        });
    }
}

run();
