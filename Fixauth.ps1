$files = @(
    "app\events\page.tsx",
    "app\guests\page.tsx",
    "app\old-dashboard\layout.tsx",
    "app\old-dashboard\page.tsx"
)

foreach ($file in $files) {
    $content = Get-Content $file -Raw
    if ($content -notmatch "import { authOptions }") {
        $content = $content -replace "import { getServerSession } from 'next-auth';", "import { getServerSession } from 'next-auth';`nimport { authOptions } from '@/lib/auth';"
    }
    $content = $content -replace "getServerSession\(\)", "getServerSession(authOptions)"
    Set-Content $file $content
    Write-Host "Fixed: $file"
}

Write-Host "All done!"