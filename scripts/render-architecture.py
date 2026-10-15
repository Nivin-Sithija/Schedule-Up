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
# App boundary (target deployment, not current runtime grouping)
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
card(1748,608,410,239,'Gemma inference','G','#287f84',['Ollama · working locally','OpenRouter · Google BYOK','Commitments + reply drafts'],tag='Hosted extraction + draft checks passed')
card(1748,941,410,210,'Live deployment','R','#8467a4',['scheduleup.tech · HTTPS','Three Starter services'],tag='$21.50/month base + usage extras')
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
text(352,1058,'Development: API + Ollama on host; Docker Compose runs WAHA + Temporal.',20,'#52667d')
text(352,1092,'Hosted: app / embedded worker + private WAHA + private Temporal; Tiger stays external.',20,'#52667d')
text(49,1191,'Incoming batches reach inference directly; Tiger persistence runs alongside analysis. Validated results update the shared calendar.',20,'#647286')
text(49,1220,'AI never sends on its own. Replies are owner-reviewed; scheduled sends require an unchanged task, conversation and approval.',19,'#647286')
svg.append('</svg>')
root=Path(__file__).resolve().parents[1]/'docs'/'architecture';root.mkdir(parents=True,exist_ok=True)
(root/'scheduleup-architecture.svg').write_text('\n'.join(svg))
im.save(root/'scheduleup-architecture.png')
print('Created docs/architecture/scheduleup-architecture.svg and .png')
