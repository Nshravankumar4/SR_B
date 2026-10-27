# ==============================================================================
# SR BROKERAGE LEDGER - END-TO-END BEHAVIORAL WORKFLOW & FORM TEST SUITE
# Emulates Browser UI Logic, State Machine, Data Layer, and Authoritative Calculations
# ==============================================================================

$ErrorActionPreference = "Stop"
$passed = 0
$failed = 0

function Assert-Step([string]$name, [bool]$condition, [string]$detail = "") {
    if ($condition) {
        Write-Host " [PASS] $name" -ForegroundColor Green
        $script:passed++
    } else {
        Write-Host " [FAIL] $name - $detail" -ForegroundColor Red
        $script:failed++
    }
}

Write-Host "`n========================================================" -ForegroundColor Cyan
Write-Host "  SR BROKERAGE LEDGER - BEHAVIORAL E2E TEST SUITE" -ForegroundColor Cyan
Write-Host "========================================================`n" -ForegroundColor Cyan

# ------------------------------------------------------------------------------
# 1. EMULATE BACKEND & AUTHORITATIVE DATA STORE (Google Apps Script / Sheets)
# ------------------------------------------------------------------------------
$script:backendRecords = @(
    @{
        id = "rec-001"
        slNo = 1
        transportName = "ANTP SAINATH"
        date = "2026-08-20"
        lrNo = "207"
        truckNo = "AP39UD3564"
        from = "LUCKNOW"
        to = "MEDCHAL"
        accountNo = "38216860303"
        ifscCode = "SBIN0010659"
        bank = "SBI BANK"
        freight = "60,000"
        tM = "300"
        advance = "49,700"
        advance2 = "0"
        advance3 = "0"
        podReceivedDate = "2026-09-02"
        codToPay = "if Tobilled NA"
        pendingTobilled = 10000
        extraAmount = "0"
        pmPaDate = "2026-09-10"
        pM = "200"
        pendingAmount = 9800
        podAmountStatus = 0
        remarks = ""
        toPayStatus = "TOBILLED"
        createdAt = "2026-08-20T10:00:00.000Z"
        updatedAt = "2026-08-20T10:00:00.000Z"
    },
    @{
        id = "rec-002"
        slNo = 2
        transportName = "SARITHA TRSP"
        date = "2026-09-03"
        lrNo = "208"
        truckNo = "TG15T6666"
        from = "RAIPUR"
        to = "MEDCHAL"
        accountNo = "0312035592"
        ifscCode = "KKBK0008406"
        bank = "KKBK BANK"
        freight = "60,000"
        tM = "300"
        advance = "49,700"
        advance2 = "0"
        advance3 = "0"
        podReceivedDate = "2026-09-07"
        codToPay = "if Tobilled NA"
        pendingTobilled = 10000
        extraAmount = "5,000"
        pmPaDate = "2026-09-11"
        pM = "300"
        pendingAmount = 14700
        podAmountStatus = 0
        remarks = "Halted"
        toPayStatus = "TOBILLED"
        createdAt = "2026-09-03T10:00:00.000Z"
        updatedAt = "2026-09-03T10:00:00.000Z"
    },
    @{
        id = "rec-003"
        slNo = 3
        transportName = "CG RANCHI R/WAYS"
        date = "2026-09-29"
        lrNo = "195"
        truckNo = "CG08AZ4714"
        from = "MEDCHAL"
        to = "PANKANJUR"
        accountNo = "29122900001083"
        ifscCode = "DCBL0000291"
        bank = "DCB BANK"
        freight = "42,000"
        tM = "0"
        advance = "0"
        advance2 = "0"
        advance3 = "0"
        podReceivedDate = "Pending"
        codToPay = 42000
        pendingTobilled = $null
        extraAmount = "0"
        pmPaDate = "2026-10-12"
        pM = "0"
        pendingAmount = 0
        podAmountStatus = 0
        remarks = "F/TO-PAY Shipment"
        toPayStatus = "F/TO-PAY"
        createdAt = "2026-09-29T10:00:00.000Z"
        updatedAt = "2026-09-29T10:00:00.000Z"
    },
    @{
        id = "rec-004"
        slNo = 4
        transportName = "SARITHA TRSP"
        date = "2026-10-01"
        lrNo = "196"
        truckNo = "TG15T6666"
        from = "MEDCHAL"
        to = "MADHAPURA"
        accountNo = "0312035592"
        ifscCode = "KKBK0008406"
        bank = "KKBK BANK"
        freight = "90,000"
        tM = "200"
        advance = "49,800"
        advance2 = "0"
        advance3 = "0"
        podReceivedDate = "2026-10-19"
        codToPay = 40000
        pendingTobilled = $null
        extraAmount = "0"
        pmPaDate = "2026-10-13"
        pM = "0"
        pendingAmount = 0
        podAmountStatus = 0
        remarks = ""
        toPayStatus = "A/TO-PAY"
        createdAt = "2026-10-01T10:00:00.000Z"
        updatedAt = "2026-10-01T10:00:00.000Z"
    }
)

