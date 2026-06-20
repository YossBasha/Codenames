$ErrorActionPreference = "Stop"

Write-Host "Bumping patch version..." -ForegroundColor Cyan

# Bump client version
Set-Location client
$newVersion = (npm version patch --no-git-tag-version)
Set-Location ..

# Bump server version to match
Set-Location server
npm version $newVersion --no-git-tag-version | Out-Null
Set-Location ..

Write-Host "New version is $newVersion" -ForegroundColor Green
Write-Host "Committing and pushing to GitHub..." -ForegroundColor Cyan

# Git operations
git add .
git commit -m "chore: release $newVersion"
git push

Write-Host "Pushing tag $newVersion..." -ForegroundColor Cyan
git tag $newVersion
git push origin $newVersion

Write-Host ""
Write-Host "===========================================================" -ForegroundColor Green
Write-Host "  Success! $newVersion has been pushed." -ForegroundColor Green
Write-Host "  GitHub Actions is now building the installer and patch." -ForegroundColor Green
Write-Host "===========================================================" -ForegroundColor Green
