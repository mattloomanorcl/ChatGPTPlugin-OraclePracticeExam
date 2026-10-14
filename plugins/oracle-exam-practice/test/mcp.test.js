import test from 'node:test';
import assert from 'node:assert/strict';
import {Client} from '@modelcontextprotocol/sdk/client/index.js';
import {StreamableHTTPClientTransport} from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import {StdioClientTransport} from '@modelcontextprotocol/sdk/client/stdio.js';
import {fileURLToPath} from 'node:url';
import {createHttpServer} from '../src/server.js';
import {ExamStore} from '../src/exams.js';

test('MCP initializes, lists annotated tools, serves UI and entry form',async()=>{
 const store=new ExamStore(),http=createHttpServer(store);await new Promise(resolve=>http.listen(0,'127.0.0.1',resolve));
 const base=`http://127.0.0.1:${http.address().port}`;
 const client=new Client({name:'qa-client',version:'1.0.0'});
 try{
  await client.connect(new StreamableHTTPClientTransport(new URL(base+'/mcp')));
  const list=await client.listTools();assert.equal(list.tools.length,4);
  assert.deepEqual(list.tools.find(t=>t.name==='submit_exam')._meta.ui.visibility,['app']);
  const resources=await client.listResources();assert.equal(resources.resources.length,1);
  const resource=await client.readResource({uri:resources.resources[0].uri});assert.ok(resource.contents[0].text.includes('Generate 50 questions'));
  const result=await client.callTool({name:'open_exam_practice',arguments:{}});assert.equal(result.structuredContent.status,'entry');
  assert.equal((await fetch(base+'/health')).status,200);
  assert.equal((await fetch(base+'/mcp',{method:'POST',headers:{Origin:'https://evil.example'}})).status,403);
 }finally{await client.close();await new Promise(resolve=>http.close(resolve));store.close();}
});

test('installed runtime can start the stdio server and discover the exam UI',async()=>{
 const client=new Client({name:'stdio-installer-check',version:'1.0.0'});
 const transport=new StdioClientTransport({command:process.execPath,args:[fileURLToPath(new URL('../src/server.js',import.meta.url)),'--stdio'],env:{...Object.fromEntries(Object.entries(process.env).filter(([,value])=>typeof value==='string')),EXAM_DB:':memory:'}});
 try{
  await client.connect(transport);
  assert.equal((await client.listTools()).tools.length,4);
  const result=await client.callTool({name:'open_exam_practice',arguments:{}});
  assert.equal(result.structuredContent.status,'entry');
  const resources=await client.listResources();
  const ui=await client.readResource({uri:resources.resources[0].uri});
  assert.ok(ui.contents[0].text.includes('Generate 50 questions'));
 }finally{await client.close();}
});
