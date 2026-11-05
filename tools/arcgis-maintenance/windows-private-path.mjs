import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {assertPlainPath} from './staging.mjs';
export async function windowsPrivatePathVerified(path,kind='File') {
  if(process.platform!=='win32'||!['File','Directory'].includes(kind))return false;
  try {
    await assertPlainPath(path);
    const script=fileURLToPath(new URL('./Assert-GridlyPrivatePath.ps1',import.meta.url));
    const result=execFileSync('powershell.exe',['-NoProfile','-NonInteractive','-File',script,'-Path',path,'-Kind',kind],
      {encoding:'utf8',stdio:['ignore','pipe','pipe'],windowsHide:true,maxBuffer:2048,timeout:15000});
    return result.trim()==='PRIVATE_PATH_VALID';
  }catch{return false;}
}
export async function privatePathVerified(path,kind='File') {
  if(process.platform==='win32')return windowsPrivatePathVerified(path,kind);
  // POSIX mode bits alone do not prove macOS extended ACL privacy.
  // An owner-reviewed Mac ACL adapter is required before real iOS staging.
  return false;
}
