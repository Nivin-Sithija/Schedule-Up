"""Render matching editable SVG and PNG architecture artifacts; requires Pillow."""
from pathlib import Path
from html import escape
from math import hypot
from PIL import Image, ImageDraw, ImageFont
W,H=2200,1250
im=Image.new('RGB',(W,H),'#ffffff');d=ImageDraw.Draw(im)
svg=[f'<svg xmlns="http://www.w3.org/2000/svg" width="{W}" height="{H}" viewBox="0 0 {W} {H}">','<rect width="100%" height="100%" fill="white"/>']
fonts={}
def font(n,bold=False):
 key=(n,bold)
 if key not in fonts: fonts[key]=ImageFont.truetype('/System/Library/Fonts/Supplemental/Arial Bold.ttf' if bold else '/System/Library/Fonts/Supplemental/Arial.ttf',n)
 return fonts[key]
def text(x,y,s,n=21,c='#4b596b',bold=False):
 d.text((x,y),s,font=font(n,bold),fill=c,anchor='lt')
 svg.append(f'<text x="{x}" y="{y+n*.85}" font-family="Arial,Helvetica,sans-serif" font-size="{n}" fill="{c}" font-weight="{700 if bold else 400}">{escape(s)}</text>')
def box(x,y,w,h,fill='#fff',stroke='#dfe5ed',r=18,width=2,dashed=False):
 if dashed:
  d.rounded_rectangle((x,y,x+w,y+h),radius=r,fill=fill)
  line([(x+r,y),(x+w-r,y)],stroke,width,True);line([(x+r,y+h),(x+w-r,y+h)],stroke,width,True);line([(x,y+r),(x,y+h-r)],stroke,width,True);line([(x+w,y+r),(x+w,y+h-r)],stroke,width,True)
 else:d.rounded_rectangle((x,y,x+w,y+h),radius=r,fill=fill,outline=stroke,width=width)
 svg.append(f'<rect x="{x}" y="{y}" width="{w}" height="{h}" rx="{r}" fill="{fill}" stroke="{stroke}" stroke-width="{width}"'+(' stroke-dasharray="9 8"' if dashed else '')+'/>')
def line(points,c='#58728e',width=3,dashed=False):
 for a,b in zip(points,points[1:]):
  if dashed:
   length=hypot(b[0]-a[0],b[1]-a[1]);vx=(b[0]-a[0])/max(length,1);vy=(b[1]-a[1])/max(length,1)
   for k in range(0,int(length),17):d.line((a[0]+vx*k,a[1]+vy*k,a[0]+vx*min(k+9,length),a[1]+vy*min(k+9,length)),fill=c,width=width)
  else:d.line((a,b),fill=c,width=width)
 svg.append('<polyline points="'+' '.join(f'{x},{y}' for x,y in points)+f'" fill="none" stroke="{c}" stroke-width="{width}" stroke-linejoin="round"'+(' stroke-dasharray="9 8"' if dashed else '')+'/>')
def arrow(points,c='#58728e',dashed=False,both=False):
 line(points,c,3,dashed)
 for a,b in [(points[-2],points[-1])]+([(points[1],points[0])] if both else []):
  length=hypot(b[0]-a[0],b[1]-a[1]);vx=(b[0]-a[0])/length;vy=(b[1]-a[1])/length
  pts=[b,(b[0]-vx*12-vy*6,b[1]-vy*12+vx*6),(b[0]-vx*12+vy*6,b[1]-vy*12-vx*6)]
  d.polygon(pts,fill=c);svg.append('<polygon points="'+' '.join(f'{x},{y}'for x,y in pts)+f'" fill="{c}"/>')
def label(x,y,s):
 length=d.textlength(s,font=font(18));box(x-7,y-4,length+14,28,fill='#ffffff',stroke='#ffffff',r=5,width=0);text(x,y,s,18,'#5b718c')
def card(x,y,w,h,title,badge,accent,rows,tag=None):
 box(x,y,w,h)
 box(x+1,y+1,w-2,65,fill=accent,stroke=accent,r=16,width=0)
 box(x+17,y+15,36,36,fill='#ffffff',stroke='#ffffff',r=10,width=0)
 text(x+25,y+23,badge,19,accent,True);text(x+66,y+22,title,24,'#ffffff',True)
 for i,row in enumerate(rows):
  yy=y+89+i*42
  d.ellipse((x+21,yy+6,x+27,yy+12),fill=accent);svg.append(f'<circle cx="{x+24}" cy="{yy+9}" r="3" fill="{accent}"/>');text(x+40,yy,row,20)
 if tag:text(x+21,y+h-34,tag,17,'#8490a1')
