import { randomBytes, createHash, timingSafeEqual } from 'node:crypto';
import { DatabaseSync } from 'node:sqlite';
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
function ensure(ok,message){if(!ok)throw new Error(message);}
function text(value,max=3000,min=1){ensure(typeof value==='string'&&value.trim().length>=min&&value.length<=max,'Invalid or missing text.');return value.trim();}
function object(value,keys){ensure(value&&typeof value==='object'&&!Array.isArray(value),'Expected an object.');ensure(Object.keys(value).length===keys.length&&keys.every(k=>Object.hasOwn(value,k)),'Missing or unexpected fields.');}
function array(value,min,max){ensure(Array.isArray(value)&&value.length>=min&&value.length<=max,'Invalid array length.');}
export function validateOracleUrl(value){
 text(value,1500);const u=new URL(value);
 ensure(u.protocol==='https:'&&!u.username&&!u.password&&!u.port&&['www.oracle.com','oracle.com','docs.oracle.com','education.oracle.com','mylearn.oracle.com'].includes(u.hostname),'Use an HTTPS official Oracle documentation or exam page.');return value;
}
export function validateBlueprint(value){
 object(value,['examName','examCode','officialExamUrl','objectives','researchSummary']);
 const examName=text(value.examName,200,3),examCode=text(value.examCode,20).toUpperCase();
 ensure(/^1Z0-\d{3,5}(?:-\d{2})?$/.test(examCode),'Invalid Oracle exam code.');
 const officialExamUrl=validateOracleUrl(value.officialExamUrl);array(value.objectives,1,30);
 const objectives=value.objectives.map(t=>text(t,300,2));ensure(new Set(objectives).size===objectives.length,'Duplicate objectives.');
 return{examName,examCode,officialExamUrl,objectives,researchSummary:text(value.researchSummary)};
}
export function validateQuestion(value){
 object(value,['prompt','topic','options','correctAnswers','explanation','optionExplanations','references']);
 const q=structuredClone(value);q.prompt=text(q.prompt);q.topic=text(q.topic,300,2);q.explanation=text(q.explanation);
 array(q.options,4,6);array(q.correctAnswers,1,5);array(q.references,1,4);
 const allowed=['A','B','C','D','E','F'];
 for(const o of q.options){object(o,['id','text']);ensure(allowed.includes(o.id),'Invalid option ID.');o.text=text(o.text);}
 const ids=q.options.map(o=>o.id);
 ensure(new Set(ids).size===ids.length,'Option IDs must be unique.');
 ensure(new Set(q.options.map(o=>o.text.toLowerCase())).size===ids.length,'Options must be distinct.');
 ensure(new Set(q.correctAnswers).size===q.correctAnswers.length&&q.correctAnswers.every(id=>ids.includes(id)),'Invalid answer key.');
 ensure(q.correctAnswers.length<ids.length,'Include an incorrect option.');
 object(q.optionExplanations,ids);for(const id of ids)q.optionExplanations[id]=text(q.optionExplanations[id]);
 for(const r of q.references){object(r,['title','url','relevance']);r.title=text(r.title);r.url=validateOracleUrl(r.url);r.relevance=text(r.relevance);}
 return q;
}

