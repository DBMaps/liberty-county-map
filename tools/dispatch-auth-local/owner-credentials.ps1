param([Parameter(Mandatory=$true)][ValidateSet('Seal','Show','Verify','Forget')][string]$Mode,[Parameter(Mandatory=$true)][string]$Path)
$ErrorActionPreference='Stop'
$priorModulePath=$env:PSModulePath
try{
if($PSVersionTable.PSEdition -eq 'Desktop'){$env:PSModulePath=Join-Path $PSHOME 'Modules'}
$resolved=[IO.Path]::GetFullPath($Path)
$folder=[IO.Path]::GetDirectoryName($resolved)
$tempRoot=[IO.Path]::GetFullPath($env:TEMP).TrimEnd('\')
if(-not $folder.StartsWith($tempRoot+'\',[StringComparison]::OrdinalIgnoreCase) -or [IO.Path]::GetFileName($folder) -notmatch '^gridly-dispatch-auth-[a-f0-9]{12}$' -or [IO.Path]::GetFileName($resolved) -ne 'credentials.dpapi'){throw 'Owned credential path required'}
if((Get-Item -LiteralPath $folder).Attributes -band [IO.FileAttributes]::ReparsePoint){throw 'Reparse path denied'}
if($Mode -eq 'Seal'){
 $inputText=[Console]::In.ReadToEnd();$value=$inputText | ConvertFrom-Json
 if($value.email -notmatch '^local-owner-[a-f0-9-]+@dispatch\.invalid$' -or $value.password.Length -lt 40){throw 'Synthetic credentials required'}
 $secure=ConvertTo-SecureString $inputText -AsPlainText -Force
 try{[IO.File]::WriteAllText($resolved,(ConvertFrom-SecureString $secure))}finally{$secure.Dispose();$inputText=$null;$value=$null}
 exit 0
}
$secure=ConvertTo-SecureString ([IO.File]::ReadAllText($resolved));$ptr=[IntPtr]::Zero
try{$ptr=[Runtime.InteropServices.Marshal]::SecureStringToBSTR($secure);$value=[Runtime.InteropServices.Marshal]::PtrToStringBSTR($ptr) | ConvertFrom-Json}finally{if($ptr -ne [IntPtr]::Zero){[Runtime.InteropServices.Marshal]::ZeroFreeBSTR($ptr)};$secure.Dispose()}
if($Mode -eq 'Verify'){
 $expected=[Console]::In.ReadToEnd() | ConvertFrom-Json
 if($expected.email -ne $value.email -or $expected.password -ne $value.password){throw 'Credential round-trip failed'}
 exit 0
}
Add-Type -AssemblyName System.Windows.Forms
if($Mode -eq 'Forget'){if([Windows.Forms.Clipboard]::ContainsText() -and [Windows.Forms.Clipboard]::GetText() -eq $value.password){[Windows.Forms.Clipboard]::Clear()};$value=$null;exit 0}
$dialog=New-Object Windows.Forms.Form;$dialog.Text='Gridly - private local test credentials';$dialog.Width=570;$dialog.Height=255;$dialog.StartPosition='CenterScreen';$dialog.FormBorderStyle='FixedDialog';$dialog.MaximizeBox=$false
$label=New-Object Windows.Forms.Label;$label.Text='Synthetic local account only. Do not share or screenshot this window.';$label.SetBounds(20,15,520,25);$dialog.Controls.Add($label)
$email=New-Object Windows.Forms.TextBox;$email.Text=$value.email;$email.ReadOnly=$true;$email.SetBounds(20,55,520,25);$dialog.Controls.Add($email)
$password=New-Object Windows.Forms.TextBox;$password.Text=$value.password;$password.ReadOnly=$true;$password.UseSystemPasswordChar=$true;$password.SetBounds(20,95,520,25);$dialog.Controls.Add($password)
$show=New-Object Windows.Forms.CheckBox;$show.Text='Reveal temporary password locally';$show.SetBounds(20,135,350,25);$show.Add_CheckedChanged({$password.UseSystemPasswordChar=-not $show.Checked});$dialog.Controls.Add($show)
$timer=New-Object Windows.Forms.Timer;$timer.Interval=500;$timer.Add_Tick({if(-not (Test-Path -LiteralPath $resolved)){$dialog.Close()}});$timer.Start()
try{[void]$dialog.ShowDialog()}finally{$timer.Stop();$timer.Dispose();$email.Text='';$password.Text='';$value=$null;$dialog.Dispose()}

}finally{$env:PSModulePath=$priorModulePath}
