import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdirSync,writeFileSync,readFileSync,existsSync,cpSync,readdirSync,symlinkSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {resolve,join} from 'node:path';
import {installPlugin,validateInstalled,writeSetupReceipt} from './install.mjs';

const root=resolve(process.env.MAC_INSTALLER_TEST_ROOT||'work/mac-installer/tests');
if(existsSync(root))throw new Error('Use a fresh installer test root.');
mkdirSync(root,{recursive:true});
const source=join(root,'fixture-source');mkdirSync(join(source,'.codex-plugin'),{recursive:true});mkdirSync(join(source,'runtime'),{recursive:true});
writeFileSync(join(source,'plugin.json'),JSON.stringify({name:'oracle-exam-practice',version:'1.1.0'}));writeFileSync(join(source,'.codex-plugin','plugin.json'),JSON.stringify({mcpServers:'./.mcp.json'}));writeFileSync(join(source,'runtime','NODE-LICENSE.txt'),'Synthetic test license fixture');
const runtime=join(root,'runtime-fixture');writeFileSync(runtime,'Synthetic executable fixture — used only with a mocked validator');
function profile(name){const path=join(root,name);mkdirSync(path,{recursive:true});return path;}
function install(home,extra={}){return installPlugin({source,runtime,profileRoot:home,validate:()=>{},log:()=>{},...extra});}

test('CLI starts through an aliased temporary path instead of silently exiting',()=>{
 const alias=join(root,'temporary-folder-alias');
 symlinkSync(fileURLToPath(new URL('.',import.meta.url)),alias,process.platform==='win32'?'junction':'dir');
 const env={...process.env};delete env.NODE_TEST_CONTEXT;
 const result=spawnSync(process.execPath,[join(alias,'install.mjs'),'--silent'],{encoding:'utf8',env,timeout:15000});
 assert.ifError(result.error);assert.equal(result.status,1);
 assert.match(result.stderr,/SETUP FAILED: Installer payload\/runtime missing/);
});

test('fresh setup uses contained runtime and creates one catalog entry',()=>{
 const home=profile('Fresh profile with spaces'),result=install(home);
 const catalog=JSON.parse(readFileSync(result.catalogPath));assert.equal(catalog.plugins.length,1);
 const portable=JSON.parse(readFileSync(join(result.installPath,'mcp.json')));assert.equal(portable.mcpServers['oracle-exam-practice'].command,'./runtime/node');
 const legacy=JSON.parse(readFileSync(join(result.installPath,'.mcp.json')));assert.equal(legacy.mcpServers['oracle-exam-practice'].command,join(result.installPath,'runtime','node'));
 assert.ok(existsSync(join(result.installPath,'runtime','NODE-LICENSE.txt')));
});
test('reinstall updates one entry, preserves prior installation, and backs up catalog',()=>{
 const home=profile('Reinstall'),first=install(home);const before=readFileSync(first.catalogPath,'utf8');const second=install(home);
 assert.notEqual(first.installPath,second.installPath);assert.ok(existsSync(first.installPath));assert.equal(JSON.parse(readFileSync(second.catalogPath)).plugins.length,1);
 const backups=readdirSync(join(home,'.agents','plugins')).filter(n=>n.endsWith('.bak'));assert.equal(backups.length,1);assert.equal(readFileSync(join(home,'.agents','plugins',backups[0]),'utf8'),before);
});
test('existing entries, custom settings and Oracle policy are preserved',()=>{
 const home=profile('Existing catalog');mkdirSync(join(home,'.agents','plugins'),{recursive:true});
 writeFileSync(join(home,'.agents','plugins','marketplace.json'),JSON.stringify({name:'employee-catalog',customSetting:7,plugins:[{name:'another-plugin',source:{source:'local',path:'./other'}},{name:'oracle-exam-practice',source:{source:'local',path:'./old'},policy:{installation:'NOT_AVAILABLE',authentication:'ON_USE'},customFlag:true}]}));
 const result=install(home),cat=JSON.parse(readFileSync(result.catalogPath));assert.equal(cat.customSetting,7);assert.equal(cat.name,'employee-catalog');assert.equal(cat.plugins[0].source.path,'./other');assert.equal(cat.plugins[1].policy.installation,'NOT_AVAILABLE');assert.equal(cat.plugins[1].customFlag,true);
});
test('malformed catalog is rejected without replacement',()=>{
 const home=profile('Malformed catalog');mkdirSync(join(home,'.agents','plugins'),{recursive:true});const path=join(home,'.agents','plugins','marketplace.json');writeFileSync(path,'not JSON');assert.throws(()=>install(home));assert.equal(readFileSync(path,'utf8'),'not JSON');
});
test('concurrent catalog edits are not overwritten',()=>{
 const home=profile('Concurrent edit');mkdirSync(join(home,'.agents','plugins'),{recursive:true});const path=join(home,'.agents','plugins','marketplace.json');writeFileSync(path,JSON.stringify({name:'original',plugins:[]}));
 const concurrent=JSON.stringify({name:'concurrently-updated',plugins:[]});assert.throws(()=>install(home,{validate:()=>writeFileSync(path,concurrent)}),/Catalog changed/);assert.equal(readFileSync(path,'utf8'),concurrent);
});
test('copied real application passes all sixteen checks using the available test runtime',()=>{
 const realSource=join(root,'real-source');cpSync(resolve(process.env.MAC_PLUGIN_SOURCE||fileURLToPath(new URL('../../plugins/oracle-exam-practice',import.meta.url))),realSource,{recursive:true});mkdirSync(join(realSource,'runtime'),{recursive:true});writeFileSync(join(realSource,'runtime','NODE-LICENSE.txt'),'Test only; redistribution payload uses official license');
 let log='';const result=install(profile('Full application check'),{source:realSource,runtime:process.execPath,validate:(path,node,logger)=>validateInstalled(path,process.execPath,logger),log:line=>{log+=line+'\n';}});
 assert.ok(log.includes('pass 16'));assert.ok(existsSync(result.catalogPath));
});

