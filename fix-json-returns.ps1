# PowerShell script to fix all json() function calls in data-points files

$dataPointsFiles = Get-ChildItem -Path "app\routes\data-points.*.tsx" -File

foreach ($file in $dataPointsFiles) {
    Write-Host "Processing $($file.Name)..."
    
    $content = Get-Content $file.FullName -Raw
    
    # Fix simple return json({ data }) patterns (success responses in loader functions)
    $content = $content -replace 'return json\(\{\s*([^}]+)\s*\}\);', 'return { $1 };'
    
    # Fix error responses with status codes
    $content = $content -replace 'return json\(\{\s*([^}]+)\s*\},\s*\{\s*status:\s*(\d+)\s*\}\);', 'return Response.json({ $1 }, { status: $2 });'
    
    # Write back to file
    Set-Content -Path $file.FullName -Value $content -NoNewline
    
    Write-Host "Fixed $($file.Name)"
}

Write-Host "All data-points files have been processed!"
