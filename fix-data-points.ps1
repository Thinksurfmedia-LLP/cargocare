$files = @(
    "data-points.vessels.`$id.edit.tsx",
    "data-points.ports-of-discharge.new.tsx",
    "data-points.ports-of-discharge.`$id.edit.tsx",
    "data-points.loading-ports.new.tsx", 
    "data-points.loading-ports.`$id.edit.tsx",
    "data-points.equipment.new.tsx",
    "data-points.equipment.`$id.edit.tsx",
    "data-points.destination-countries.new.tsx",
    "data-points.destination-countries.`$id.edit.tsx",
    "data-points.commodities.`$id.edit.tsx",
    "data-points.carriers.`$id.edit.tsx",
    "data-points.business-branches.`$id.edit.tsx"
)

foreach ($file in $files) {
    $filePath = "app\routes\$file"
    if (Test-Path $filePath) {
        Write-Host "Processing $file..."
        
        # Read file content
        $content = Get-Content $filePath -Raw
        
        # Skip if already fixed
        if (-not $content.Contains('import pkg from "@react-router/node";')) {
            Write-Host "  Already fixed, skipping..."
            continue
        }
        
        # Remove the pkg import lines
        $content = $content -replace 'import pkg from "@react-router/node";\s*\r?\nconst \{ json \} = pkg;\s*\r?\n', ''
        
        # Replace json() calls
        $content = $content -replace 'return json\(([^,)]+)\);', 'return $1;'
        $content = $content -replace 'return json\(([^,)]+), \{ status: (\d+) \}\);', 'return Response.json($1, { status: $2 });'
        
        # Write back to file
        Set-Content $filePath -Value $content -NoNewline
        Write-Host "  Fixed!"
    }
}

Write-Host "All files processed!"
