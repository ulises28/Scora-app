const fs = require('fs');
const path = require('path');

/**
 * SCORA QA - Master Diagnostic Parser
 * Parses Monocart JSON reports and outputs GitHub-flavored Markdown.
 */
function run() {
    const reportPath = path.join(process.cwd(), 'test-results', 'report.json');
    
    // 🕵️ Debug: Log what we are looking for
    // console.log(`Searching for report at: ${reportPath}`);

    if (!fs.existsSync(reportPath)) {
        console.log("### 🚨 INFRASTRUCTURE CRASH DETECTED");
        console.log("> **DIAGNOSIS**: No test report was found. The engine likely crashed before the tests could start.");
        console.log("> **PROBABLE CAUSE**: WebServer failure (Vercel/Vite) or Docker resource exhaustion.");
        return;
    }

    let report;
    try {
        report = JSON.parse(fs.readFileSync(reportPath, 'utf8'));
    } catch (e) {
        console.log("### 🚨 CORRUPT REPORT DETECTED");
        console.log("> **DIAGNOSIS**: The report.json exists but is invalid or empty.");
        return;
    }

    const failedTests = [];

    // --- PLAYWRIGHT NATIVE PARSER ---
    function traverse(suite) {
        if (suite.suites) suite.suites.forEach(s => traverse(s));
        if (suite.specs) {
            suite.specs.forEach(spec => {
                spec.tests.forEach(test => {
                    const isFailed = test.results.some(r => r.status === 'failed' || r.status === 'timedOut' || r.status === 'interrupted');
                    if (isFailed) {
                        failedTests.push({
                            title: spec.title,
                            file: spec.file,
                            line: spec.line,
                            projectName: test.projectName,
                            results: test.results,
                            error: test.results.find(r => r.error)?.error || test.results[0].error
                        });
                    }
                });
            });
        }
    }

    if (report.suites && report.suites.length > 0) {
        report.suites.forEach(s => traverse(s));
    } else {
        // ⚠️ THE CRITICAL FIX: If we have a file but NO tests, it's a crash!
        console.log("### 🚨 INFRASTRUCTURE SILENCE");
        console.log("> **DIAGNOSIS**: The report exists but contains **zero** test results.");
        console.log("> **PROBABLE CAUSE**: Playwright was aborted early (likely by a WebServer error).");
        return;
    }

    // --- rest of the logic ---

    // --- SMART TRIAGE INTEGRATION ---
    const triagePath = path.join(process.cwd(), 'test-results', 'TRIAGE_SIGNAL.json');
    let triage = { drift_detected: false };
    if (fs.existsSync(triagePath)) {
        try { triage = JSON.parse(fs.readFileSync(triagePath, 'utf8')); } catch(e) {}
    }

    let infraErrorDetected = false;
    failedTests.forEach(t => {
        const error = t.error;
        if (error && (JSON.stringify(error).includes('browserType.launch') || JSON.stringify(error).includes('Executable doesn\'t exist'))) {
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
        console.log("> **DIAGNOSIS**: Functional regressions detected in UI or API logic.");
    } else {
        console.log("> **STATUS**: ✅ **ALL SYSTEMS NOMINAL**");
    }
    console.log("\n---");

    if (failedTests.length === 0) {
        console.log("### ✅ E2E Test Summary");
        console.log("#### **STATUS: 100% PASS**");
        console.log("The Scora Integrity Engine has verified all rendering matrices. No regressions detected.");
        
        const stats = report.stats || {};
        console.log("\n| Metric | Result |");
        console.log("|:-------|:-------|");
        console.log("| Total Tests | " + (stats.expected || 'Verified') + " |");
        console.log("| Failures | 0 |");
        console.log("| Environment | Docker (Linux) |");
    } else {
        console.log("### 🔍 Failure Diagnosis Summary");
        console.log("| Project | Test Case | Error Snippet | Location |");
        console.log("|:--------|:----------|:--------------|:---------|");
        
        failedTests.forEach(t => {
            const errorMsg = t.error ? (t.error.message || 'Check detailed report') : 'No explicit error found';
            
            // Clean up the error for the table
            const cleanError = errorMsg
                .split('\n')[0]
                .replace(/\|/g, '-')
                .replace(/[\u001b\u009b][[()#;?]*(?:[0-9]{1,4}(?:;[0-9]{0,4})*)?[0-9A-ORZcf-nqry=><]/g, '')
                .trim()
                .slice(0, 80);
            
            const locStr = `${path.basename(t.file)}:${t.line || '?'}`;
            console.log(`| ${t.projectName} | ${t.title} | ${cleanError}${errorMsg.length > 80 ? '...' : ''} | ${locStr} |`);
        });

        // 🚀 PRO-TIP: Output the first 3 full error stacks for immediate debugging
        console.log("\n### 🛠️ Quick Debug (Top Failures)");
        failedTests.slice(0, 3).forEach((t, i) => {
            if (t.error && t.error.stack) {
                console.log(`<details><summary><b>${i+1}. ${t.title}</b></summary>\n\n\`\`\`text\n${t.error.stack.replace(/[\u001b\u009b][[()#;?]*(?:[0-9]{1,4}(?:;[0-9]{0,4})*)?[0-9A-ORZcf-nqry=><]/g, '')}\n\`\`\`\n</details>`);
            }
        });

        // 💡 Smart Troubleshooting Tips
        const tips = new Set();
        failedTests.forEach(t => {
            const errorMsg = t.error ? (t.error.message || '') : '';
            const errorStack = t.error ? (t.error.stack || '') : '';
            const combined = (errorMsg + '\n' + errorStack).toLowerCase();
            
            if (combined.includes('havescreenshot') || combined.includes('snapshot') || combined.includes('diff')) {
                tips.add(`📸 **Visual Drift / Missing Snapshot**: A snapshot mismatch or missing baseline snapshot was detected. You can auto-update baseline snapshots by running this workflow manually via **workflow_dispatch** with the **update_snapshots** parameter set to \`true\`.`);
            }
            if (combined.includes('waitfordrawsettled') || combined.includes('_scoraissettled') || combined.includes('waitforfunction') || combined.includes('timeout')) {
                tips.add(`⏳ **Timeout / Render Slowdown**: The canvas failed to settle in time. This is usually caused by container resource throttling in GitHub Actions. We have tuned timeouts to be environment-aware, but if this persists, verify the runner CPU load.`);
            }
            if (combined.includes('vercel') || combined.includes('env pull') || combined.includes('credentials')) {
                tips.add(`🔑 **Vercel Credentials**: The test failed accessing Vercel dev variables. Make sure \`VERCEL_TOKEN\`, \`VERCEL_ORG_ID\`, and \`VERCEL_PROJECT_ID\` secrets are set in your GitHub repository secrets.`);
            }
        });

        if (tips.size > 0) {
            console.log("\n### 💡 Smart Troubleshooting Tips");
            tips.forEach(tip => console.log(`- ${tip}`));
        }
    }
}

try {
    run();
} catch (e) {
    console.log("### 🚨 QA Triage Diagnostic Failure");
    console.log("> **ERROR**: The diagnostic script encountered an internal error while parsing results.");
    console.log(`> **DETAILS**: ${e.message}`);
    console.log("\n---");
    console.log("#### 🛠️ Manual Intervention Required");
    console.log("Please check the **'Run E2E Tests'** raw logs for the underlying failure cause.");
}
