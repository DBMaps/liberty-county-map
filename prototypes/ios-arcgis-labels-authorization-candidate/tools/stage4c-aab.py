"""Read-only retained-artifact inspection. No rebuild, signing, upload or revocation lookup."""
from pathlib import Path
import hashlib, json, subprocess
base=Path(__file__).resolve().parents[1]
out=base/'evidence'/'stage4c'
aab=Path(r'C:\Users\gulfi\AppData\Local\Gridly\r102a17-62a3d3a8\out\Gridly-1.0.2-versionCode17-release.aab')
jdk=Path(r'C:\Program Files\Eclipse Adoptium\jdk-21.0.12.101-hotspot\bin')
bundletool=Path(r'C:\Users\gulfi\.codex\worktrees\4f7a\liberty-county-map\.artifacts\android-production-recovery\bundletool-all-1.18.1.jar')
def digest(path):
    h=hashlib.sha256()
    with path.open('rb') as file:
        for data in iter(lambda:file.read(1024*1024),b''):h.update(data)
    return h.hexdigest()
def run(command):
    return subprocess.run([str(x) for x in command],capture_output=True,text=True,timeout=90,creationflags=subprocess.CREATE_NO_WINDOW)
result={'path':str(aab),'bytes':aab.stat().st_size,'sha256':digest(aab)}
result['matchesOwnerIdentity']=result['bytes']==116049539 and result['sha256']=='1941c1ddd1b4e807feffbb1d457e1edfc310317edaaab6427fa56fd32e8c33a7'
signed=run([jdk/'jarsigner.exe','-verify',aab]);output=signed.stdout+signed.stderr
(out/'aab-signature.log').write_text(output,encoding='utf8')
result['signature']={'exitCode':signed.returncode,'verified':'jar verified.' in output,'warnings':[line for line in output.splitlines() if 'self-signed' in line or 'timestamp' in line or 'invalid' in line or 'unsigned' in line or 'inconsisten' in line]}
cert=run([jdk/'keytool.exe','-printcert','-jarfile',aab]);(out/'aab-certificate.txt').write_text(cert.stdout+cert.stderr,encoding='utf8')
result['certificateSha256']=next((line.strip().split('SHA256:',1)[1].strip() for line in cert.stdout.splitlines() if 'SHA256:' in line),None)
for field,xpath in [('package','/manifest/@package'),('versionName','/manifest/@android:versionName'),('versionCode','/manifest/@android:versionCode')]:
    r=run([jdk/'java.exe','-jar',bundletool,'dump','manifest','--bundle='+str(aab),'--xpath='+xpath])
    if r.returncode:raise RuntimeError('Read-only bundletool inspection failed: '+r.stderr[:500])
    result[field]=r.stdout.strip()
result['unchangedAfterInspection']=aab.stat().st_size==result['bytes'] and digest(aab)==result['sha256']
(out/'android-aab.json').write_text(json.dumps(result,indent=2)+'\n',encoding='utf8')
print(json.dumps(result,indent=2))