const token = () => randomBytes(32).toString('base64url');
const digest = value => createHash('sha256').update(value).digest('hex');
function authorized(value, expected) {
  return typeof value === 'string' && timingSafeEqual(Buffer.from(digest(value)), Buffer.from(expected));
}
const canonical = answers => [...answers].sort().join(',');
const HISTORY_DAYS = 90;
const HISTORY_SETS = 5;
const MAX_OVERLAP = 20;
const stopWords = new Set('a an the what which is are in of to and or for with when how does can should would could that this on'.split(' '));
export function questionSignature(prompt) {
  // Keep no historical question text or answer keys. Ignore superficial edits to values.
  const normalized = prompt.normalize('NFKC').toLowerCase().replace(/(['"])[^'"\n]*\1/g,' literal ')
    .replace(/\b\d+(?:\.\d+)?\b/g,' number ').replace(/[^\p{L}\p{N}]+/gu,' ').trim();
  return { exact: digest(normalized), words: [...new Set(normalized.split(' ').filter(w => w && !stopWords.has(w)))].map(digest) };
}
export function signaturesMatch(a,b) {
  if (a.exact === b.exact) return true;
  if (a.words.length < 6 || b.words.length < 6) return false;
  const other = new Set(b.words), shared = a.words.filter(w => other.has(w)).length;
  return shared / (a.words.length + b.words.length - shared) >= 0.8;
}

export function grade(questions, answers) {
  if (!Array.isArray(answers) || answers.length !== questions.length) throw new Error('Provide one answer entry for every question.');
  const mapped = new Map();
  for (const entry of answers) {
    if (!entry || !Number.isInteger(entry.questionId) || !Array.isArray(entry.selected) || mapped.has(entry.questionId)) throw new Error('Invalid or duplicate question IDs.');
    mapped.set(entry.questionId, entry.selected);
  }
  let correct = 0;
  const missed = [];
  const topics = Object.create(null);
  questions.forEach((q, index) => {
    const selected = mapped.get(index + 1);
    if (!selected || new Set(selected).size !== selected.length || selected.some(id => !q.options.some(o => o.id === id))) throw new Error('Invalid answer selection.');
    const ok = canonical(selected) === canonical(q.correctAnswers);
    topics[q.topic] ??= { correct: 0, total: 0 };
    topics[q.topic].total++;
    if (ok) { correct++; topics[q.topic].correct++; }
    else missed.push({ questionId: index + 1, ...q, selected });
  });
  return { correct, total: questions.length, scorePercent: correct / questions.length * 100, missed, topics: { ...topics } };
}

export class ExamStore {
  constructor(path = ':memory:', now = () => Date.now()) {
    if (path !== ':memory:') mkdirSync(dirname(path), { recursive: true });
    this.db = new DatabaseSync(path);
    this.now = now;
    this.db.exec('PRAGMA journal_mode=WAL; CREATE TABLE IF NOT EXISTS attempts (id TEXT PRIMARY KEY, author_hash TEXT NOT NULL, user_hash TEXT NOT NULL, expires INTEGER NOT NULL, body TEXT NOT NULL)');
    this.db.exec('CREATE TABLE IF NOT EXISTS exam_history (id TEXT PRIMARY KEY, exam_code TEXT NOT NULL, created INTEGER NOT NULL, signatures TEXT NOT NULL); CREATE INDEX IF NOT EXISTS history_exam_created ON exam_history(exam_code,created)');
    this.db.exec('PRAGMA busy_timeout=5000');
    this.prune();
    // Seed history from still-retained exams created by earlier plug-in versions.
    const insertHistory=this.db.prepare('INSERT OR IGNORE INTO exam_history VALUES (?, ?, ?, ?)');
    for(const row of this.db.prepare('SELECT id,expires,body FROM attempts').all()) {
      const body=JSON.parse(row.body);
      if(body.status!=='draft' && body.questions?.length===50) insertHistory.run(row.id,body.blueprint.examCode,row.expires-48*3600000,JSON.stringify(body.questions.map(q=>questionSignature(q.prompt))));
    }
    this.db.exec('DELETE FROM exam_history WHERE id IN (SELECT id FROM (SELECT id, ROW_NUMBER() OVER (PARTITION BY exam_code ORDER BY created DESC,rowid DESC) AS position FROM exam_history) WHERE position > 5)');
  }
  prune() {
    this.db.prepare('DELETE FROM attempts WHERE expires <= ?').run(this.now());
    this.db.prepare('DELETE FROM exam_history WHERE created <= ?').run(this.now() - HISTORY_DAYS*86400000);
  }
  history(examCode) {
    return this.db.prepare('SELECT signatures FROM exam_history WHERE exam_code = ? AND created > ? ORDER BY created DESC, rowid DESC LIMIT ?')
      .all(examCode,this.now()-HISTORY_DAYS*86400000,HISTORY_SETS).map(row=>JSON.parse(row.signatures));
  }
  begin(input) {
    const blueprint = validateBlueprint(input);
    this.prune();
    if (this.db.prepare('SELECT count(*) AS n FROM attempts').get().n >= 1000) throw new Error('Practice service is full. Please try later.');
    const id = token(), authorToken = token(), userToken = token();
    const body = { blueprint, questions: [], userToken, status: 'draft' };
    this.db.prepare('INSERT INTO attempts VALUES (?, ?, ?, ?, ?)').run(id, digest(authorToken), digest(userToken), this.now() + 48*60*60*1000, JSON.stringify(body));
    return { draftId: id, authorToken, added: 0, required: 50, variationSeed: token(),
      freshnessPolicy: { previousSets: this.history(blueprint.examCode).length, maxOverlap:MAX_OVERLAP, minimumDifferent:30,
        retainedSets:HISTORY_SETS, retentionDays:HISTORY_DAYS, comparison:'exact or closely similar wording; also vary scenarios and reasoning',
        instruction:'Research current official sources again. Create a fresh set; never reuse an earlier draft or report for a repeat exam request.' } };
  }
  row(id, secret, kind) {
    this.prune();
    const row = this.db.prepare('SELECT * FROM attempts WHERE id = ?').get(id);
    if (!row || !authorized(secret, row[kind + '_hash'])) throw new Error('Attempt unavailable, expired, or access denied.');
    return { row, body: JSON.parse(row.body) };
  }
  save(id, body) { this.db.prepare('UPDATE attempts SET body = ? WHERE id = ?').run(JSON.stringify(body), id); }
  append(id, secret, batch, replaceQuestionIds) {
    // Serialize completion across multiple local chat processes sharing the database.
    this.db.exec('BEGIN IMMEDIATE');
    try {
      const result = this.appendLocked(id,secret,batch,replaceQuestionIds);
      this.db.exec('COMMIT');
      return result;
    } catch(error) { this.db.exec('ROLLBACK'); throw error; }
  }
  appendLocked(id, secret, batch, replaceQuestionIds) {
    const { body } = this.row(id, secret, 'author');
    if (body.status !== 'draft') throw new Error('Question set is already locked.');
    array(batch,1,10);
    const parsed = batch.map(validateQuestion);
    const questions = [...body.questions];
    if (replaceQuestionIds !== undefined) {
      array(replaceQuestionIds,parsed.length,parsed.length);
      ensure(new Set(replaceQuestionIds).size === replaceQuestionIds.length && replaceQuestionIds.every(n=>Number.isInteger(n)&&n>=1&&n<=questions.length),'Replacement IDs must uniquely identify accepted draft questions.');
      replaceQuestionIds.forEach((n,i)=>questions[n-1]=parsed[i]);
    } else questions.push(...parsed);
    if (questions.length > 50) throw new Error('Exactly 50 questions are required.');
    if (new Set(questions.map(q => q.prompt.toLowerCase().replace(/\s+/g,' '))).size !== questions.length) throw new Error('Duplicate question.');
    if (parsed.some(q => !body.blueprint.objectives.includes(q.topic))) throw new Error('Question topic must match a researched objective.');
    if (questions.length === 50 && body.blueprint.objectives.some(topic => !questions.some(q => q.topic === topic))) throw new Error('Every exam objective needs at least one question.');
    const previous = this.history(body.blueprint.examCode), known = previous.flat();
    const signatures = questions.map(q=>questionSignature(q.prompt));
    const repeated = signatures.flatMap((s,i)=>known.some(old=>signaturesMatch(s,old))?[i+1]:[]);
    const previousOverlap=replaceQuestionIds===undefined?0:body.questions.filter(q=>known.some(old=>signaturesMatch(questionSignature(q.prompt),old))).length;
    const reducingOverlap=replaceQuestionIds!==undefined && questions.length<50 && repeated.length<previousOverlap;
    if (repeated.length > MAX_OVERLAP && !reducingOverlap) throw new Error(`Fresh-set overlap limit exceeded: ${repeated.length} questions match recent sets; maximum ${MAX_OVERLAP}. Replace these question slots with substantively different scenarios: ${repeated.join(', ')}. Rejected batch was not saved. Use replaceQuestionIds for already accepted draft slots, then retry rejected new questions.`);
    body.questions = questions;
    if (questions.length === 50) {
      body.status = 'ready';
      body.freshness = { comparedSets:previous.length, overlap:repeated.length, different:50-repeated.length, maxOverlap:MAX_OVERLAP, comparison:'wording fingerprints', retentionDays:HISTORY_DAYS };
      this.db.prepare('INSERT INTO exam_history VALUES (?, ?, ?, ?)').run(id,body.blueprint.examCode,this.now(),JSON.stringify(signatures));
      this.db.prepare('DELETE FROM exam_history WHERE exam_code = ? AND id NOT IN (SELECT id FROM exam_history WHERE exam_code = ? ORDER BY created DESC, rowid DESC LIMIT ?)')
        .run(body.blueprint.examCode,body.blueprint.examCode,HISTORY_SETS);
    }
    this.save(id, body);
    return body.status === 'ready' ? this.publicAttempt(id, body) : { structuredContent: { draftId: id, added: questions.length, required: 50, freshnessProgress:{overlap:repeated.length,maxOverlap:MAX_OVERLAP} }, content: [{type:'text', text:`${questions.length}/50 questions stored. ${repeated.length} match recent sets; maximum 20. Continue creating or replacing questions until the complete set satisfies this limit.`}] };
  }
  publicAttempt(id, body) {
    return {
      content: [{ type: 'text', text: 'Your 50-question practice exam is ready. Select answers in the exam panel and submit when ready.' }],
      structuredContent: { status: 'ready', attemptId: id, ...body.blueprint, freshness:body.freshness,
        questions: body.questions.map((q,i) => ({ questionId:i+1, prompt:q.prompt, topic:q.topic, options:q.options, selectionCount:q.correctAnswers.length })) },
      _meta: { attemptToken: body.userToken }
    };
  }
  submit(id, secret, answers) {
    const { body } = this.row(id, secret, 'user');
    if (body.status === 'draft') throw new Error('Questions are still being generated.');
    if (!body.report) {
      body.report = { ...grade(body.questions, answers), examName: body.blueprint.examName, examCode: body.blueprint.examCode, submittedAt: new Date(this.now()).toISOString() };
      body.status = 'submitted';
      this.save(id, body);
    }
    return { content: [{type:'text', text:`Practice score: ${body.report.scorePercent}% (${body.report.correct}/50). Review missed questions in the panel.`}], structuredContent: {status:'submitted', attemptId:id, report:body.report} };
  }
  close() { this.db.close(); }
}