# Title and legend
box(48,37,51,51,fill='#14171e',stroke='#14171e',r=16,width=0);line([(61,64),(70,73),(87,53)],'#ffffff',4)
text(117,37,'ScheduleUp',36,'#14171e',True);text(117,82,'High-level system architecture',22,'#748195')
text(1360,48,'Solid paths: implemented components',19);line([(1320,58),(1348,58)],'#58728e',3)
text(1360,82,'Boundary: hosted application and connectors',19);line([(1320,92),(1348,92)],'#7696bc',3,True)
# Hosted service boundary; cards represent logical components
box(294,165,1375,995,fill='#fcfdff',stroke='#8aa7ca',r=22,width=2,dashed=True)
box(319,146,1090,38,fill='#ffffff',stroke='#ffffff',r=4,width=0)
text(332,151,'APPLICATION + CONNECTORS  /  Render · three Starter services',22,'#426d9d',True)
# Cards
card(42,235,215,215,'Owner','U','#182c49',['Browser access','Own account','Review / approve'])
card(42,638,215,255,'Messaging','C','#182c49',['Owner + clients','WhatsApp','Telegram'],tag='Allowed clients only')
card(334,223,300,239,'React dashboard','UI','#326ba1',['Inbox + templates','Tasks + calendar','Scheduled follow-ups','Connection settings'])
card(748,223,370,281,'Fastify API','API','#287f84',['Accounts + secure sessions','Workspace / client isolation','Message ingestion + allowlists','Drafts + send approvals','Task queries + updates'])
card(334,608,300,281,'Channel adapters','CH','#287f84',['WhatsApp → WAHA','Telegram → GramJS','Owner + client text','Replies + delivery echoes'],tag='GramJS runs inside the API')
card(748,608,370,281,'Temporal','T','#c08537',['Durable conversation signals','Per-client ordered batches','Activity retries + reminders','Persistent follow-up timers'],tag='Pilot: SQLite server + persistent disk')
card(1250,608,378,323,'Activity worker + Mastra','AI','#326ba1',['Bounded two-sided context','Hybrid agreement retrieval','Gemma extraction / repair','Schema + evidence checks','Calendar + revision rules'],tag='Embedded worker in API process')
card(1748,223,410,281,'Tiger Data · PostgreSQL','DB','#326ba1',['Accounts + sessions','Messages, tasks + schedules','Encrypted Telegram sessions','pgvector + keyword search','Account / client-scoped data'])
card(1748,608,410,239,'Gemma inference','G','#287f84',['OpenRouter · hosted Gemma','Primary 26B / fallback 31B','Commitments + reply drafts'],tag='Primary passes; fallback degraded at audit')
card(1748,941,410,210,'Live deployment','R','#8467a4',['scheduleup.tech · HTTPS','Three Starter services'],tag='One instance per Render service')
# Connections and readable labels
arrow([(257,324),(334,324)],both=True);label(263,292,'Web')
arrow([(634,324),(748,324)],both=True);label(652,292,'REST')
arrow([(1118,324),(1748,324)],both=True);label(1248,292,'Account state + task queries')
arrow([(257,746),(334,746)],both=True)
arrow([(634,746),(683,746),(683,435),(748,435)],both=True);label(639,530,'Events / replies')
arrow([(932,504),(932,608)]);label(951,546,'Durable signal')
arrow([(1118,749),(1250,749)]);label(1136,715,'Activities')
arrow([(1628,714),(1748,714)],both=True);label(1639,678,'Inference')
arrow([(1440,608),(1440,553),(1953,553),(1953,504)],both=True);label(1477,519,'Context + validated task writes')
arrow([(1440,931),(1440,990),(484,990),(484,889)],c='#698a7a');label(668,958,'Approved follow-ups → send eligibility check → channel')
# Operational notes inside target boundary
box(332,1041,1298,88,fill='#f2f5f9',stroke='#e4eaf1',r=12,width=1)
text(352,1058,'App service embeds the activity worker, Mastra agents and GramJS adapter.',20,'#52667d')
text(352,1092,'Hosted: app / embedded worker + private WAHA + private Temporal; Tiger stays external.',20,'#52667d')
text(49,1191,'Incoming batches reach inference directly; Tiger persistence runs alongside analysis. Validated results update the shared calendar.',20,'#647286')
text(49,1220,'AI never sends on its own. Replies are owner-reviewed; scheduled sends require an unchanged task, conversation and approval.',19,'#647286')
svg.append('</svg>')
root=Path(__file__).resolve().parents[1]/'docs'/'architecture';root.mkdir(parents=True,exist_ok=True)
(root/'scheduleup-architecture.svg').write_text('\n'.join(svg))
im.save(root/'scheduleup-architecture.png')
print('Created docs/architecture/scheduleup-architecture.svg and .png')