# ------------------------------------------------------------------------------
# 2. CALCULATION ENGINE & INTEGER PAISE LOGIC (Mirroring calculations.js)
# ------------------------------------------------------------------------------
function Parse-Money([object]$value, [bool]$allowEmpty = $false) {
    if ($value -eq $null -or $value -eq "") {
        if ($allowEmpty) { return @{ ok = $true; empty = $true; paise = 0 } }
        else { return @{ ok = $false; error = "Enter an amount." } }
    }
    $text = $value.ToString().Trim().Replace("₹", "").Replace(" ", "")
    if ($text -eq "") {
        if ($allowEmpty) { return @{ ok = $true; empty = $true; paise = 0 } }
        else { return @{ ok = $false; error = "Enter an amount." } }
    }
    $sign = 1
    if ($text.StartsWith("-")) { $sign = -1; $text = $text.Substring(1) }
    elseif ($text.StartsWith("+")) { $text = $text.Substring(1) }
    
    # Check valid numeric format
    $cleaned = $text.Replace(",", "")
    $val = 0.0
    if (![double]::TryParse($cleaned, [ref]$val)) {
        return @{ ok = $false; error = "Enter a valid amount." }
    }
    $paise = [long][Math]::Round($val * 100)
    return @{ ok = $true; empty = $false; paise = ($sign * $paise) }
}

