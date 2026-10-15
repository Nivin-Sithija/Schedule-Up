import test from 'node:test';
import assert from 'node:assert/strict';
import {calendarDate,fourDayCalendar} from '../src/task-calendar.js';
import type {Task} from '../src/domain.js';
const task:Task={id:'a',clientId:'c',title:'Send draft',responsible:'owner',status:'open',due:'2026-10-14',evidence:[],revision:1,manual:false,updatedAt:'2026-10-13T10:00:00Z'};
test('four-day view starts with the workspace-local day and excludes closed tasks',()=>{
 const result=fourDayCalendar([task,{...task,id:'tomorrow',due:'2026-10-15'},{...task,id:'closed',status:'completed'},{...task,id:'undated',due:null}], 'Asia/Colombo',new Date('2026-10-13T20:00:00Z'));
 assert.deepEqual(result.map(d=>d.day),['2026-10-14','2026-10-15','2026-10-16','2026-10-17']);assert.deepEqual(result[0].tasks.map(t=>t.id),['a']);assert.equal(result[1].tasks[0].id,'tomorrow');
});
test('timestamp deadlines use local dates while calendar dates stay unchanged',()=>{
 assert.equal(calendarDate('2026-10-14T20:00:00Z','Asia/Colombo'),'2026-10-15');assert.equal(calendarDate('2026-10-14','America/Los_Angeles'),'2026-10-14');
});

test('month navigator includes adjacent days and leap day in six full weeks',async()=>{
 const {monthCalendar}=await import('../src/task-calendar.js');
 const days=monthCalendar('2028-02');
 assert.equal(days.length,42);
 assert.deepEqual(days[0],{day:'2028-01-30',inMonth:false,label:30});
 assert.deepEqual(days.find(day=>day.day==='2028-02-29'),{day:'2028-02-29',inMonth:true,label:29});
 assert.equal(days[41].day,'2028-03-11');
});
test('navigator jumps across years using workspace-local calendar dates',async()=>{
 const {calendarDayOffset}=await import('../src/task-calendar.js');
 const now=new Date('2026-12-31T20:00:00Z'),timezone='Asia/Colombo';
 const today=calendarDate(now.toISOString(),timezone);
 for(const day of ['2026-12-31','2027-01-01','2027-03-15']) {
  const offset=calendarDayOffset(day,today);
  assert.equal(fourDayCalendar([],timezone,now,offset)[0].day,day);
 }
});
