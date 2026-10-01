import sys; sys.path.insert(0,'.')
from rasterize import *
from scipy import ndimage as ndi
P=parse('svg/p12.svg')
BLACK='rgb(0%, 0%, 0%)'
img=render(P,lambda p: (p['stroke']==BLACK and p['w']>=7.9) or (p['fill'] or '').startswith('rgb(35.29'))
H,W=img.shape
for p in P:
    if p['stroke']==BLACK and abs(p['w']-6)<1e-3:
        subs,_=subpaths(p['d'],p['M'])
        for sp in subs:
            for (x1,y1),(x2,y2) in zip(sp,sp[1:]):
                if (abs(x1-x2)<1 or abs(y1-y2)<1) and abs(x1-x2)+abs(y1-y2)>10:
                    cv2.line(img,(int(x1),int(y1)),(int(x2),int(y2)),255,2)
CLOSE=[]  # extra closing segments, full-res px
for (a,b) in CLOSE: cv2.line(img,a,b,255,2)
wall=cv2.dilate(img,np.ones((5,5),np.uint8))
PRINTED={'salon':21.2,'łaz. główna':6.74,'kuchnia':8.68,'korytarz':11.93,'bawialnia':24.28,'dzieci':12.11,'druga łaz.':4.11,'sypialnia':13.25,'gabinet':11.16,'drugi korytarz':9.78,'pom. gosp.':2.35}
SEEDS={'salon':(900,450),'łaz. główna':(1440,550),'kuchnia':(800,990),'korytarz':(1440,1030),'bawialnia':(2000,650),'dzieci':(2100,1270),'druga łaz.':(1680,1330),'sypialnia':(740,1430),'gabinet':(740,1850),'drugi korytarz':(1140,1550),'pom. gosp.':(1000,2040)}
lab,n=ndi.label(wall==0)
res={}
for k,(x,y) in SEEDS.items():
    l=lab[y,x]
    reg=ndi.binary_fill_holes(lab==l)
    reg=cv2.dilate(reg.astype(np.uint8),np.ones((5,5),np.uint8))  # undo wall dilation
    res[k]=reg
PX_CM=0.25/(0.119955*200/72)
import json
out={}
for k,reg in res.items():
    a=reg.sum()*PX_CM**2/1e4
    cnts,_=cv2.findContours(reg,cv2.RETR_EXTERNAL,cv2.CHAIN_APPROX_SIMPLE)
    c=max(cnts,key=cv2.contourArea)
    approx=cv2.approxPolyDP(c,3,True)
    per=cv2.arcLength(approx,True)*PX_CM/100
    print(f'{k:15s} printed {PRINTED[k]:6.2f}  measured {a:6.2f}  ratio {a/PRINTED[k]:.3f}  obwód {per:5.2f} m  verts {len(approx)}')
    out[k]=dict(area=a,per=per,printed=PRINTED[k],poly=(approx.reshape(-1,2)*PX_CM).round(1).tolist())
json.dump(out,open('rooms2.json','w'),ensure_ascii=False)
vis=cv2.cvtColor(255-img,cv2.COLOR_GRAY2BGR)
cols=[(255,0,0),(0,160,0),(0,0,255),(200,150,0),(200,0,200),(0,180,180),(120,60,0),(0,90,200),(90,0,160),(160,160,0),(0,120,90)]
for i,(k,reg) in enumerate(res.items()):
    vis[reg>0]=(vis[reg>0]*0.5+np.array(cols[i])*0.5).astype(np.uint8)
cv2.imwrite('pages/rooms2.png',cv2.resize(vis[150:2250,400:2900],(1250,1050)))
