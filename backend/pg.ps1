<#
    Start / stop the local PostgreSQL 18 instance used for development.

    This is a portable (no-installer) PostgreSQL, extracted to %USERPROFILE%\pg18
    because the machine account lacks local Administrator rights. It is not a
    Windows service, so it must be started manually after each reboot.

        .\pg.ps1 start
        .\pg.ps1 stop
        .\pg.ps1 status
        .\pg.ps1 psql     # interactive shell against linq_crm
#>
param(
    [ValidateSet("start", "stop", "status", "psql")]
    [string]$Action = "status"
)

$root = Join-Path $env:USERPROFILE "pg18"
$bin  = Join-Path $root "pgsql\bin"
$data = Join-Path $root "data"
$log  = Join-Path $root "server.log"

if (-not (Test-Path -LiteralPath $bin)) {
    Write-Error "PostgreSQL not found at $root"
    exit 1
}

switch ($Action) {
    "start"  { & "$bin\pg_ctl.exe" -D $data -l $log -o "-p 5432" -w start }
    "stop"   { & "$bin\pg_ctl.exe" -D $data -w -m fast stop }
    "status" { & "$bin\pg_ctl.exe" -D $data status }
    "psql"   {
        $env:PGPASSWORD = "linqcrm_local"
        & "$bin\psql.exe" -h 127.0.0.1 -p 5432 -U postgres -d linq_crm
    }
}
