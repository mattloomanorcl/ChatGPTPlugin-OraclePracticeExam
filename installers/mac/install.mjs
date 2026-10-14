import {cpSync,copyFileSync,chmodSync,mkdirSync,lstatSync,existsSync,readFileSync,writeFileSync,renameSync,unlinkSync,realpathSync} from 'node:fs';
import {resolve,join,relative,isAbsolute,dirname,sep} from 'node:path';
import {homedir,userInfo} from 'node:os';
import {randomUUID} from 'node:crypto';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';

function inside(root,path){const result=resolve(path),rel=relative(root,result);if(!rel||rel==='..'||rel.startsWith('..'+sep)||isAbsolute(rel))throw new Error('Install path escaped the selected profile.');return result;}
function safeDirectory(root,path){const full=inside(root,path);for(let current=full;current!==root;current=dirname(current)){if(existsSync(current)){const stat=lstatSync(current);if(stat.isSymbolicLink()||!stat.isDirectory())throw new Error('Install folders must be directories, not symbolic links.');}}mkdirSync(full,{recursive:true,mode:0o700});return full;}
function readCatalog(path){if(!existsSync(path))return{original:null,catalog:{name:'oracle-practice-local',interface:{displayName:'Oracle Practice (Local)'},plugins:[]}};if(lstatSync(path).isSymbolicLink())throw new Error('Catalog must not be a symbolic link.');const original=readFileSync(path,'utf8'),catalog=JSON.parse(original);if(!catalog||typeof catalog.name!=='string'||!Array.isArray(catalog.plugins)||catalog.plugins.some(p=>!p||typeof p.name!=='string'))throw new Error('Existing catalog is invalid; it has not been changed.');return{original,catalog};}

export function validateInstalled(installPath,nodePath,log){
 const version=spawnSync(nodePath,['--version'],{encoding:'utf8',timeout:15000});
 if(version.status!==0||!version.stdout.trim().startsWith('v24.'))throw new Error('Bundled runtime failed to start. Check macOS compatibility and company software policies.');
 log('Bundled runtime: '+version.stdout.trim());
 const checkEnv={...process.env,EXAM_DB:':memory:'};delete checkEnv.NODE_TEST_CONTEXT;
 const result=spawnSync(nodePath,['--test',join(installPath,'test','exams.test.js'),join(installPath,'test','freshness.test.js'),join(installPath,'test','mcp.test.js')],{encoding:'utf8',timeout:120000,env:checkEnv});
 log(result.stdout||'');log(result.stderr||'');
 if(result.status!==0)throw new Error('Plug-in checks failed. The existing catalog was preserved.');
}

export function installPlugin({source,profileRoot=homedir(),runtime,validate=validateInstalled,log=console.log}){
 const root=resolve(profileRoot);if(!existsSync(root)||!lstatSync(root).isDirectory()||lstatSync(root).isSymbolicLink())throw new Error('Profile root must be an existing directory, not a symbolic link.');
 const catalogDir=safeDirectory(root,join(root,'.agents','plugins')),catalogPath=inside(root,join(catalogDir,'marketplace.json'));
 const{original,catalog}=readCatalog(catalogPath);
 const matches=catalog.plugins.filter(p=>p.name==='oracle-exam-practice');if(matches.length>1)throw new Error('Duplicate Oracle plug-in catalog entries; resolve them before installing.');
 const manifest=JSON.parse(readFileSync(join(source,'plugin.json'),'utf8'));
 if(manifest.name!=='oracle-exam-practice'||!/^\d+\.\d+\.\d+$/.test(manifest.version))throw new Error('Unexpected payload manifest.');
 const stamp=new Date().toISOString().replace(/[^0-9]/g,'')+'-'+randomUUID().slice(0,8);
 const parent=safeDirectory(root,join(root,'.codex','plugins'));
 const installPath=safeDirectory(root,join(parent,'oracle-exam-practice-'+manifest.version+'-'+stamp));
 log('Installing to '+installPath);
 cpSync(source,installPath,{recursive:true,dereference:false,filter:path=>relative(source,path).split(sep)[0]!=='runtime'});
 const runtimeDir=safeDirectory(root,join(installPath,'runtime')),nodePath=join(runtimeDir,'node');
 copyFileSync(runtime,nodePath);chmodSync(nodePath,0o755);
 copyFileSync(join(source,'runtime','NODE-LICENSE.txt'),join(runtimeDir,'NODE-LICENSE.txt'));
 const server={type:'stdio',command:'./runtime/node',args:['${PLUGIN_ROOT}/src/server.js','--stdio']};
 writeFileSync(join(installPath,'mcp.json'),JSON.stringify({$schema:'https://agent-plugins.org/schemas/1.0.0/mcp.schema.json',mcpServers:{'oracle-exam-practice':server}},null,2)+'\n',{mode:0o600});
 writeFileSync(join(installPath,'.mcp.json'),JSON.stringify({mcpServers:{'oracle-exam-practice':{command:nodePath,args:server.args,startup_timeout_sec:60}}},null,2)+'\n',{mode:0o600});
 if(!existsSync(join(installPath,'.codex-plugin','plugin.json')))throw new Error('Host compatibility manifest missing.');
 validate(installPath,nodePath,log);
 const sourceEntry={source:'local',path:'./'+relative(root,installPath).split(sep).join('/')};
 if(matches.length)matches[0].source=sourceEntry;
 else catalog.plugins.push({name:'oracle-exam-practice',source:sourceEntry,policy:{installation:'AVAILABLE',authentication:'ON_INSTALL'},category:'Productivity'});
 if(original===null?existsSync(catalogPath):!existsSync(catalogPath)||readFileSync(catalogPath,'utf8')!==original)throw new Error('Catalog changed during setup; no edits were overwritten. Run setup again.');
 const temp=inside(root,join(catalogDir,'marketplace-'+stamp+'.tmp'));
 writeFileSync(temp,JSON.stringify(catalog,null,2)+'\n',{mode:0o600,flag:'wx'});
 if(original!==null){const backup=inside(root,join(catalogDir,'marketplace-before-oracle-'+stamp+'.json.bak'));copyFileSync(catalogPath,backup);log('Catalog backup: '+backup);}
 try{renameSync(temp,catalogPath);}catch(error){if(existsSync(temp))unlinkSync(temp);throw error;}
 const verified=readCatalog(catalogPath).catalog.plugins.find(p=>p.name==='oracle-exam-practice');
 if(!verified||verified.source?.path!==sourceEntry.path)throw new Error('Catalog verification failed; see the printed installation paths.');
 const catalogName=catalog.interface?.displayName||catalog.name;
 log('FILES AND CATALOG VERIFIED — CHATGPT ACTIVATION REQUIRED');
 log('Mac user profile: '+root);log('Catalog file: '+catalogPath);log('Installed files: '+installPath);
 log('Fully quit ChatGPT (Command-Q), reopen it, select Plug-Ins in the left menu, then the Personal tab, and install/enable Oracle Exam Practice.');
 log('Start a new chat and ask: Open Oracle Exam Practice.');
 return{installPath,catalogPath,catalogName,profileRoot:root,version:manifest.version,pluginLink:'codex://plugins/oracle-exam-practice?marketplacePath='+encodeURIComponent(catalogPath)};
}