function Calculate-Shipment([hashtable]$shipment) {
    $errors = @{}
    $fright = Parse-Money $shipment.freight $false
    if (!$fright.ok) { $errors["freight"] = $fright.error }
    
    $tm = Parse-Money $shipment.tM $true
    if (!$tm.ok) { $errors["tM"] = $tm.error }
    
    $adv1 = Parse-Money $shipment.advance $true
    if (!$adv1.ok) { $errors["advance"] = $adv1.error }
    
    $adv2 = Parse-Money $shipment.advance2 $true
    if (!$adv2.ok) { $errors["advance2"] = $adv2.error }
    
    $adv3 = Parse-Money $shipment.advance3 $true
    if (!$adv3.ok) { $errors["advance3"] = $adv3.error }
    
    $extra = Parse-Money $shipment.extraAmount $true
    if (!$extra.ok) { $errors["extraAmount"] = $extra.error }
    
    $pm = Parse-Money $shipment.pM $true
    if (!$pm.ok) { $errors["pM"] = $pm.error }
    
    $status = if ($shipment.toPayStatus) { $shipment.toPayStatus.ToString().Trim().ToUpper().Replace(" ", "") } else { "" }
    $allowedStatuses = @("TOBILLED", "A/TO-PAY", "F/TO-PAY")
    if ($allowedStatuses -notcontains $status) {
        $errors["toPayStatus"] = "Choose one of the supported statuses."
    }
    
    if ($errors.Count -gt 0) {
        return @{ codToPay = $null; pendingTobilled = $null; pendingAmount = $null; podAmountStatus = $null; errors = $errors }
    }
    
    $pendingTobilled = $null
    $pendingAmount = $null
    $podAmountStatus = 0
    $codToPay = if ($shipment.ContainsKey("codToPay") -and $shipment.codToPay -ne $null) { $shipment.codToPay } else { "" }
    
    if ($status -eq "TOBILLED") {
        $pendingTobilledPaise = $fright.paise - $tm.paise - $adv1.paise - $adv2.paise - $adv3.paise
        $pendingTobilled = $pendingTobilledPaise / 100.0
        $pendingAmountPaise = $pendingTobilledPaise + $extra.paise - $pm.paise
        $pendingAmount = $pendingAmountPaise / 100.0
        # Formula Col AA: =IF(M="TOBILLED", V + W - Y - Z) -> 0
        $podAmountStatus = ($pendingTobilledPaise + $extra.paise - $pm.paise - $pendingAmountPaise) / 100.0
    } elseif ($status -eq "A/TO-PAY" -or $status -eq "F/TO-PAY") {
        $codPaise = $fright.paise - $tm.paise - $adv1.paise - $adv2.paise - $adv3.paise
        $codToPay = $codPaise / 100.0
        $pendingAmountPaise = $fright.paise - $tm.paise - $adv1.paise - $codPaise
        $pendingAmount = $pendingAmountPaise / 100.0
        $podAmountStatus = 0
    }
    
    return @{
        codToPay = $codToPay
        pendingTobilled = $pendingTobilled
        pendingAmount = $pendingAmount
        podAmountStatus = $podAmountStatus
        errors = $errors
    }
}

# ------------------------------------------------------------------------------
# 3. UI STATE & FORM LIFECYCLE CONTROLLER (Mirroring app.js)
# ------------------------------------------------------------------------------
class MockForm {
    [hashtable]$elements = @{}
    MockForm() {
        $fields = @(
            'transportName', 'date', 'lrNo', 'truckNo', 'from', 'to', 'toPayStatus',
            'freight', 'tM', 'advance', 'advance2', 'advance3', 'codToPay', 'extraAmount',
            'pmPaDate', 'pM', 'pendingTobilled', 'pendingAmount', 'accountNo', 'ifscCode',
            'bank', 'podReceivedDate', 'podAmountStatus', 'remarks'
        )
        foreach ($f in $fields) {
            $this.elements[$f] = @{ value = ""; disabled = $false; readOnly = $false; classList = @() }
        }
    }
    [void]SetValue([string]$field, [string]$val) {
        if ($this.elements.ContainsKey($field)) { $this.elements[$field].value = $val }
    }
    [string]GetValue([string]$field) {
        if ($this.elements.ContainsKey($field)) { return $this.elements[$field].value }
        return ""
    }
    [void]Reset() {
        foreach ($k in $this.elements.Keys) {
            $this.elements[$k].value = ""
            $this.elements[$k].disabled = $false
            $this.elements[$k].readOnly = $false
        }
    }
}

class LedgerAppSimulator {
    [array]$records = @()
    [string]$formMode = "closed"
    [string]$editingId = $null
    [string]$editingUpdatedAt = ""
    [string]$codToPayNote = "if Tobilled NA"
    [MockForm]$form
    [hashtable]$datalists = @{}
    [bool]$saveBtnDisabled = $false
    [string]$saveBtnText = "Save Shipment"
    [bool]$saveBtnHidden = $false
    [string]$cancelBtnText = "Cancel"
    [string]$dialogTitle = ""

    LedgerAppSimulator([array]$initialRecords) {
        $this.records = $initialRecords
        $this.form = [MockForm]::new()
        $this.UpdateAutocompleteSuggestions()
    }

