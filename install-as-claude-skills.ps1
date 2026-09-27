# Installs every skill in this library into a Claude skills folder.
# Claude only discovers skills one level deep (<skills-dir>\<skill-name>\SKILL.md),
# so the atomic\ and composite\ tree is flattened on install.
#
#   .\install.ps1                        -> ~\.claude\skills            (all your projects)
#   .\install.ps1 -Project C:\my\project -> C:\my\project\.claude\skills
param([string]$Project)

$ErrorActionPreference = 'Stop'
$src = $PSScriptRoot
if ($Project) { $dest = Join-Path $Project '.claude\skills' } else { $dest = Join-Path $HOME '.claude\skills' }

node (Join-Path $src 'tools\validate-skills.js')
if ($LASTEXITCODE -ne 0) { throw 'Skill validation failed; nothing installed.' }
New-Item -ItemType Directory -Force $dest | Out-Null

$skills = Get-ChildItem -Path (Join-Path $src 'atomic'), (Join-Path $src 'composite') -Recurse -Filter SKILL.md |
  Where-Object { $_.Directory.Name -ne 'references' }
foreach ($skill in $skills) {
  $target = Join-Path $dest $skill.Directory.Name
  if (Test-Path $target) { Remove-Item -Recurse -Force $target }
  Copy-Item -Recurse $skill.Directory.FullName $target
}
Write-Host "Installed $($skills.Count) skills into $dest"
