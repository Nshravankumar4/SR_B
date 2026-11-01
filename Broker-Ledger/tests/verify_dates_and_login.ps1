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
$t15 = $html.Contains("clear-payment-details") -and `
       $html.Contains("clear-shipment-info") -and `
       $html.Contains("clear-advance-payments") -and `
       $html.Contains("clear-bank-pod-details") -and `
       $appJs.Contains("clearPaymentDetails") -and `
       $appJs.Contains("clearShipmentInfo") -and `
       $appJs.Contains("clearAdvancePayments") -and `
       $appJs.Contains("clearBankPodDetails") -and `
       !($html.Contains("field-clear-btn"))
$t16 = $html.Contains('<input type="hidden" name="podAmountStatus">') -and `
       !$html.Contains('id="btn-fill-pending"') -and `
       !$html.Contains("POD Balance Amount / Status")
$t17 = $html.Contains("clear-all-dialog") -and $appJs.Contains("clear-all-dialog")
$t18 = $appJs.Contains("Add & Submit Shipment") -and $appJs.Contains("Update Shipment")
$t19 = $html.Contains('id="pod-payment-status"') -and `
       $html.Contains("Calculated payment status") -and `
       $appJs.Contains("function paymentStatusText") -and `
       $appJs.Contains("summary.innerHTML = receiptBalanceMarkup(totals, false)")
$t20 = $html.Contains("Record / Manage Payments") -and `
       $appJs.Contains("button.disabled = state.preview") -and `
       $appJs.Contains("No positive balance is available to receive") -and `
       $appJs.Contains("receipt-entry-section').hidden = !canRecord")
$t21 = $appJs.Contains("Latest Received Date") -and `
       $appJs.Contains("Payment Mode</th>") -and `
       $appJs.Contains("function receiptTableCells") -and `
       $appJs.Contains("category: 'payment_done'") -and `
       $appJs.Contains("RECEIPTS.paymentStatus(balance.remainingPaise)")
$t22 = $appJs.Contains("const isAdmin = Boolean(state.user && state.user.role === 'Admin');") -and `
       $appJs.Contains("(isAdmin ? '<th>Delete</th>' : '')") -and `
       $appJs.Contains("const adminTools = state.user ?") -and `
       $appJs.Contains("!wasReversed && state.user")
$t23 = $appJs.Contains("const DISPLAY_FIELDS = FIELD_ORDER.filter(function (field) { return field !== 'podAmountStatus'; });") -and `
       $appJs.Contains("DISPLAY_FIELDS.map(function (field) { return headerCell(field, true); })") -and `
       $appJs.Contains("ws.columns = EXPORT_FIELDS.map(function (field)") -and `
       $appJs.Contains("const EXPORT_FIELDS = DISPLAY_FIELDS.concat(RECEIPT_EXPORT_FIELDS);") -and `
       !$appJs.Contains("ws.columns = DISPLAY_FIELDS.map(function (field)") -and `
       $appJs.Contains("FIELD_ORDER.forEach(function (field)")
$t24 = $appJs.Contains("toast('Shipment was not saved. ' + error.message, 'error');") -and `
       $appJs.Contains("closeShipmentDialog();") -and `
       $appJs.Contains("toast((isEditing ? 'Shipment updated.' : 'Shipment saved.')")
$receiptsJs = Get-Content -Raw "Broker-Ledger/js/receipts.js"
$indexHtml = Get-Content -Raw "index.html"
$t25 = $receiptsJs.Contains("function previewBalance(balance, amountPaise)") -and `
       $appJs.Contains("elements.receivedAmount.addEventListener('input', renderReceiptEntryPreview)") -and `
       $appJs.Contains("RECEIPTS.previewBalance(balance, amount.paise)") -and `
       $appJs.Contains("It is recorded only after you select Add Payment.") -and `
       $indexHtml.Contains("receipts.js?v=20261101-6")
$t26 = $appJs.Contains("ExcelJS styled export error") -eq $false -and `
       $appJs.Contains("Excel workbook downloaded with application styles.") -and `
       $appJs.Contains("Excel workbook could not be created: ' + error.message") -and `
       !$appJs.Contains("window.XLSX.writeFile") -and `
       $appJs.Contains("const EXPORT_FIELDS = DISPLAY_FIELDS.concat(RECEIPT_EXPORT_FIELDS);") -and `
       $appJs.Contains("receivedAmount: receiptDetails.receivedPaise") -and `
       $appJs.Contains("paymentStatus: receiptDetails.paymentStatus") -and `
       $appJs.Contains("field === 'paymentStatus' && cell.value") -and `
       $appJs.Contains("receivedAmount: 'Received Amount'")

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
  @{ Name = "15. UI: All 4 section clear buttons present and individual clear buttons removed"; Ok = $t15 },
  @{ Name = "16. UI: POD Amount Status input removed while existing data remains preserved"; Ok = $t16 },
  @{ Name = "17. UI: Clear All button with confirmation"; Ok = $t17 },
  @{ Name = "18. UI: Dynamic Add & Submit / Update Shipment button labels"; Ok = $t18 },
  @{ Name = "19. UI: Separate derived payment status and non-duplicated receipt summary"; Ok = $t19 },
  @{ Name = "20. UI: Received-payment management works in View/Edit and hides unavailable entry inputs"; Ok = $t20 },
  @{ Name = "21. UI: Dashboard Done filter and sheet payment mode/date/amount/status columns"; Ok = $t21 },
  @{ Name = "22. Permissions: Rudra has other actions but not the shipment Delete column"; Ok = $t22 },
  @{ Name = "23. UI/export: POD Amount Status column hidden while underlying data is retained"; Ok = $t23 },
  @{ Name = "24. UI: Successful shipment saves close the dialog and failures show an error"; Ok = $t24 },
  @{ Name = "25. Payments: Received amount previews live and applies only after confirmation"; Ok = $t25 },
  @{ Name = "26. Export: Styled downloads include Live Excel Sheet receipt summary columns"; Ok = $t26 }
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
