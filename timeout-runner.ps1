param(
    [Parameter(Mandatory=$true)]
    [string]$Command,
    
    [int]$TimeoutSeconds = 10
)

Write-Host "Running command with ${TimeoutSeconds}s timeout: $Command" -ForegroundColor Yellow

# Start the command as a job
$job = Start-Job -ScriptBlock { param($cmd) Invoke-Expression $cmd } -ArgumentList $Command

# Wait for the job to complete or timeout
$completed = Wait-Job $job -Timeout $TimeoutSeconds

if ($completed) {
    # Get the output
    $output = Receive-Job $job
    Write-Host $output
    Remove-Job $job
    exit $job.ExitCode
} else {
    Write-Host "Command timed out after ${TimeoutSeconds} seconds!" -ForegroundColor Red
    Stop-Job $job
    Remove-Job $job
    exit 1
} 