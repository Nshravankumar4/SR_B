# ==============================================================================
# SR BROKERAGE LEDGER - SHIPMENT CONTROL CENTRE DASHBOARD VERIFICATION SUITE
# Verifies Dashboard Layout, Click-to-Filter Synchronization, Action Cards & Table
# ==============================================================================

$ErrorActionPreference = "Stop"
$passed = 0
$failed = 0

function Assert-Check([string]$name, [bool]$condition, [string]$detail = "") {
    if ($condition) {
        Write-Host " [PASS] $name" -ForegroundColor Green
        $script:passed++
    } else {
        Write-Host " [FAIL] $name - $detail" -ForegroundColor Red
        $script:failed++
    }
}

Write-Host "`n========================================================" -ForegroundColor Cyan
Write-Host "  SR BROKERAGE LEDGER - SHIPMENT CONTROL CENTRE TESTS" -ForegroundColor Cyan
Write-Host "========================================================`n" -ForegroundColor Cyan

$appJs = Get-Content -Raw "Broker-Ledger\js\app.js"
$stylesCss = Get-Content -Raw "Broker-Ledger\css\styles.css"

# 1. Dashboard Status Cards
Assert-Check "1. Dashboard status cards array contains TOBILLED, A/TO-PAY, and F/TO-PAY" `
    ($appJs -match "status:\s*'TOBILLED'" -and $appJs -match "status:\s*'A/TO-PAY'" -and $appJs -match "status:\s*'F/TO-PAY'")

Assert-Check "2. Status card elements use sheet-filter action with status filter-type" `
    ($appJs -match 'data-action="sheet-filter"' -and $appJs -match 'data-filter-type="status"')

Assert-Check "3. Status cards link to Live Excel Sheet with dynamic filter-value" `
    ($appJs -match 'data-filter-value="''\s*\+\s*escapeHtml\(item\.status\)')

# 2. Payment and Issue Overview (Action Cards)
Assert-Check "4. Dashboard action cards array contains pending, overdue, pod_missing, and open_issues" `
    ($appJs -match "category:\s*'pending'" -and $appJs -match "category:\s*'overdue'" -and $appJs -match "category:\s*'pod_missing'" -and $appJs -match "category:\s*'open_issues'")

Assert-Check "5. Action card elements use sheet-filter action with category filter-type" `
    ($appJs -match 'data-action="sheet-filter"' -and $appJs -match 'data-filter-type="category"')

Assert-Check "6. Action cards link to Live Excel Sheet with dynamic filter-value" `
    ($appJs -match 'data-filter-value="''\s*\+\s*card\.category')

Assert-Check "7. Action cards display count, amount/subtitle, and open in live sheet CTA" `
    ($appJs -match 'action-card-count' -and $appJs -match 'action-card-amount' -and $appJs -match 'Open in Live Sheet')

# 3. Transporter Balance Table
Assert-Check "8. Transporter Balance table has all 7 required columns" `
    ($appJs -match '<th>Transporter Name</th>' -and `
     $appJs -match '<th>LR Number</th>' -and `
     $appJs -match '<th>Truck Number</th>' -and `
     $appJs -match '<th class="numeric">Balance Amount</th>' -and `
     $appJs -match 'Pending Since' -and `
     $appJs -match 'Days Pending' -and `
     $appJs -match 'Payment Status')

Assert-Check "9. Transporter name in table is clickable to filter sheet by transporter" `
    ($appJs -match 'table-transporter-btn[^>]*data-action="sheet-filter"[^>]*data-filter-type="transporter"')

# 4. Filter and Date Parsing Logic
Assert-Check "10. app.js contains getShipmentDaysPending and parseRecordDate functions" `
    ($appJs -match 'function getShipmentDaysPending\(' -and $appJs -match 'function parseRecordDate\(')

Assert-Check "11. app.js contains isShipmentOverdue function with 15-day threshold" `
    ($appJs -match 'function isShipmentOverdue\(' -and $appJs -match 'days > 15')

Assert-Check "12. app.js contains isShipmentPodMissing and isShipmentOpenIssue functions" `
    ($appJs -match 'function isShipmentPodMissing\(' -and $appJs -match 'function isShipmentOpenIssue\(')

# 5. Live Excel Sheet Synchronization
Assert-Check "13. app.js contains getFilteredSheetRecords function for sheet filtering" `
    ($appJs -match 'function getFilteredSheetRecords\(')

Assert-Check "14. renderSheet displays sheet-filter-banner when filter is active" `
    ($appJs -match 'sheet-filter-banner' -and $appJs -match 'clear-sheet-filter')

Assert-Check "15. Click listener handles sheet-filter action and sets state.view to sheet" `
    ($appJs -match "action === 'sheet-filter'" -and $appJs -match "state\.view = 'sheet'")

Assert-Check "16. Click listener handles clear-sheet-filter action" `
    ($appJs -match "action === 'clear-sheet-filter'")

# 6. CSS Styling & Layout
Assert-Check "17. styles.css includes status-control-grid and control-status-card" `
    ($stylesCss -match '\.status-control-grid' -and $stylesCss -match '\.control-status-card')

Assert-Check "18. styles.css includes action-cards-grid and control-action-card" `
    ($stylesCss -match '\.action-cards-grid' -and $stylesCss -match '\.control-action-card')

Assert-Check "19. styles.css includes sheet-filter-banner and sheet-clear-filter-btn" `
    ($stylesCss -match '\.sheet-filter-banner' -and $stylesCss -match '\.sheet-clear-filter-btn')

Assert-Check "20. styles.css includes responsive breakpoints for 900px and 640px" `
    ($stylesCss -match '@media \(max-width:\s*900px\)' -and $stylesCss -match '@media \(max-width:\s*640px\)')

# 7. Remarks & Notes Division + F/TO-PAY POD Missing Fix
$html = Get-Content -Raw "index.html"
Assert-Check "21. isShipmentPodMissing strictly excludes F/TO-PAY shipments" `
    ($appJs -match "toPayStatus.*===\s*'F/TO-PAY'.*return false")

Assert-Check "22. Payment and Issue Overview includes dedicated remarks and notes action cards" `
    ($appJs -match "category:\s*'remarks'" -and $appJs -match "category:\s*'notes'")

Assert-Check "23. Table columns divide REMARKS / NOTE into distinct REMARKS and NOTE fields" `
    ($appJs -match "'remarks',\s*'note',\s*'toPayStatus'" -and $appJs -match "remarks:\s*'REMARKS',\s*note:\s*'NOTE'")

Assert-Check "24. Shipment dialog includes separate inputs for remarks and note" `
    ($html -match 'name="remarks"' -and $html -match 'name="note"')

Assert-Check "25. getFilteredSheetRecords supports category filtering for remarks and notes" `
    ($appJs -match "filter\.value === 'remarks'" -and $appJs -match "filter\.value === 'notes'")

Write-Host "`n========================================================" -ForegroundColor Cyan
Write-Host "  CONTROL CENTRE RESULTS: $passed Passed, $failed Failed" -ForegroundColor Cyan
Write-Host "========================================================`n" -ForegroundColor Cyan

if ($failed -gt 0) { exit 1 }
