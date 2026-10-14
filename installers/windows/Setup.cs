using System;
using System.IO;
using System.Diagnostics;
using System.Reflection;
using System.Security.Cryptography;
using System.Windows.Forms;

[assembly: AssemblyTitle("Oracle Exam Practice Setup")]
[assembly: AssemblyDescription("Per-user offline installer for Oracle Exam Practice")]
[assembly: AssemblyVersion("1.1.0.0")]
class Setup {
    static string Q(string s) { if(s.Contains("\"") || s.EndsWith("\\")) throw new ArgumentException("Invalid argument path"); return "\"" + s + "\""; }
    static void Extract(string name, string path) {
        using(var input = Assembly.GetExecutingAssembly().GetManifestResourceStream(name)) {
            if(input == null) throw new Exception("Installer resource missing: " + name);
            using(var output=File.Create(path)) input.CopyTo(output);
        }
    }
    [STAThread] static int Main(string[] args) {
        Application.EnableVisualStyles();
        bool silent=false;
        string profile=Environment.GetFolderPath(Environment.SpecialFolder.UserProfile);
        string log=null;
        string temp=null;
        try {
            for(int i=0;i<args.Length;i++) {
                if(args[i]=="--silent") silent=true;
                else if(args[i]=="--profile-root" && i+1<args.Length) profile=Path.GetFullPath(args[++i]);
                else if(args[i]=="--log" && i+1<args.Length) log=Path.GetFullPath(args[++i]);
                else throw new ArgumentException("Supported options: --silent --profile-root PATH --log PATH");
            }
            if(!Directory.Exists(profile)) throw new Exception("Profile directory does not exist.");
            if(log==null) log=Path.Combine(Path.GetTempPath(),"OracleExamPractice-setup-"+Guid.NewGuid().ToString("N")+".log");
            if(!silent && MessageBox.Show("Install Oracle Exam Practice for this Windows user?\n\nIncludes the runtime and dependencies. No download or administrator access is needed. Your existing plug-in catalog and exam data will be preserved.\n\nAfter setup, restart ChatGPT desktop and enable the plug-in in its local catalog.","Oracle Exam Practice Setup",MessageBoxButtons.OKCancel,MessageBoxIcon.Information)!=DialogResult.OK) return 2;
            temp=Path.Combine(Path.GetTempPath(),"OracleExamPractice-"+Guid.NewGuid().ToString("N"));
            Directory.CreateDirectory(temp);
            string payload=Path.Combine(temp,"payload.zip"),script=Path.Combine(temp,"Install.ps1");
            Extract("payload.zip",payload); Extract("Install.ps1",script);
            using(var hash=SHA256.Create()) using(var stream=File.OpenRead(payload)) {
                string actual=BitConverter.ToString(hash.ComputeHash(stream)).Replace("-","").ToLowerInvariant();
                if(actual != "PAYLOAD_HASH") throw new Exception("Embedded payload integrity check failed.");
            }
            string powershell=Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.System),"WindowsPowerShell","v1.0","powershell.exe");
            var info=new ProcessStartInfo(powershell,"-NoLogo -NoProfile -NonInteractive -ExecutionPolicy Bypass -File "+Q(script)+" -Payload "+Q(payload)+" -ProfileRoot "+Q(profile)+" -LogFile "+Q(log));
            info.UseShellExecute=false; info.CreateNoWindow=true;
            using(var process=Process.Start(info)) { process.WaitForExit(); if(process.ExitCode!=0) throw new Exception("Setup could not finish. Your existing catalog was not replaced.\n\nLog: "+log); }
            if(!silent) MessageBox.Show("Files installed and plug-in catalog updated.\n\nRestart ChatGPT desktop, open Work/Codex > Plugins Directory, select your local catalog, and install/enable Oracle Exam Practice.\n\nNo separate Node.js installation is needed. ChatGPT and exam research still require internet access.\n\nLog: "+log,"Oracle Exam Practice — Setup Complete",MessageBoxButtons.OK,MessageBoxIcon.Information);
            return 0;
        } catch(Exception e) {
            if(log!=null) { try {File.AppendAllText(log,"\nLauncher: "+e.Message);} catch {} }
            if(!silent) MessageBox.Show(e.Message,"Oracle Exam Practice — Setup Failed",MessageBoxButtons.OK,MessageBoxIcon.Error);
            return 1;
        } finally {
            // This is only the GUID-named extraction directory created by this process.
            if(temp!=null && Path.GetFullPath(temp).StartsWith(Path.GetFullPath(Path.GetTempPath()),StringComparison.OrdinalIgnoreCase) && Path.GetFileName(temp).StartsWith("OracleExamPractice-")) {
                try {Directory.Delete(temp,true);} catch {}
            }
        }
    }
}
