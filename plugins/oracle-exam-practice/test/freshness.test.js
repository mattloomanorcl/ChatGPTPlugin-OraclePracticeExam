import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,existsSync,unlinkSync,rmdirSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {ExamStore,questionSignature,signaturesMatch} from '../src/exams.js';
const blueprint={examName:'Synthetic freshness fixture',examCode:'1Z0-999',officialExamUrl:'https://education.oracle.com/test',objectives:['Synthetic topic'],researchSummary:'Synthetic tests only'};
const questions=(prefix='Original database scenario')=>Array.from({length:50},(_,i)=>({prompt:`${prefix} ${i+1}?`,topic:'Synthetic topic',options:['A','B','C','D'].map(id=>({id,text:`Option ${id}`})),correctAnswers:['A'],explanation:'Fixture explanation',optionExplanations:{A:'Correct',B:'Wrong',C:'Wrong',D:'Wrong'},references:[{title:'Fixture',url:'https://docs.oracle.com/test',relevance:'Synthetic fixture only'}]}));
const original=questions(),fresh=questions('Distinct optimizer recovery workload');
function add(store,d,qs){let result;for(let i=0;i<qs.length;i+=10)result=store.append(d.draftId,d.authorToken,qs.slice(i,i+10));return result;}
function temporaryDb(run){const dir=mkdtempSync(join(tmpdir(),'oracle-freshness-')),path=join(dir,'test.sqlite');try{return run(path);}finally{for(const suffix of ['','-wal','-shm'])if(existsSync(path+suffix))unlinkSync(path+suffix);rmdirSync(dir);}}

test('same exam starts fresh and rejects more than 20 repeated questions without saving rejected batch',()=>{
 const store=new ExamStore();try{const first=store.begin(blueprint);add(store,first,original);const second=store.begin({...blueprint,examName:'Renamed same-code fixture'});assert.notEqual(first.draftId,second.draftId);assert.notEqual(first.variationSeed,second.variationSeed);assert.equal(second.freshnessPolicy.previousSets,1);add(store,second,original.slice(0,20));assert.throws(()=>store.append(second.draftId,second.authorToken,original.slice(20,30)),/maximum 20/);assert.equal(store.row(second.draftId,second.authorToken,'author').body.questions.length,20);}finally{store.close();}
});
test('20 overlapping questions plus 30 new questions are accepted',()=>{
 const store=new ExamStore();try{add(store,store.begin(blueprint),original);const second=store.begin(blueprint);const result=add(store,second,[...original.slice(0,20),...fresh.slice(20)]);assert.equal(result.structuredContent.freshness.overlap,20);assert.equal(result.structuredContent.freshness.different,30);assert.equal(store.history(blueprint.examCode).length,2);assert.equal(result.structuredContent.questions.length,50);}finally{store.close();}
});
test('fingerprints detect changes to numbers, punctuation and close wording',()=>{
 assert.ok(signaturesMatch(questionSignature('Allocate 100 blocks to the recovery workload?'),questionSignature('ALLOCATE 900 blocks to the recovery workload!')));
 assert.ok(signaturesMatch(questionSignature('Database optimizer statistics indexes execution plans partition pruning workload joins'),questionSignature('Database optimizer statistics indexes execution plans partition pruning workload joins explain')));
 assert.ok(!signaturesMatch(questionSignature('Recover archived redo logs after media failure'),questionSignature('Which analytic window ranks sales employees')));
});
test('history survives process restarts and attempt expiry, then expires after 90 days',()=>temporaryDb(path=>{
 let now=1;let store=new ExamStore(path,()=>now);add(store,store.begin(blueprint),original);store.close();now+=49*3600000;store=new ExamStore(path,()=>now);try{assert.equal(store.db.prepare('SELECT count(*) AS n FROM attempts').get().n,0);assert.equal(store.history(blueprint.examCode).length,1);const history=store.db.prepare('SELECT signatures FROM exam_history').get().signatures;assert.ok(!history.includes('Original database scenario'));assert.ok(!history.includes('correctAnswers'));now+=91*86400000;store.prune();assert.equal(store.history(blueprint.examCode).length,0);}finally{store.close();}
}));
test('a draft can replace accepted slots when another set completes during generation',()=>{
 const store=new ExamStore();try{const pending=store.begin(blueprint);add(store,pending,original.slice(0,40));add(store,store.begin(blueprint),original);assert.throws(()=>store.append(pending.draftId,pending.authorToken,fresh.slice(40)),/overlap limit/);for(let i=0;i<30;i+=10)store.append(pending.draftId,pending.authorToken,fresh.slice(i,i+10),Array.from({length:10},(_,k)=>i+k+1));const result=store.append(pending.draftId,pending.authorToken,fresh.slice(40));assert.equal(result.structuredContent.freshness.overlap,10);assert.equal(result.structuredContent.freshness.different,40);}finally{store.close();}
});
test('upgrade seeds fingerprint history from retained old exams without changing their answer keys',()=>temporaryDb(path=>{
 let store=new ExamStore(path);const d=store.begin(blueprint);add(store,d,original);const before=store.row(d.draftId,d.authorToken,'author').body;store.db.exec('DELETE FROM exam_history');store.close();store=new ExamStore(path);try{assert.equal(store.history(blueprint.examCode).length,1);assert.deepEqual(store.row(d.draftId,d.authorToken,'author').body,before);}finally{store.close();}
}));
