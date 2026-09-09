import test from 'node:test';
import assert from 'node:assert/strict';
import {normalizedUrl,robotsAllows,extractLinks,sources} from '../lib/collector.ts';
import {planFor,lessons} from '../lib/study-data.ts';
test('URL allowlist rejects untrusted destinations and normalizes trackers',()=>{
assert.equal(normalizedUrl('http://127.0.0.1/','https://ah.huatu.com/'),null);
assert.equal(normalizedUrl('https://ah.huatu.com.evil.test/x','https://ah.huatu.com/'),null);
assert.equal(normalizedUrl('https://ah.huatu.com:8443/x','https://ah.huatu.com/'),null);
assert.equal(normalizedUrl('javascript:alert(1)','https://ah.huatu.com/'),null);
assert.equal(normalizedUrl('/tiku/2025?utm_source=test#q','https://ah.huatu.com/'),'https://ah.huatu.com/tiku/2025');
});
test('robots honors group boundaries, specificity, wildcard and allow overrides',()=>{
assert.equal(robotsAllows('User-agent: *\nDisallow: /','/x'),false);
assert.equal(robotsAllows('User-agent: *\nDisallow: /private\nAllow: /private/public','/private/public/1'),true);
assert.equal(robotsAllows('User-agent: *\nDisallow: /*.pdf$','/a.pdf'),false);
assert.equal(robotsAllows('User-agent: *\nDisallow: /*.pdf$','/a.pdf/info'),true);
assert.equal(robotsAllows('User-agent: *\nDisallow:\nUser-agent: Googlebot\nDisallow: /','/x'),true);
assert.equal(robotsAllows('User-agent: *\nDisallow: /\nUser-agent: RuanRuanStudyBot\nAllow: /','/x'),true);
});
test('collects relevant public titles once and excludes hostile and promotional links',()=>{
const html='<a href="/tiku/a">2025年国考行测试题</a><a href="/tiku/a#q">2025年国考行测试题</a><a href="https://evil.test/a">2026国考申论真题</a><a href="/x">2026国考行测押题课程</a><script><a href="/bad">2026国考行测试题</a></script>';
assert.deepEqual(extractLinks(html,sources[0]),[{title:'2025年国考行测试题',url:'https://ah.huatu.com/tiku/a'}]);
});
test('all 30 days have unique tasks, valid lessons and positive time for every pace',()=>{
const ids=new Set();
for(let d=1;d<=30;d++){for(const h of [2,3,4,6]){const p=planFor(d,h);assert.equal(p.tasks.length,3);for(const t of p.tasks){assert(t.minutes>0);assert(lessons.some(l=>l.id===t.lesson))}if(![16,22,24,26].includes(d))assert.equal(p.tasks.reduce((n,t)=>n+t.minutes,0),h*60)}for(const t of planFor(d).tasks){assert(!ids.has(t.id));ids.add(t.id)}}
assert.equal(ids.size,90);assert.equal(planFor(24).tasks[1].minutes,180);assert.equal(planFor(26).tasks[1].minutes,120);
});

