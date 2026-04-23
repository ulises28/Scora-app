const fs = require('fs');
const path = require('path');

/**
 * SCORA QA - Master Diagnostic Parser
 * Parses Monocart JSON reports and outputs GitHub-flavored Markdown.
 */
function run() {
    const reportPath = path.join(process.cwd(), 'test-results', 'report.json');
    
    if (!fs.existsSync(reportPath)) {
        console.log("❌ No report.json found at " + reportPath);
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
            if (r.caseType) typeDiscovery.add(r.caseType);

            // Flexible matching for Monocart failures
            const isFailed = r.status === 'failed' || r.status === 'error';
            const isTestCase = r.type === 'case' || r.caseType === 'test';

            if (isFailed && isTestCase) {
                failedTests.push(r);
            }
            if (r.children) findFailed(r.children);
        });
    }

    findFailed(report.rows);

    if (failedTests.length === 0) {
        console.log("### 🔍 Failure Diagnosis Summary");
        console.log("⚠️ Build failed, but no individual test failures were identified in report.rows.");
        console.log("\n**Discovery Metadata**:");
        console.log("- Found Statuses: " + Array.from(statusDiscovery).join(', '));
        console.log("- Found Types: " + Array.from(typeDiscovery).join(', '));
        
        if (report.rows && report.rows.length > 0) {
            console.log("- Row Schema: `" + Object.keys(report.rows[0]).join(', ') + "`");
        }
    } else {
        console.log("### 🔍 Failure Diagnosis Summary");
        console.log("| Test Case | Error Snippet | Location |");
        console.log("|:----------|:--------------|:---------|");
        
        failedTests.forEach(t => {
            const errorMsg = (t.errors?.[0]?.message || t.results?.[0]?.error?.message || 'Check logs for details');
            const cleanError = errorMsg.split('\n')[0].replace(/\|/g, '-').trim().slice(0, 150);
            const location = t.location ? (t.location.file + ':' + t.location.line) : 'Unknown';
            console.log("| " + t.title + " | " + cleanError + "... | " + location + " |");
        });
    }
}

run();