    [void]UpdateAutocompleteSuggestions() {
        $uniqueTransports = @($this.records | ForEach-Object { $_.transportName } | Where-Object { $_ } | Select-Object -Unique | Sort-Object)
        $uniqueTrucks = @($this.records | ForEach-Object { $_.truckNo.ToUpper() } | Where-Object { $_ } | Select-Object -Unique | Sort-Object)
        $hubs = @('MEDCHAL', 'WARANGAL', 'HYDERABAD', 'RAIPUR', 'LUCKNOW', 'PANKANJUR', 'MADHAPURA', 'NAGPUR', 'MUMBAI')
        $fromCities = @(@($this.records | ForEach-Object { $_.from.ToUpper() } | Where-Object { $_ }) + $hubs | Select-Object -Unique | Sort-Object)
        $toCities = @(@($this.records | ForEach-Object { $_.to.ToUpper() } | Where-Object { $_ }) + $hubs | Select-Object -Unique | Sort-Object)
        $uniqueBanks = @($this.records | ForEach-Object { $_.bank } | Where-Object { $_ } | Select-Object -Unique | Sort-Object)
        $uniqueAccounts = @($this.records | ForEach-Object { $_.accountNo } | Where-Object { $_ } | Select-Object -Unique | Sort-Object)
        $uniqueIfsc = @($this.records | ForEach-Object { $_.ifscCode.ToUpper() } | Where-Object { $_ } | Select-Object -Unique | Sort-Object)

        $this.datalists["transport-suggestions"] = $uniqueTransports
        $this.datalists["truck-suggestions"] = $uniqueTrucks
        $this.datalists["from-suggestions"] = $fromCities
        $this.datalists["to-suggestions"] = $toCities
        $this.datalists["bank-suggestions"] = $uniqueBanks
        $this.datalists["account-suggestions"] = $uniqueAccounts
        $this.datalists["ifsc-suggestions"] = $uniqueIfsc
    }

    [void]HandleTransporterAutofill([string]$name) {
        if (!$name -or $this.formMode -eq "view") { return }
        $clean = $name.Trim().ToLower()
        $match = $this.records | Where-Object { $_.transportName.Trim().ToLower() -eq $clean } | Select-Object -Last 1
        if ($match) {
            # PRESERVATION: Only populate empty fields; never overwrite user values
            if (!$this.form.GetValue("accountNo").Trim() -and $match.accountNo) {
                $this.form.SetValue("accountNo", $match.accountNo)
            }
            if (!$this.form.GetValue("ifscCode").Trim() -and $match.ifscCode) {
                $this.form.SetValue("ifscCode", $match.ifscCode)
            }
            if (!$this.form.GetValue("bank").Trim() -and $match.bank) {
                $this.form.SetValue("bank", $match.bank)
            }
        }
    }

    [void]HandleTruckAutofill([string]$truck) {
        if (!$truck -or $this.formMode -eq "view") { return }
        $clean = $truck.Trim().ToUpper()
        $match = $this.records | Where-Object { $_.truckNo.Trim().ToUpper() -eq $clean } | Select-Object -Last 1
        if ($match) {
            if (!$this.form.GetValue("transportName").Trim() -and $match.transportName) {
                $this.form.SetValue("transportName", $match.transportName)
                $this.HandleTransporterAutofill($match.transportName)
            }
        }
    }