# Use-case diagram: actor associations are deliberately undirected.
W,H=2200,1450
im=Image.new('RGB',(W,H),'#ffffff');d=ImageDraw.Draw(im)
svg=[f'<svg xmlns="http://www.w3.org/2000/svg" width="{W}" height="{H}" viewBox="0 0 {W} {H}">','<rect width="100%" height="100%" fill="white"/>']
text(65,40,'ScheduleUp',36,'#14171e',True)
text(65,92,'Use-case diagram · implemented product behavior',24,'#647286')
box(410,170,1320,1130,fill='#fcfdff',stroke='#8aa7ca',r=22,width=2)
text(445,192,'SCHEDULEUP',22,'#426d9d',True)
def actor(x,y,title,subtitle):
 d.ellipse((x-19,y,x+19,y+38),outline='#182c49',width=3)
 svg.append(f'<circle cx="{x}" cy="{y+19}" r="19" fill="white" stroke="#182c49" stroke-width="3"/>')
 line([(x,y+38),(x,y+95)],'#182c49',3)
 line([(x-35,y+59),(x+35,y+59)],'#182c49',3)
 line([(x-30,y+130),(x,y+95),(x+30,y+130)],'#182c49',3)
 text(x-95,y+145,title,24,'#182c49',True)
 text(x-95,y+181,subtitle,18)
def usecase(x,y,title,subtitle):
 box(x,y,490,104,fill='#eef4fa',stroke='#b9cee2',r=46)
 text(x+28,y+23,title,23,'#234d72',True)
 text(x+28,y+60,subtitle,18,'#52667d')
actor(170,450,'Business owner','Uses the dashboard')
actor(1960,240,'Client','Existing messaging app')
box(1815,630,330,112,fill='#edf5f3',stroke='#b8d5cc')
text(1840,654,'Channel services',24,'#287f84',True);text(1840,697,'WhatsApp and Telegram',18)
box(1815,865,330,112,fill='#edf5f3',stroke='#b8d5cc')
text(1840,889,'Hosted Gemma',24,'#287f84',True);text(1840,932,'Analysis and draft support',18)
box(1815,1100,330,112,fill='#faf2e7',stroke='#e3ccb0')
text(1840,1124,'Temporal',24,'#98621f',True);text(1840,1167,'Batches, retries and timers',18)
left=[('Register and sign in','Isolated account workspace'),('Connect and allow clients','QR linking and owner verification'),('View conversations / evidence','Allowed chats and source messages'),('Manage tasks and calendar','Dates, responsibility and history'),('Review proposed changes','Approve or reject uncertain updates'),('Edit drafts and templates','Review the exact reply text'),('Approve / cancel follow-ups','Exact text, recipient and future time'),('Read internal reminders','Dashboard notifications')]
# Associations are routed outside the use-case column.
for i,(title,sub) in enumerate(left):
 y=265+i*123
 line([(275,540),(365,540),(365,y+52),(460,y+52)],'#a1adbb',2)
 usecase(460,y,title,sub)
right=[(305,'Exchange private text','Owner and client use their channels'),(590,'Ingest allowed messages','Verify identity; pause old follow-ups'),(790,'Extract / validate commitments','Evidence, dates and revisions'),(990,'Send owner-approved text','Check approval and current eligibility')]
for y,title,sub in right:usecase(1150,y,title,sub)
line([(1960,430),(1960,470),(1670,470),(1670,357),(1640,357)],'#a1adbb',2)
line([(1815,686),(1765,686),(1765,642),(1640,642)],'#a1adbb',2)
line([(1815,710),(1765,710),(1765,1042),(1640,1042)],'#a1adbb',2)
line([(1815,921),(1710,921),(1710,842),(1640,842)],'#a1adbb',2)
line([(1815,1156),(1745,1156),(1745,870),(1640,870)],'#a1adbb',2)
arrow([(1395,694),(1395,790)])
label(1415,733,'Analyze')
arrow([(950,932),(1005,932),(1005,1015),(1150,1015)])
label(1000,908,'Reviewed reply')
arrow([(950,1055),(1040,1055),(1040,1042),(1150,1042)])
label(990,1010,'Approval')
text(65,1350,'Actors associate with supported use cases; arrows indicate selected internal dependencies.',21,'#647286')
text(65,1390,'AI assists extraction and drafting. Sending always requires owner-reviewed text and deterministic eligibility checks.',21,'#647286')
svg.append('</svg>')
(root/'scheduleup-use-cases.svg').write_text('\n'.join(svg))
im.save(root/'scheduleup-use-cases.png')
print('Created docs/architecture/scheduleup-use-cases.svg and .png')
