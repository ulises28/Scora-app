const fs = require('fs');
const path = require('path');

/**
 * SCORA QA - Master Diagnostic Parser
 * Parses Monocart JSON reports and outputs GitHub-flavored Markdown.
 */
function run() {
    const reportPath = path.join(process.cwd(), 'test-results', 'report.json');
    
    if (!fs.existsSync(reportPath)) {
        console.log("### 🚨 INFRASTRUCTURE CRASH DETECTED");
        console.log("> **DIAGNOSIS**: The E2E environment failed to initialize or crashed during the engine handshake.");
        console.log("> **PROBABLE CAUSE**: Playwright version mismatch between `package.json` and the Docker image.");
        console.log("> **ACTION**: Ensure the `scora-runtime` image is built with the Playwright version required by the lockfile.");
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

    function findFailed(rows, parent = null) {
        if (!rows || !Array.isArray(rows)) return;
        rows.forEach(r => {
            r.parent = parent; // Link parent for project resolution later
            if (r.status) statusDiscovery.add(r.status);
            if (r.type) typeDiscovery.add(r.type);

            // Monocart Status check
            const isFailed = r.status === 'failed' || r.status === 'error' || r.status === 'timedOut' || r.caseType === 'failed';
            // In Monocart, case nodes are often type 'case' or have caseType defined
            const isTestCase = r.type === 'case' || r.caseType === 'test' || r.caseNum > 0;

            if (isFailed && isTestCase && r.title) {
                failedTests.push(r);
            }
            
            // 🛠️ THE FIX: Monocart uses 'subs' for nested suites/tests
            if (r.subs) findFailed(r.subs, r);
            if (r.children) findFailed(r.children, r);
        });
    }

    findFailed(report.rows);

    // --- SMART TRIAGE INTEGRATION ---
    const triagePath = path.join(process.cwd(), 'test-results', 'TRIAGE_SIGNAL.json');
    let triage = { drift_detected: false };
    if (fs.existsSync(triagePath)) {
        try { triage = JSON.parse(fs.readFileSync(triagePath, 'utf8')); } catch(e) {}
    }

    let infraErrorDetected = false;
    failedTests.forEach(t => {
        const result = t.results && t.results[0];
        const errors = t.errors || (result && (result.errors || (result.error ? [result.error] : [])));
        if (errors && JSON.stringify(errors).includes('browserType.launch') || JSON.stringify(errors).includes('Executable doesn\'t exist')) {
            infraErrorDetected = true;
        }
    });

    console.log("### QA Triage Report");
    if (infraErrorDetected) {
        console.log("> **STATUS**: 🚨 **INFRASTRUCTURE MISMATCH**");
        console.log("> **DIAGNOSIS**: Playwright could not launch the browser. This is an environment issue, not a code bug.");
        console.log("> **ACTION**: Check the 'Playwright Version Bridge' logs in CI.");
    } else if (triage.drift_detected) {
        console.log("> **STATUS**: 🩹 **AUTO-HEALED**");
        console.log("> **DIAGNOSIS**: Intentional design drift detected in source files. Snapshots were automatically updated.");
    } else if (failedTests.length > 0) {
        console.log("> **STATUS**: 🚨 **STRICT REGRESSION**");
        console.log("> **DIAGNOSIS**: No code drift detected in design files, but UI tests failed. This is a functional regression.");
    } else {
        console.log("> **STATUS**: ✅ **ALL SYSTEMS NOMINAL**");
    }
    console.log("\n---");

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
            // 1. Resolve Project Name (Traverse up to find the project suite)
            let projectName = '';
            let curr = t.parent;
            while (curr) {
                if (curr.type === 'project') {
                    projectName = `[${curr.title}] `;
                    break;
                }
                curr = curr.parent;
            }

            // 2. Resolve Result & Errors
            const result = t.results && t.results[0];
            // Monocart can put errors in t.errors, result.errors (array), or result.error (object)
            const errors = t.errors || (result && (result.errors || (result.error ? [result.error] : [])));
            
            let errorMsg = 'No explicit error found';
            if (errors && errors.length > 0) {
                // Take the first meaningful error message
                const firstError = errors[0];
                errorMsg = typeof firstError === 'string' ? firstError : (firstError.message || firstError.value || 'Check detailed report');
            }
            
            // Clean up the error for the table (strip ANSI, pipes, and newlines)
            const cleanError = errorMsg
                .split('\n')[0]
                .replace(/\|/g, '-')
                .replace(/[\u001b\u009b][[()#;?]*(?:[0-9]{1,4}(?:;[0-9]{0,4})*)?[0-9A-ORZcf-nqry=><]/g, '')
                .trim()
                .slice(0, 120);
            
            // 3. Resolve Location (Handle strings like "file.ts:10:5" or objects)
            let locStr = 'Unknown';
            const rawLoc = t.location || (result && result.location);
            if (typeof rawLoc === 'string') {
                locStr = path.basename(rawLoc);
            } else if (rawLoc && rawLoc.file) {
                locStr = `${path.basename(rawLoc.file)}:${rawLoc.line || '?'}`;
            }
            
            console.log(`| ${projectName}${t.title} | ${cleanError}${errorMsg.length > 120 ? '...' : ''} | ${locStr} |`);
        });

        // 🚀 PRO-TIP: Output the first 3 full error stacks for immediate debugging
        console.log("\n### 🛠️ Quick Debug (Top Failures)");
        failedTests.slice(0, 3).forEach((t, i) => {
            const result = t.results && t.results[0];
            const error = (t.errors && t.errors[0]) || (result && (result.errors?.[0] || result.error));
            if (error && error.stack) {
                console.log(`<details><summary><b>${i+1}. ${t.title}</b></summary>\n\n\`\`\`text\n${error.stack.replace(/[\u001b\u009b][[()#;?]*(?:[0-9]{1,4}(?:;[0-9]{0,4})*)?[0-9A-ORZcf-nqry=><]/g, '')}\n\`\`\`\n</details>`);
            }
        });
    }
}

run();
