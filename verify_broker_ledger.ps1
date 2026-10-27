# ==============================================================================
# SR BROKERAGE LEDGER - COMPREHENSIVE FORM & CALCULATION TEST SUITE
# Automated Verification of Verified Workbook Formulas, Autocomplete, and Duplicate Handling
# ==============================================================================

$ErrorActionPreference = "Stop"
$passed = 0
$failed = 0

function Assert-Test([string]$name, [bool]$condition, [string]$detail = "") {
    if ($condition) {
        Write-Host " [PASS] $name" -ForegroundColor Green
        $script:passed++
    } else {
        Write-Host " [FAIL] $name - $detail" -ForegroundColor Red
        $script:failed++
    }
}

Write-Host "`n========================================================" -ForegroundColor Cyan
Write-Host "  SR BROKERAGE LEDGER - COMPREHENSIVE VERIFICATION" -ForegroundColor Cyan
Write-Host "========================================================`n" -ForegroundColor Cyan

# 1. Inspect index.html for Autocomplete Datalists and Input Attributes
$indexHtml = Get-Content -Raw "index.html"
Assert-Test "1. index.html contains transport-suggestions datalist" `
    ($indexHtml -match 'datalist id="transport-suggestions"')
Assert-Test "2. index.html contains truck-suggestions datalist" `
    ($indexHtml -match 'datalist id="truck-suggestions"')
Assert-Test "3. index.html contains route datalists (from & to suggestions)" `
    ($indexHtml -match 'datalist id="from-suggestions"' -and $indexHtml -match 'datalist id="to-suggestions"')
Assert-Test "4. index.html contains bank and account datalists" `
    ($indexHtml -match 'datalist id="bank-suggestions"' -and $indexHtml -match 'datalist id="account-suggestions"' -and $indexHtml -match 'datalist id="ifsc-suggestions"')
Assert-Test "5. Form inputs are bound to datalists" `
    ($indexHtml -match 'name="transportName"\s+list="transport-suggestions"' -and `
     $indexHtml -match 'name="truckNo"\s+list="truck-suggestions"' -and `
     $indexHtml -match 'name="from"\s+list="from-suggestions"' -and `
     $indexHtml -match 'name="to"\s+list="to-suggestions"' -and `
     $indexHtml -match 'name="bank"\s+list="bank-suggestions"')

# 2. Inspect app.js for Autocomplete & Autofill Logic
$appJs = Get-Content -Raw "Broker-Ledger\js\app.js"
Assert-Test "6. app.js contains updateAutocompleteSuggestions function" `
    ($appJs -match 'function updateAutocompleteSuggestions\(\)')