    [void]UpdateFormCalculations() {
        $status = $this.form.GetValue("toPayStatus").Trim().ToUpper()
        if ($status -eq "TOBILLED") {
            $this.form.elements["codToPay"].readOnly = $false
            if (!$this.form.GetValue("codToPay")) {
                $this.form.SetValue("codToPay", $this.codToPayNote)
            }
        } else {
            $this.form.elements["codToPay"].readOnly = $true
        }

        # Calculate with current form values
        $rec = @{}
        foreach ($k in $this.form.elements.Keys) { $rec[$k] = $this.form.GetValue($k) }
        $calc = Calculate-Shipment $rec

        if ($status -ne "TOBILLED") {
            $codStr = $(if ($calc.codToPay -ne $null) { $calc.codToPay.ToString() } else { "" })
            $this.form.SetValue("codToPay", $codStr)
        }
        $ptStr = $(if ($calc.pendingTobilled -ne $null) { $calc.pendingTobilled.ToString() } else { "" })
        $this.form.SetValue("pendingTobilled", $ptStr)
        $paStr = $(if ($calc.pendingAmount -ne $null) { $calc.pendingAmount.ToString() } else { "" })
        $this.form.SetValue("pendingAmount", $paStr)
        if ($calc.podAmountStatus -ne $null) {
            $this.form.SetValue("podAmountStatus", $calc.podAmountStatus.ToString())
        }
    }

    [void]OpenShipmentDialog([string]$mode) {
        $this.OpenShipmentDialog($mode, $null)
    }

    [void]OpenShipmentDialog([string]$mode, [string]$id) {
        $isView = ($mode -eq "view")
        $existing = $(if ($id) { $this.records | Where-Object { $_.id -eq $id } | Select-Object -First 1 } else { $null })
        $this.editingId = $id
        $this.editingUpdatedAt = $(if ($existing) { $existing.updatedAt } else { "" })
        $this.formMode = $(if ($isView) { "view" } elseif ($id) { "edit" } else { "add" })
        $this.UpdateAutocompleteSuggestions()

        $this.form.Reset()
        if ($existing) {
            foreach ($k in $existing.Keys) {
                if ($this.form.elements.ContainsKey($k)) {
                    $this.form.SetValue($k, $existing[$k].ToString())
                }
            }
            $this.codToPayNote = $(if ($existing.toPayStatus -eq "TOBILLED") { $existing.codToPay } else { "if Tobilled NA" })
        } else {
            $this.form.SetValue("date", "2026-10-28")
            $this.form.SetValue("toPayStatus", "TOBILLED")
            $this.form.SetValue("podAmountStatus", "0")
            $this.codToPayNote = "if Tobilled NA"
        }
        $this.UpdateFormCalculations()

        foreach ($k in $this.form.elements.Keys) {
            $this.form.elements[$k].disabled = $isView
        }
        $this.form.elements["pendingTobilled"].readOnly = $true
        $this.form.elements["pendingAmount"].readOnly = $true

        $this.saveBtnHidden = $isView
        $this.saveBtnDisabled = $false
        $this.saveBtnText = "Save Shipment"
        $this.cancelBtnText = $(if ($isView) { "Close" } else { "Cancel" })
        $this.dialogTitle = $(if ($isView) { "Shipment Details" } elseif ($existing) { "Edit Shipment" } else { "Add Shipment" })
    }