export function writeSetupReceipt({result,logfile,folder}){
 folder=resolve(folder);
 if(!existsSync(folder)||!lstatSync(folder).isDirectory()||lstatSync(folder).isSymbolicLink())throw new Error('Setup report folder is unavailable.');
 const report=join(folder,'Oracle-Exam-Practice-Setup-Report.txt');
 writeFileSync(report,['Oracle Exam Practice — Mac setup report (installer revision 3)','Files/catalog verified; ChatGPT activation is still required.','Mac profile: '+result.profileRoot,'Installed files: '+result.installPath,'Catalog file: '+result.catalogPath,'Log file: '+logfile,'Open local plug-in: '+result.pluginLink,'Fully quit ChatGPT with Command-Q, reopen it, then use Plug-Ins > Personal.','If the plug-in is absent, open Open-Oracle-Exam-Practice.webloc beside this report.','Finder > Go > Go to Folder (Shift-Command-G): paste one of the full paths above to locate hidden folders.'].join('\n')+'\n',{mode:0o600});
 const helper=join(folder,'Open-Oracle-Exam-Practice.webloc');
 writeFileSync(helper,'<?xml version="1.0" encoding="UTF-8"?><plist version="1.0"><dict><key>URL</key><string>'+result.pluginLink.replaceAll('&','&amp;').replaceAll('<','&lt;')+'</string></dict></plist>\n',{mode:0o600});
 return{report,helper};
}

// Node canonicalizes the module URL. macOS TMPDIR commonly uses /var while
// the canonical location is /private/var, so compare physical paths on both sides.
if(process.argv[1]&&realpathSync(process.argv[1])===realpathSync(fileURLToPath(import.meta.url))){
 let profileRoot=userInfo().homedir,source,runtime,receiptDir,resultFile,openPlugin=false;
 try{
  const args=process.argv.slice(2);
  for(let i=0;i<args.length;i++){if(args[i]==='--source')source=args[++i];else if(args[i]==='--runtime')runtime=args[++i];else if(args[i]==='--profile-root')profileRoot=args[++i];else if(args[i]==='--receipt-dir')receiptDir=args[++i];else if(args[i]==='--result-file')resultFile=args[++i];else if(args[i]==='--open-plugin')openPlugin=true;else if(args[i]!=='--silent')throw new Error('Unknown installer option.');}
  if(!source||!runtime)throw new Error('Installer payload/runtime missing.');
  if(process.platform==='darwin'&&process.getuid?.()===0)throw new Error('Run this installer as your normal Mac user, without sudo.');
  const logDir=safeDirectory(resolve(profileRoot),join(resolve(profileRoot),'Library','Logs','OracleExamPractice'));
  const logfile=join(logDir,'setup-'+Date.now()+'.log');
  const log=text=>{console.log(text);writeFileSync(logfile,String(text)+'\n',{flag:'a',mode:0o600});};
  try{
   const result=installPlugin({source:resolve(source),runtime:resolve(runtime),profileRoot,log});log('Log file: '+logfile);
   let receipt;
   try{receipt=writeSetupReceipt({result,logfile,folder:receiptDir||logDir});}
   catch(error){log('Could not save a report beside the installer: '+error.message);receipt=writeSetupReceipt({result,logfile,folder:logDir});}
   const{report,helper}=receipt;
   log('Setup report: '+report);log('Local plug-in helper: '+helper);
   if(resultFile)writeFileSync(resolve(resultFile),JSON.stringify({status:'files-and-catalog-verified',...result,...receipt})+'\n',{mode:0o600,flag:'wx'});
   if(openPlugin&&process.platform==='darwin'){
    const opened=spawnSync('/usr/bin/open',[helper],{encoding:'utf8'});
    if(opened.status!==0)log('Could not open the local plug-in page automatically. Open the helper file manually.');
   }
  }
  catch(error){log('SETUP FAILED: '+error.message);log('Log: '+logfile);process.exitCode=1;}
 }catch(error){console.error('SETUP FAILED: '+error.message);process.exitCode=1;}
}
