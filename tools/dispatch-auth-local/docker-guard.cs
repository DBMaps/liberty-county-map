// Windows-only disposable CLI shim. Compiled with run.ps1 constants; never installed globally.
using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.IO;
using System.Text;
using System.Text.RegularExpressions;
using System.Threading.Tasks;
using System.Web.Script.Serialization;
class Guard {
 const string Docker=@"@@DOCKER@@", Project="@@PROJECT@@", Network="@@NETWORK@@", Log=@"@@LOG@@";
 static readonly Dictionary<string,string> Ports=new Dictionary<string,string>{{"db","54322:5432"},{"kong","54321:8000"},{"inbucket","54324:8025"},{"auth",""},{"rest",""}};
 static string Quote(string s){if(s.Length>0&&!Regex.IsMatch(s,"[\\s\"]"))return s;var b=new StringBuilder("\"");int n=0;foreach(char c in s){if(c=='\\'){n++;continue;}if(c=='"'){b.Append('\\',n*2+1);b.Append(c);}else{b.Append('\\',n);b.Append(c);}n=0;}b.Append('\\',n*2);b.Append('"');return b.ToString();}
 static ProcessStartInfo Info(string[] a){var b=new List<string>{"--host","npipe:////./pipe/dockerDesktopLinuxEngine"};foreach(var s in a)b.Add(Quote(s));return new ProcessStartInfo(Docker,string.Join(" ",b.ToArray())){UseShellExecute=false,CreateNoWindow=true,RedirectStandardOutput=true,RedirectStandardError=true};}
 static string Inspect(string name,string format){using(var p=Process.Start(Info(new[]{"inspect",name,"--format",format}))){var o=p.StandardOutput.ReadToEnd();var e=p.StandardError.ReadToEnd();p.WaitForExit();if(p.ExitCode!=0)throw new Exception("inspect failed");return o.Trim();}}
 static string Service(string name){foreach(var k in Ports.Keys)if(name=="supabase_"+k+"_"+Project)return k;throw new Exception("unexpected container identity");}
 static void Check(string name){Service(Inspect(name,"{{.Name}}").TrimStart('/'));var v=new JavaScriptSerializer().Deserialize<Dictionary<string,object>>(Inspect(name,"{{json .HostConfig.PortBindings}}"));var service=Service(Inspect(name,"{{.Name}}").TrimStart('/'));int count=0;if(v!=null)foreach(var pair in v){var list=pair.Value as System.Collections.IEnumerable;if(list==null)throw new Exception("unknown inspect binding structure");foreach(var x in list){var binding=x as Dictionary<string,object>;if(binding==null||!binding.ContainsKey("HostIp")||(string)binding["HostIp"]!="127.0.0.1"||!binding.ContainsKey("HostPort")||(string)binding["HostPort"]+":"+pair.Key.Replace("/tcp","")!=Ports[service]||!pair.Key.EndsWith("/tcp"))throw new Exception("unsafe resolved port binding");count++;}}if(count!=(Ports[service]==""?0:1))throw new Exception("unexpected published-port count");var networks=new JavaScriptSerializer().Deserialize<Dictionary<string,object>>(Inspect(name,"{{json .NetworkSettings.Networks}}"));if(networks.Count!=1||!networks.ContainsKey(Network))throw new Exception("unexpected network");}
 static int Main(string[] a){try {
  if(a.Length==0)throw new Exception("missing command");
  if(a[0]=="container"){if(a.Length<2||a[1]!="inspect")throw new Exception("unsupported container command");var normalized=new List<string>{"inspect"};for(int i=2;i<a.Length;i++)normalized.Add(a[i]);a=normalized.ToArray();}
  if(a[0]=="restart"||a[0]=="update"||a[0].StartsWith("-"))throw new Exception("unsupported lifecycle command");
  if(a[0]=="run"){
   // Only the pinned Auth bootstrap job. No publication, mounts, privilege or host network flags.
   int image=-1;bool rm=false;string network=null;int labels=0;
   for(int i=1;i<a.Length;i++){if(!a[i].StartsWith("-")){image=i;break;}string f=a[i];if(f=="--rm"){if(rm)throw new Exception("duplicate rm");rm=true;continue;}if(i+1>=a.Length)throw new Exception("missing run value");string v=a[++i];if(f=="--network"){if(network!=null)throw new Exception("duplicate network");network=v;}else if(f=="-e"){if(!Regex.IsMatch(v,"^[A-Z][A-Z0-9_]*$"))throw new Exception("unexpected environment key");}else if(f=="--label"){if(v!="com.supabase.cli.project="+Project&&v!="com.docker.compose.project="+Project)throw new Exception("unexpected project label");labels++;}else throw new Exception("unexpected migration job flag");}
   if(!rm||network!=Network||labels!=2||image<0||a.Length!=image+3||a[image]!="public.ecr.aws/supabase/gotrue:v2.197.0"||a[image+1]!="gotrue"||a[image+2]!="migrate")throw new Exception("unexpected migration job contract");
  }else if(a[0]=="create"){
   string name=null,network=null;var indices=new List<int>();int image=-1;
   var flags=new HashSet<string>{"--name","--hostname","-e","-v","--tmpfs","-p","--expose","--health-cmd","--health-interval","--health-timeout","--health-retries","--health-start-period","--restart","--security-opt","--add-host","--network","--network-alias","--label","--entrypoint"};
   for(int i=1;i<a.Length;i++){if(!a[i].StartsWith("-")){image=i;break;}if(!flags.Contains(a[i])||i+1>=a.Length)throw new Exception("unexpected create flag");string f=a[i],value=a[++i];if(f=="--name"){if(name!=null)throw new Exception("duplicate name");name=value;}if(f=="--network"){if(network!=null)throw new Exception("duplicate network");network=value;}if(f=="-p")indices.Add(i);}
   if(image<0||network!=Network)throw new Exception("missing image or isolated network");string service=Service(name);if(indices.Count!=(Ports[service]==""?0:1))throw new Exception("unexpected publication count");
   foreach(int i in indices){string before=a[i];if(before!=Ports[service]&&before!="127.0.0.1:"+Ports[service])throw new Exception("unexpected port mapping");a[i]="127.0.0.1:"+Ports[service];File.AppendAllText(Log,name+" "+before+" -> "+a[i]+Environment.NewLine);}
   string expected=new Dictionary<string,string>{{"db","postgres:17.11.0.002"},{"kong","kong:2.8.1"},{"inbucket","mailpit:v1.31.3"},{"auth","gotrue:v2.197.0"},{"rest","postgrest:v16.4"}}[service];if(a[image]!="public.ecr.aws/supabase/"+expected)throw new Exception("unexpected service image");
  }else if(a[0]=="start") {if(a.Length!=2||a[1].StartsWith("-"))throw new Exception("unexpected start arguments");Check(a[1]);}
  else if(!new HashSet<string>{"inspect","ps","info","version","image","pull","cp","exec","logs","stop","rm","volume","network","wait","kill"}.Contains(a[0]))throw new Exception("unexpected Docker CLI behavior");
  var info=Info(a);info.RedirectStandardInput=true;using(var p=Process.Start(info)){var o=p.StandardOutput.BaseStream.CopyToAsync(Console.OpenStandardOutput());var e=p.StandardError.BaseStream.CopyToAsync(Console.OpenStandardError());var input=Console.OpenStandardInput().CopyToAsync(p.StandardInput.BaseStream);input.ContinueWith(t=>{try{p.StandardInput.Close();}catch{}});p.WaitForExit();Task.WaitAll(o,e);return p.ExitCode;}
 }catch(Exception e){Console.Error.WriteLine("LOCAL_BINDING_GUARD: "+e.Message);return 125;}}
}