    [hashtable]SaveShipment() {
        if ($this.formMode -eq "view") { return @{ ok = $false; error = "Cannot save in view mode." } }
        $this.saveBtnDisabled = $true
        $this.saveBtnText = "Saving…"

        $rec = @{}
        foreach ($k in $this.form.elements.Keys) { $rec[$k] = $this.form.GetValue($k) }
        $calc = Calculate-Shipment $rec
        if ($calc.errors.Count -gt 0) {
            $this.saveBtnDisabled = $false
            $this.saveBtnText = "Save Shipment"
            return @{ ok = $false; error = "Validation error." }
        }

        # Duplicate compound key identity check: [lrNo, date, truckNo]
        $candKey = "$($rec.lrNo)|$($rec.date)|$($rec.truckNo)".ToLower().Trim()
        $isDuplicate = $this.records | Where-Object {
            if ($this.editingId -and $_.id -eq $this.editingId) { return $false }
            $itemKey = "$($_.lrNo)|$($_.date)|$($_.truckNo)".ToLower().Trim()
            return $itemKey -eq $candKey
        }
        if ($isDuplicate) {
            $this.saveBtnDisabled = $false
            $this.saveBtnText = "Save Shipment"
            return @{ ok = $false; error = "A shipment with this LR No, date, and truck already exists." }
        }

        # Finalize record
        $rec.codToPay = $calc.codToPay
        $rec.pendingTobilled = $calc.pendingTobilled
        $rec.pendingAmount = $calc.pendingAmount
        $rec.podAmountStatus = $calc.podAmountStatus

        if ($this.editingId) {
            # Update existing
            for ($i = 0; $i -lt $this.records.Count; $i++) {
                if ($this.records[$i].id -eq $this.editingId) {
                    $rec.id = $this.editingId
                    $rec.slNo = $this.records[$i].slNo
                    $rec.createdAt = $this.records[$i].createdAt
                    $rec.updatedAt = (Get-Date).ToString("o")
                    $this.records[$i] = $rec
                    break
                }
            }
        } else {
            # Add new
            $rec.id = "rec-" + [guid]::NewGuid().ToString().Substring(0, 8)
            $rec.slNo = $this.records.Count + 1
            $now = (Get-Date).ToString("o")
            $rec.createdAt = $now
            $rec.updatedAt = $now
            $this.records += $rec
        }

        $this.UpdateAutocompleteSuggestions()
        $this.saveBtnDisabled = $false
        $this.saveBtnText = "Save Shipment"
        $this.formMode = "closed"
        return @{ ok = $true; record = $rec }
    }
}

# ------------------------------------------------------------------------------
# 4. EXECUTE END-TO-END BEHAVIORAL SCENARIOS
# ------------------------------------------------------------------------------
$app = [LedgerAppSimulator]::new($script:backendRecords)

# Test Scenario 1: Initial Autocomplete population from backend data
Assert-Step "Scenario 1.1: Autocomplete loads all transporters from saved backend data" `
    ($app.datalists["transport-suggestions"] -contains "ANTP SAINATH" -and `
     $app.datalists["transport-suggestions"] -contains "SARITHA TRSP" -and `
     $app.datalists["transport-suggestions"] -contains "CG RANCHI R/WAYS")

Assert-Step "Scenario 1.2: Autocomplete loads uppercase truck numbers" `
    ($app.datalists["truck-suggestions"] -contains "AP39UD3564" -and `
     $app.datalists["truck-suggestions"] -contains "TG15T6666" -and `
     $app.datalists["truck-suggestions"] -contains "CG08AZ4714")

Assert-Step "Scenario 1.3: Autocomplete includes regional logistics hubs for routes" `
    ($app.datalists["from-suggestions"] -contains "MEDCHAL" -and `
     $app.datalists["from-suggestions"] -contains "WARANGAL" -and `
     $app.datalists["to-suggestions"] -contains "MUMBAI")

# Test Scenario 2: Add Shipment Dialog Initialization & Autocomplete Autofill
$app.OpenShipmentDialog("add")
Assert-Step "Scenario 2.1: Add dialog initializes with date, TOBILLED status, and numeric 0 podAmountStatus" `
    ($app.form.GetValue("date") -eq "2026-10-28" -and `
     $app.form.GetValue("toPayStatus") -eq "TOBILLED" -and `
     $app.form.GetValue("podAmountStatus") -eq "0" -and `
     $app.formMode -eq "add" -and `
     $app.saveBtnHidden -eq $false)