test('setup report exposes actual file paths and a correctly encoded local plug-in link',()=>{
 const home=profile('Receipt profile with spaces'),result=install(home),folder=profile('Downloaded installer folder');
 const logfile=join(home,'Library','Logs','OracleExamPractice','setup.log');
 const{report,helper}=writeSetupReceipt({result,logfile,folder});
 const contents=readFileSync(report,'utf8');assert.ok(contents.includes(result.catalogPath));assert.ok(contents.includes(logfile));assert.ok(contents.includes('Command-Q'));assert.ok(contents.includes('Plug-Ins > Personal'));
 const link=result.pluginLink;assert.equal(decodeURIComponent(link.split('marketplacePath=')[1]),result.catalogPath);
 assert.ok(readFileSync(helper,'utf8').includes(link));assert.ok(!contents.includes('SETUP COMPLETE'));
});

test('CLI completes installation and writes the launcher completion receipt',()=>{
 const home=profile('CLI completion'),folder=profile('CLI receipts'),marker=join(folder,'completion.json');
 // The Mac runtime is called "node" without .exe. Windows cannot start that
 // copied name; only in this test copy, validate with the native test runtime.
 let cli=fileURLToPath(new URL('./install.mjs',import.meta.url));
 if(process.platform==='win32'){
  const copy=join(folder,'install-test.mjs');
  writeFileSync(copy,readFileSync(cli,'utf8').replace('validate=validateInstalled','validate=(path,node,log)=>validateInstalled(path,process.execPath,log)'));
  cli=copy;
 }
 const env={...process.env};delete env.NODE_TEST_CONTEXT;
 const result=spawnSync(process.execPath,[cli,'--source',join(root,'real-source'),'--runtime',process.execPath,'--profile-root',home,'--receipt-dir',folder,'--result-file',marker,'--silent'],{encoding:'utf8',env,timeout:120000});
 assert.ifError(result.error);assert.equal(result.status,0,result.stdout+result.stderr);
 const receipt=JSON.parse(readFileSync(marker,'utf8'));
 assert.equal(receipt.status,'files-and-catalog-verified');
 for(const path of [receipt.catalogPath,receipt.report,receipt.helper])assert.ok(existsSync(path));
 assert.match(result.stdout,/FILES AND CATALOG VERIFIED/);
});
