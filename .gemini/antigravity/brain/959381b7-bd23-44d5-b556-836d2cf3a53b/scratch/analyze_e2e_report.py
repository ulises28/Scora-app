import json
import os

report_path = '/Users/ulises/Developer/Scora-app/test-results/report.json'

def analyze_report():
    if not os.path.exists(report_path):
        print(f"Error: {report_path} not found.")
        return

    with open(report_path, 'r') as f:
        data = json.load(f)

    # Scora E2E Report Analyzer
    stats = {
        'total': 0,
        'failed': [],
        'passed': 0,
        'errors': {}
    }

    # Monocart structured report data is in 'rows'
    for row in data.get('rows', []):
        process_row(row, stats)

    print(f"\n--- E2E FAILURE SUMMARY ---")
    print(f"Total Tests: {stats['total']}")
    print(f"Passed: {stats['passed']}")
    print(f"Failures: {len(stats['failed'])}")
    
    print("\n--- TOP ERROR MESSAGES ---")
    sorted_errors = sorted(stats['errors'].items(), key=lambda x: x[1], reverse=True)
    for error_text, count in sorted_errors[:10]:
        print(f"[{count}x]: {error_text[:200]}...")

    print("\n--- TOP FAILING TESTS ---")
    for failure in stats['failed'][:15]:
        print(f"- {failure['title']} ({failure['location']})")

def process_row(row, stats):
    # If it's a test case
    if row.get('type') == 'case':
        stats['total'] += 1
        if row.get('ok'):
            stats['passed'] += 1
        else:
            stats['failed'].append({
                'title': row.get('title'),
                'location': row.get('location')
            })
            # Collect error
            err = row.get('error', {}).get('message', 'No message')
            short_err = err.split('\n')[0]
            stats['errors'][short_err] = stats['errors'].get(short_err, 0) + 1
    
    # Process nested subs (for suites/projects)
    for sub in row.get('subs', []):
        process_row(sub, stats)

if __name__ == "__main__":
    analyze_report()