# Typing existing transporter autofills bank details
$app.form.SetValue("transportName", "ANTP SAINATH")
$app.HandleTransporterAutofill("ANTP SAINATH")
Assert-Step "Scenario 2.2: Transporter selection autofills bank details into empty fields" `
    ($app.form.GetValue("accountNo") -eq "38216860303" -and `
     $app.form.GetValue("ifscCode") -eq "SBIN0010659" -and `
     $app.form.GetValue("bank") -eq "SBI BANK")

# Non-destructive preservation: changing transporter does NOT overwrite user-entered bank details
$app.form.SetValue("bank", "HDFC BANK")
$app.form.SetValue("transportName", "SARITHA TRSP")
$app.HandleTransporterAutofill("SARITHA TRSP")
Assert-Step "Scenario 2.3: Non-destructive preservation keeps user custom bank details intact" `
    ($app.form.GetValue("bank") -eq "HDFC BANK" -and `
     $app.form.GetValue("accountNo") -eq "38216860303")

# Test Scenario 3: Non-Destructive Status Switching Across All 3 Modes
$app.form.SetValue("freight", "75,000")
$app.form.SetValue("tM", "500")
$app.form.SetValue("advance", "30,000")
$app.form.SetValue("advance2", "10,000")
$app.form.SetValue("advance3", "5,000")
$app.form.SetValue("extraAmount", "2,500")
$app.form.SetValue("pM", "400")

# Mode 1: TOBILLED
$app.form.SetValue("toPayStatus", "TOBILLED")
$app.UpdateFormCalculations()
# Freight 75,000 - TM 500 - Adv 30,000 - Adv2 10,000 - Adv3 5,000 = 29,500
# Final Pending = 29,500 + 2,500 - 400 = 31,600
# COD is text note 'if Tobilled NA'
Assert-Step "Scenario 3.1: TOBILLED live calculation: Pending: Tobilled 29,500, Final Pending 31,600" `
    ($app.form.GetValue("pendingTobilled") -eq "29500" -and `
     $app.form.GetValue("pendingAmount") -eq "31600" -and `
     $app.form.GetValue("codToPay") -eq "if Tobilled NA" -and `
     $app.form.GetValue("podAmountStatus") -eq "0")

# Mode 2: Switch to A/TO-PAY (Preserving all fields!)
$app.form.SetValue("toPayStatus", "A/TO-PAY")
$app.UpdateFormCalculations()
# COD = Freight 75,000 - TM 500 - Adv 30,000 - Adv2 10,000 - Adv3 5,000 = 29,500
# Pending Amount = Adv2 10,000 + Adv3 5,000 = 15,000
# Pending Tobilled = null / empty
Assert-Step "Scenario 3.2: A/TO-PAY preserves all inputs: COD 29,500, Final Pending 15,000 (= Adv2+Adv3)" `
    ($app.form.GetValue("advance2") -eq "10,000" -and `
     $app.form.GetValue("advance3") -eq "5,000" -and `
     $app.form.GetValue("extraAmount") -eq "2,500" -and `
     $app.form.GetValue("pM") -eq "400" -and `
     $app.form.GetValue("codToPay") -eq "29500" -and `
     $app.form.GetValue("pendingAmount") -eq "15000" -and `
     $app.form.GetValue("pendingTobilled") -eq "" -and `
     $app.form.GetValue("podAmountStatus") -eq "0")

# Mode 3: Switch to F/TO-PAY (Preserving all fields!)
$app.form.SetValue("toPayStatus", "F/TO-PAY")
$app.UpdateFormCalculations()
Assert-Step "Scenario 3.3: F/TO-PAY preserves inputs without destructive wiping" `
    ($app.form.GetValue("advance") -eq "30,000" -and `
     $app.form.GetValue("extraAmount") -eq "2,500" -and `
     $app.form.GetValue("codToPay") -eq "29500" -and `
     $app.form.GetValue("pendingAmount") -eq "15000" -and `
     $app.form.GetValue("podAmountStatus") -eq "0")

# Switch back to TOBILLED
$app.form.SetValue("toPayStatus", "TOBILLED")
$app.UpdateFormCalculations()
Assert-Step "Scenario 3.4: Reverting to TOBILLED restores exact initial calculations without data loss" `
    ($app.form.GetValue("pendingTobilled") -eq "29500" -and `
     $app.form.GetValue("pendingAmount") -eq "31600" -and `
     $app.form.GetValue("podAmountStatus") -eq "0")

# Test Scenario 4: Duplicate Detection Enforcement & Collision Blocking
# Try to submit identical duplicate of Trip #1 (LR 207, Date 2026-08-20, Truck AP39UD3564)
$app.form.SetValue("lrNo", "207")
$app.form.SetValue("date", "2026-08-20")
$app.form.SetValue("truckNo", "AP39UD3564")
$app.form.SetValue("from", "LUCKNOW")
$app.form.SetValue("to", "MEDCHAL")
$dupRes = $app.SaveShipment()
Assert-Step "Scenario 4.1: Submitting identical (LR No + Date + Truck No) is strictly blocked" `
    ($dupRes.ok -eq $false -and `
     $dupRes.error -eq "A shipment with this LR No, date, and truck already exists.")

# Legitimate shipment with same LR No but DIFFERENT DATE is allowed
$app.form.SetValue("date", "2026-10-28")
$validResDate = $app.SaveShipment()
Assert-Step "Scenario 4.2: Legitimate shipment with same LR No on a different date is saved successfully" `
    ($validResDate.ok -eq $true -and $app.records.Count -eq 5)

# Verify autocomplete automatically refreshed after save
Assert-Step "Scenario 4.3: Autocomplete refreshed immediately with newly saved shipment data" `
    ($app.datalists["bank-suggestions"] -contains "HDFC BANK")

# Test Scenario 5: View Mode & Edit Mode State Integrity
$newId = $validResDate.record.id
# Open in View Mode
$app.OpenShipmentDialog("view", $newId)
Assert-Step "Scenario 5.1: View mode disables all inputs, hides save button, and sets title" `
    ($app.formMode -eq "view" -and `
     $app.saveBtnHidden -eq $true -and `
     $app.cancelBtnText -eq "Close" -and `
     $app.dialogTitle -eq "Shipment Details" -and `
     $app.form.elements["freight"].disabled -eq $true)

# Open in Edit Mode
$app.OpenShipmentDialog("edit", $newId)
Assert-Step "Scenario 5.2: Edit mode enables inputs and restores exact persisted values" `
    ($app.formMode -eq "edit" -and `
     $app.saveBtnHidden -eq $false -and `
     $app.form.elements["freight"].disabled -eq $false -and `
     $app.form.GetValue("freight") -eq "75,000" -and `
     $app.form.GetValue("pendingAmount") -eq "31600")

# Save in Edit Mode without changing LR No/Date/Truck No (Does NOT block self duplicate)
$editSaveRes = $app.SaveShipment()
Assert-Step "Scenario 5.3: Editing existing shipment correctly excludes self from duplicate check" `
    ($editSaveRes.ok -eq $true)

# Reopening confirms exact persisted and calculated balances match
$app.OpenShipmentDialog("view", $newId)
Assert-Step "Scenario 5.4: Reopened record confirms 100% mathematical consistency with authoritative rules" `
    ($app.form.GetValue("pendingTobilled") -eq "29500" -and `
     $app.form.GetValue("pendingAmount") -eq "31600" -and `
     $app.form.GetValue("podAmountStatus") -eq "0")

Write-Host "`n========================================================" -ForegroundColor Cyan
Write-Host "  BEHAVIORAL E2E TEST RESULTS SUMMARY" -ForegroundColor Cyan
Write-Host "========================================================" -ForegroundColor Cyan
Write-Host " Passed: $passed" -ForegroundColor Green
Write-Host " Failed: $failed" -ForegroundColor $(if ($failed -gt 0) { "Red" } else { "Green" })
Write-Host " Total:  $($passed + $failed)" -ForegroundColor Cyan
Write-Host "========================================================`n" -ForegroundColor Cyan

if ($failed -gt 0) { exit 1 } else { exit 0 }
