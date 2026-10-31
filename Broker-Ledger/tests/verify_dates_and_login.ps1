$html = Get-Content -Raw "index.html"
$appJs = Get-Content -Raw "Broker-Ledger/js/app.js"
$codeGs = Get-Content -Raw "Broker-Ledger/backend/Code.gs"
$css = Get-Content -Raw "Broker-Ledger/css/styles.css"

$t1 = ($html -match '1st Advance Given Date' -and $html -match 'name="date1"')
$t2 = ($html -match '2nd Advance Given Date' -and $html -match 'name="date2"')
$t3 = ($html -match '3rd Advance Given Date' -and $html -match 'name="date3"')
$t4 = ($html -match 'Unloading Date' -and $html -match 'name="unloadingDate"')
$t5 = ($html -match 'Balance Date' -and $html -match 'name="balanceDate"')
$t6 = $codeGs.Contains("'date1', 'advance2', 'date2', 'advance3', 'date3',") -and $codeGs.Contains("'unloadingDate', 'podReceivedDate', 'balanceDate'")
$t7 = $codeGs.Contains("action === 'ping' || action === 'login' || action === 'version'")
$t8 = $appJs.Contains("'date1', 'advance2', 'date2', 'advance3', 'date3',") -and $appJs.Contains("'unloadingDate', 'podReceivedDate', 'balanceDate'")
$t9 = !($appJs -match "result\.date1\s*=\s*result\.unloadingDate")
$t10 = !($appJs -match "record\.unloadingDate\s*=\s*record\.date1")
$t11 = $appJs.Contains("showApp(user);") -and $appJs.Contains("setBusy(false);")
$t12 = $css.Contains("pointer-events: auto;") -and $css.Contains("z-index: 10;")
$t13 = $css.Contains(".user-switch-card.active") -and $css.Contains("background: #eff6ff;")
$t14 = $html.Contains("advance-payments-section") -and $html.Contains("advance-row-card")
$t15 = $html.Contains("clear-payment-details") -and $appJs.Contains("clearPaymentDetails") -and !($html.Contains("field-clear-btn"))
$t16 = $html.Contains("btn-fill-pending") -and $appJs.Contains("btn-fill-pending")
$t17 = $html.Contains("clear-all-dialog") -and $appJs.Contains("clear-all-dialog")
$t18 = $appJs.Contains("Add & Submit Shipment") -and $appJs.Contains("Update Shipment")

$results = @(
  @{ Name = "1. Form: 1st Advance Given Date separate input"; Ok = $t1 },
  @{ Name = "2. Form: 2nd Advance Given Date separate input"; Ok = $t2 },
  @{ Name = "3. Form: 3rd Advance Given Date separate input"; Ok = $t3 },
  @{ Name = "4. Form: Unloading Date separate input (not combined with 1st adv)"; Ok = $t4 },
  @{ Name = "5. Form: Balance Date separate input"; Ok = $t5 },
  @{ Name = "6. Backend: BROKER_FIELDS contains date1, date2, date3, unloadingDate, balanceDate"; Ok = $t6 },
  @{ Name = "7. Backend: doPost bypasses lock for login and version"; Ok = $t7 },
  @{ Name = "8. Frontend: FIELD_ORDER contains all separate date fields"; Ok = $t8 },
  @{ Name = "9. Frontend: withDerivedValues does not cross-overwrite date1 and unloadingDate"; Ok = $t9 },
  @{ Name = "10. Frontend: formRecord does not force unloadingDate to date1"; Ok = $t10 },
  @{ Name = "11. Frontend: handleLogin shows app immediately"; Ok = $t11 },
  @{ Name = "12. CSS: auth-password-control button has pointer-events and z-index"; Ok = $t12 },
  @{ Name = "13. CSS: user-switch-card active has distinct border and background"; Ok = $t13 },
  @{ Name = "14. UI: Advance payments grouped into compact consistent rows"; Ok = $t14 },
  @{ Name = "15. UI: Clear Payment Details button present and individual clear buttons removed"; Ok = $t15 },
  @{ Name = "16. UI: Fill Pending Amount button in live calculation summary"; Ok = $t16 },
  @{ Name = "17. UI: Clear All button with confirmation"; Ok = $t17 },
  @{ Name = "18. UI: Dynamic Add & Submit / Update Shipment button labels"; Ok = $t18 }
)

$passed = 0
$failed = 0
foreach ($r in $results) {
  if ($r.Ok) {
    Write-Host " [PASS] $($r.Name)" -ForegroundColor Green
    $passed++
  } else {
    Write-Host " [FAIL] $($r.Name)" -ForegroundColor Red
    $failed++
  }
}
Write-Host "`nTargeted Suite: $passed Passed, $failed Failed"
if ($failed -gt 0) { exit 1 }