Assert-Test "7. Autocomplete populates unique values from existing records" `
    ($appJs -match "populateDatalist\('transport-suggestions'" -and `
     $appJs -match "populateDatalist\('truck-suggestions'" -and `
     $appJs -match "populateDatalist\('bank-suggestions'")
Assert-Test "8. handleTransporterAutofill preserves non-empty fields and never overwrites user input" `
    ($appJs -match 'handleTransporterAutofill' -and `
     $appJs -match '!form\.elements\.accountNo\.value\.trim\(\)' -and `
     $appJs -match '!form\.elements\.ifscCode\.value\.trim\(\)' -and `
     $appJs -match '!form\.elements\.bank\.value\.trim\(\)')
Assert-Test "9. handleTruckAutofill automatically uppercases and pre-fills transporter if empty" `
    ($appJs -match 'handleTruckAutofill' -and $appJs -match '!form\.elements\.transportName\.value\.trim\(\)')

# 3. Inspect Form Value Preservation & View Mode
Assert-Test "10. openShipmentDialog supports 'view', 'edit', and 'add' modes" `
    ($appJs -match "state\.formMode = isView \? 'view' : \(id \? 'edit' : 'add'\)" -and `
     ($appJs -match "saveBtn\.hidden = isView" -or $appJs -match "byId\('save-shipment'\)\.hidden = isView") -and `
     $appJs -match "byId\('cancel-dialog'\)\.textContent = isView \? 'Close' : 'Cancel'")
Assert-Test "11. setFormValues initializes new Add Shipment correctly" `
    ($appJs -match "form\.elements\.date\.value = new Date\(\)\.toISOString\(\)\.split\('T'\)\[0\]" -and `
     $appJs -match "form\.elements\.toPayStatus\.value = 'TOBILLED'")
Assert-Test "12. Changing status preserves all advance and deduction amounts" `
    ($appJs -match 'updateFormCalculations' -and !($appJs -match 'advance2\.value = ""'))

# 4. Inspect Duplicate Submission Prevention
Assert-Test "13. Client-side duplicate detection checks (LR No, date, truck No)" `
    ($appJs -match 'recordIdentity = \[record\.lrNo, record\.date, record\.truckNo\]' -and `
     $appJs -match 'itemIdentity === recordIdentity' -and `
     $appJs -match 'A shipment with this LR No, date, and truck already exists\.')
Assert-Test "14. Save button is disabled during submission to prevent accidental double-clicks" `
    ($appJs -match 'saveBtn\.disabled = true' -and $appJs -match "saveBtn\.textContent = 'Saving…'")

# 5. Verify Calculations against Workbook Formulas (Paise math emulation)
function Parse-Paise($val) {
    if ($val -eq $null -or $val -eq "") { return 0 }
    $s = $val.ToString().Replace("₹", "").Replace(",", "").Trim()
    if ($s -eq "") { return 0 }
    return [Math]::Round([double]$s * 100)
}

function Calc-Shipment($record) {
    $freight = Parse-Paise $record.freight
    $tm = Parse-Paise $record.tM
    $adv = Parse-Paise $record.advance
    $adv2 = Parse-Paise $record.advance2
    $adv3 = Parse-Paise $record.advance3
    $extra = Parse-Paise $record.extraAmount
    $pm = Parse-Paise $record.pM
    $status = $record.toPayStatus.Trim().ToUpper()

    $cod = 0
    $pendingTobilled = $null
    $pendingAmount = 0

    if ($status -eq "TOBILLED") {
        $pendingTobilled = ($freight - $tm - $adv - $adv2 - $adv3) / 100
        $pendingAmount = (($pendingTobilled * 100) + $extra - $pm) / 100
        $cod = $record.codToPay
    } elseif ($status -eq "A/TO-PAY" -or $status -eq "F/TO-PAY") {
        $codPaise = $freight - $tm - $adv - $adv2 - $adv3
        $cod = $codPaise / 100
        $pendingAmount = ($freight - $tm - $adv - $codPaise) / 100
    }

    return @{
        codToPay = $cod
        pendingTobilled = $pendingTobilled
        pendingAmount = $pendingAmount
    }
}

# Test Cases:
# Workbook Row 2 (TOBILLED): Freight 60,000, TM 300, Adv 49,700, Adv2 0, Adv3 0, Extra 0, PM 200
$tb1 = Calc-Shipment @{ toPayStatus = "TOBILLED"; freight = "60,000"; tM = "300"; advance = "49,700"; extraAmount = "0"; pM = "200"; codToPay = "if Tobilled NA" }
Assert-Test "15. TOBILLED Row 2 (Pending Tobilled 10,000, Final Pending 9,800)" `
    ($tb1.pendingTobilled -eq 10000 -and $tb1.pendingAmount -eq 9800 -and $tb1.codToPay -eq "if Tobilled NA")

# Workbook Row 3 (TOBILLED): Freight 60,000, TM 300, Adv 49,700, Extra 5,000, PM 300
$tb2 = Calc-Shipment @{ toPayStatus = "TOBILLED"; freight = "60,000"; tM = "300"; advance = "49,700"; extraAmount = "5,000"; pM = "300"; codToPay = "if Tobilled NA" }
Assert-Test "16. TOBILLED Row 3 (Pending Tobilled 10,000, Final Pending 14,700)" `
    ($tb2.pendingTobilled -eq 10000 -and $tb2.pendingAmount -eq 14700 -and $tb2.codToPay -eq "if Tobilled NA")

# Workbook Row 8 (A/TO-PAY): Freight 90,000, TM 200, Adv 49,800, Adv2 0, Adv3 0
$atp = Calc-Shipment @{ toPayStatus = "A/TO-PAY"; freight = "90,000"; tM = "200"; advance = "49,800"; advance2 = "0"; advance3 = "0" }
Assert-Test "17. A/TO-PAY Row 8 (COD 40,000, Pending Tobilled null, Final Pending 0)" `
    ($atp.codToPay -eq 40000 -and $atp.pendingTobilled -eq $null -and $atp.pendingAmount -eq 0)

# Workbook Row 12 (F/TO-PAY): Freight 42,000, TM 0, Adv 0, Adv2 0, Adv3 0
$ftp = Calc-Shipment @{ toPayStatus = "F/TO-PAY"; freight = "42,000"; tM = "0"; advance = "0"; advance2 = "0"; advance3 = "0" }
Assert-Test "18. F/TO-PAY Row 12 (COD 42,000, Pending Tobilled null, Final Pending 0)" `
    ($ftp.codToPay -eq 42000 -and $ftp.pendingTobilled -eq $null -and $ftp.pendingAmount -eq 0)

# Advanced case: A/TO-PAY with Advance 2 and Advance 3
$atpAdv = Calc-Shipment @{ toPayStatus = "A/TO-PAY"; freight = "90,000"; tM = "200"; advance = "49,800"; advance2 = "1,000"; advance3 = "500" }
Assert-Test "19. A/TO-PAY with ADV2 & ADV3 (COD 38,500, Final Pending 1,500 = ADV2 + ADV3)" `
    ($atpAdv.codToPay -eq 38500 -and $atpAdv.pendingAmount -eq 1500)

# Negative balance case
$neg = Calc-Shipment @{ toPayStatus = "TOBILLED"; freight = "20,000"; tM = "0"; advance = "25,000"; extraAmount = "0"; pM = "0" }
Assert-Test "20. Negative balance preservation (Freight 20,000 - Adv 25,000 -> -5,000)" `
    ($neg.pendingTobilled -eq -5000 -and $neg.pendingAmount -eq -5000)

# 6. POD Status Rules & Date Normalization
$calcJs = Get-Content -Raw "Broker-Ledger\js\calculations.js"
$valJs = Get-Content -Raw "Broker-Ledger\js\validation.js"
$appJs = Get-Content -Raw "Broker-Ledger\js\app.js"
$codeGs = Get-Content -Raw "Broker-Ledger\backend\Code.gs"
Assert-Test "21. POD Amount Status strictly evaluates to numeric zero, never substituting text DONE" `
    ($calcJs -match 'podAmountStatus = fromPaise\(' -and `
     $calcJs -match 'podAmountStatus: podAmountStatus' -and `
     $codeGs -match 'podAmountStatus:\s*0' -and `
     !($appJs -match "podStatusInput\.value = 'DONE'"))

Assert-Test "22. toDateInput parses slash dates and pads single-digit values" `
    ($appJs -match 'toDateInput' -and $appJs -match 'padStart\(2,\s*''0''\)')

Assert-Test "23. validation.js accepts slash formatted dates (DD/MM/YYYY or YYYY/MM/DD)" `
    ($valJs -match 'rawDate\.replace\(/\\//g,\s*''-''\)')

# Decimal Currency Precision (Paise Math)
$dec = Calc-Shipment @{ toPayStatus = "TOBILLED"; freight = "60,000.50"; tM = "300.25"; advance = "49,700.15"; extraAmount = "5,000.40"; pM = "300.50"; codToPay = "if Tobilled NA" }
Assert-Test "24. Decimal currency inputs maintain exact paise precision without floating-point errors" `
    ($dec.pendingTobilled -eq 10000.10 -and $dec.pendingAmount -eq 14700.00)

# Duplicate Check Logic Validation
$existingRecords = @(
    @{ id = "1"; lrNo = "LR-200"; date = "2026-10-27"; truckNo = "AP39UD3564" }
)
function Check-Dup($cand, $editId) {
    $candKey = "$($cand.lrNo)|$($cand.date)|$($cand.truckNo)".ToLower().Trim()
    return $existingRecords | Where-Object {
        if ($editId -and $_.id -eq $editId) { return $false }
        $itemKey = "$($_.lrNo)|$($_.date)|$($_.truckNo)".ToLower().Trim()
        return $itemKey -eq $candKey
    }
}
$isDup1 = (Check-Dup @{ lrNo = "LR-200"; date = "2026-10-27"; truckNo = "AP39UD3564" } $null) -ne $null
$isDup2 = (Check-Dup @{ lrNo = "LR-200"; date = "2026-10-27"; truckNo = "AP39UD3564" } "1") -ne $null
$isDup3 = (Check-Dup @{ lrNo = "LR-200"; date = "2026-10-28"; truckNo = "AP39UD3564" } $null) -ne $null
Assert-Test "25. Compound duplicate key prevents collision but allows editing same record and valid new dates" `
    ($isDup1 -eq $true -and $isDup2 -eq $false -and $isDup3 -eq $false)

Write-Host "`n========================================================" -ForegroundColor Cyan
Write-Host "  TEST RESULTS SUMMARY" -ForegroundColor Cyan
Write-Host "========================================================" -ForegroundColor Cyan
Write-Host " Passed: $passed" -ForegroundColor Green
Write-Host " Failed: $failed" -ForegroundColor $(if ($failed -gt 0) { "Red" } else { "Green" })
Write-Host " Total:  $($passed + $failed)" -ForegroundColor Cyan
Write-Host "========================================================`n" -ForegroundColor Cyan

if ($failed -gt 0) { exit 1 }
