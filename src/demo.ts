import { emptyState, type Message, type Task } from './domain.js';
import { calendarDate } from './task-calendar.js';

// Public, generated examples only. Never reads or writes an account workspace.
export function demoState(timezone = 'Asia/Colombo', now = new Date()) {
  const today = calendarDate(now.toISOString(), timezone);
  const day = (offset: number) => new Date(Date.parse(`${today}T12:00:00Z`) + offset * 86400000).toISOString().slice(0, 10);
  const dateLabel = (offset: number) => new Intl.DateTimeFormat('en-GB', {day:'numeric', month:'long', timeZone:'UTC'}).format(new Date(`${day(offset)}T12:00:00Z`));
  function at(offset: number, hour: number, minute = 0) {
    const target = Date.parse(`${day(offset)}T${String(hour).padStart(2,'0')}:${String(minute).padStart(2,'0')}:00Z`);
    let guess = target;
    for (let i = 0; i < 3; i++) {
      const fields = Object.fromEntries(new Intl.DateTimeFormat('en-GB', {timeZone:timezone, year:'numeric', month:'2-digit', day:'2-digit', hour:'2-digit', minute:'2-digit', second:'2-digit', hourCycle:'h23'}).formatToParts(new Date(guess)).map(p => [p.type,p.value]));
      guess += target - Date.UTC(+fields.year,+fields.month-1,+fields.day,+fields.hour,+fields.minute,+fields.second);
    }
    return new Date(guess).toISOString();
  }
  const s = emptyState([
    {id:'demo-alex', name:'Alex Morgan', channel:'whatsapp', chatId:'12025550101@c.us', phone:'+12025550101'},
    {id:'demo-sam', name:'Sam Rivera', channel:'telegram', chatId:'demo-telegram-sam'},
    {id:'demo-maya', name:'Maya Chen', channel:'whatsapp', chatId:'12025550102@c.us', phone:'+12025550102'},
    {id:'demo-jordan', name:'Jordan Ellis', channel:'telegram', chatId:'demo-telegram-jordan'},
    {id:'demo-priya', name:'Priya Shah', channel:'whatsapp', chatId:'12025550103@c.us', phone:'+12025550103'},
    {id:'demo-leo', name:'Leo Martin', channel:'telegram', chatId:'demo-telegram-leo'},
  ]);
  function message(client: string, speaker: Message['speaker'], text: string, offset: number, hour: number, minute = 0) {
    const clientId = `demo-${client}`, id = `demo-message-${s.messages.length+1}`;
    s.messages.push({id, clientId, channel:s.clients.find(c=>c.id===clientId)!.channel, speaker, text, sentAt:at(offset,hour,minute), origin:'mock', ...(speaker==='owner'?{status:'sent'}:{})});
    return id;
  }
  function task(id: string, client: string, title: string, status: Task['status'], due: string|null, evidence: string[], responsible: Task['responsible'] = 'owner', revision = 1) {
    const clientId = `demo-${client}`;
    const value:Task = {id, clientId, channel:s.clients.find(c=>c.id===clientId)!.channel, title, status, due, evidence, responsible, revision, manual:false, updatedAt:s.messages.find(m=>m.id===evidence.at(-1))!.sentAt};
    s.tasks.push(value); return value;
  }

  const menuRequest = message('alex','client','Could you send the updated café menu PDF today by 4 PM? We need it for tomorrow’s print run.',0,8,15);
  const menuAccept = message('alex','owner','Yes, I’ll send the print-ready menu PDF today by 4 PM.',0,8,18);
  task('demo-menu','alex','Send print-ready café menu','open',at(0,16),[menuRequest,menuAccept]);

  const logoRequest = message('sam','client','Can you send the revised logo concepts tomorrow by 11 AM?',0,8,30);
  message('sam','owner','Could I send them a day later? I need time to refine the second direction.',0,8,34);
  const logoAgree = message('sam','client',`Yes, ${dateLabel(2)} at 11 AM works for me.`,0,8,37);
  const logoConfirm = message('sam','owner',`Confirmed. I’ll send both revised logo concepts on ${dateLabel(2)} by 11 AM.`,0,8,39);
  task('demo-logo','sam','Send revised logo concepts','open',at(2,11),[logoRequest,logoAgree,logoConfirm],'owner',2);

  message('maya','owner','The product page layout is ready. Could you send the final product photos?',0,8,5);
  const photosPromise = message('maya','client','I’ll send the five product photos tomorrow by 9 AM.',0,8,12);
  task('demo-photos','maya','Receive five product photos','waiting',at(1,9),[photosPromise],'client');
  const pagePromise = message('maya','owner',`Thanks. I’ll send the updated product page copy on ${dateLabel(3)} by 2 PM.`,0,8,14);
  task('demo-product-copy','maya','Send updated product page copy','open',at(3,14),[pagePromise]);

  const weekendRequest = message('jordan','client','Could you also cover our weekend event? Please send a quote tomorrow by 3 PM.',0,9);
  message('jordan','owner','Let me check my availability before I confirm the extra event.',0,9,4);
  s.proposals.push({id:'demo-review-event', clientId:'demo-jordan', createdAt:at(0,9,4), reason:'Client requested a quote; the owner has not committed to the extra event.', change:{action:'create', taskId:null, title:'Quote weekend event coverage', responsible:'owner', status:'review', due:at(1,15), evidence:[weekendRequest], explicit:false, reason:'Availability has not been confirmed.'}});

  const invoicePromise = message('priya','owner','I’ll send the final invoice today by 5 PM.',-1,10);
  const invoiceDone = message('priya','owner','I’ve sent the final invoice to your email.',-1,16,20);
  message('priya','client','Received, thank you! The payment details are clear.',-1,16,25);
  task('demo-invoice','priya','Send final invoice','completed',at(-1,17),[invoicePromise,invoiceDone],'owner',2);
  const videoRequest = message('priya','client','For the next project, could you send a short launch video preview tomorrow by 6 PM?',0,9,10);
  const videoAccept = message('priya','owner','Yes, I’ll send the launch video preview tomorrow by 6 PM.',0,9,13);
  task('demo-video','priya','Send launch video preview','open',at(1,18),[videoRequest,videoAccept]);

  const leafletPromise = message('leo','owner','I’ll prepare a print leaflet for the launch.',-1,11);
  const leafletCancel = message('leo','client','Please cancel the print leaflet. We’re doing a digital launch instead.',-1,11,30);
  message('leo','owner','Understood, I’ve cancelled the print leaflet.',-1,11,32);
  task('demo-leaflet','leo','Prepare print leaflet','cancelled',null,[leafletPromise,leafletCancel],'owner',2);
  const handover = message('leo','owner','I’ll prepare a short website handover checklist for you. We haven’t agreed a date yet.',0,8,40);
  const handoverTask = task('demo-handover','leo','Prepare website handover checklist','open',null,[handover]);
  message('leo','client','Before you prepare the handover checklist, please wait. I’m changing the hosting account and will confirm the details.',0,9,20);
  message('leo','owner','Okay, I’ll wait for the account details before continuing.',0,9,22);
  handoverTask.status='waiting'; handoverTask.responsible='client'; handoverTask.title='Receive hosting account details'; handoverTask.evidence=s.messages.filter(m=>m.clientId==='demo-leo').slice(-2).map(m=>m.id); handoverTask.revision=2; handoverTask.updatedAt=at(0,9,22);

  for (const c of s.clients) {
    const messages = s.messages.filter(m=>m.clientId===c.id);
    s.sequence[c.id]=messages.length;
    s.analysis[c.id]={status:'ready', at:messages.at(-1)!.sentAt};
  }
  s.analyzed=s.messages.map(m=>m.id);
  s.schedules=[
    {id:'demo-schedule-photos', clientId:'demo-maya', taskId:'demo-photos', taskRevision:1, text:'Hi Maya, just checking on the five product photos for the product page. Please let me know if you need more time.', at:at(1,9,30), approvedSeq:s.sequence['demo-maya'], status:'approved'},
    {id:'demo-schedule-handover', clientId:'demo-leo', taskId:'demo-handover', taskRevision:1, text:'Hi Leo, checking whether you have any questions about the website handover checklist.', at:at(1,10), approvedSeq:4, status:'paused', error:'New client activity changed the task. Review the latest hosting-account request before approving another follow-up.'},
    {id:'demo-schedule-invoice', clientId:'demo-priya', taskId:'demo-invoice', taskRevision:1, text:'Hi Priya, I’ve sent the final invoice. Please let me know if any details need changing.', at:at(-1,16,20), approvedSeq:1, status:'sent', providerId:'demo-only-delivery'},
  ];
  s.notifications=[
    {id:'demo-reminder-menu', taskId:'demo-menu', text:'Café menu PDF is due today at 4 PM.', at:at(0,9,15), read:false},
    {id:'demo-reminder-photos', taskId:'demo-photos', text:'Maya’s product photos are due tomorrow at 9 AM.', at:at(0,9,16), read:false},
  ];
  s.templates=[
    {id:'demo-reply-update', category:'replies', title:'Progress update', text:'Hi {{name}}, a quick update: I’m working on the next agreed deliverable. I’ll share the details here when it’s ready.'},
    {id:'demo-reply-input', category:'replies', title:'Request missing files', text:'Hi {{name}}, could you send the remaining files when you have a moment? Please let me know if the timeline has changed.'},
    {id:'demo-reply-received', category:'replies', title:'Confirm receipt', text:'Thanks {{name}}, I’ve received the files. I’ll review them and get back to you.'},
    {id:'demo-card', category:'business-card', title:'Studio North — business card', text:'Studio North · Independent creative studio\nBrand identity, websites and launch content\nhello@studionorth.example\nhttps://studionorth.example'},
    {id:'demo-services', category:'services', title:'Creative services', text:'• Brand identity and logo design\n• Small-business websites\n• Product photography editing\n• Launch videos and social content\nScope and pricing confirmed per project.'},
    {id:'demo-hours', category:'opening-hours', title:'Studio opening hours', text:'Monday–Friday: 9 AM–6 PM\nSaturday: by appointment\nSunday: closed\nTimezone: Asia/Colombo'},
    {id:'demo-contact', category:'contact-details', title:'Studio contact details', text:'Studio North\nEmail: hello@studionorth.example\nWebsite: https://studionorth.example\nMessages are answered during studio opening hours.'},
  ];
  return {...s, config:{provider:'simulated', model:'Read-only examples', whatsapp:'mock', telegram:true, durability:'simulated', timezone, localOnly:true}};
}
