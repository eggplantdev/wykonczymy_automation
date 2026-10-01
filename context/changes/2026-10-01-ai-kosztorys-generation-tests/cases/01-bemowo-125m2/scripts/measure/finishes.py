# Wall-finish band lengths from drawing 11 (colour plan): each finish is a filled band along the wall.
import re, json, collections, math
import numpy as np, cv2
NAMES={
 '87.057495%, 86.273193%, 88.626099%':'farba Flugger półsatyna (szara)',
 '86.665344%, 70.195007%, 83.135986%':'limewash',
 '75.68512%, 46.273804%, 69.410706%':'limewash + Aqua Ceramic (łazienka)',
 '13.33313%, 20.391846%, 43.136597%':'farba wodoodporna (łazienka)',
 '47.842407%, 56.469727%, 83.920288%':'0-120 farba + naklejka, >120 tapeta Harry (dzieci)',
 '68.626404%, 67.842102%, 45.489502%':'0-120 farba, >120 tapeta Caselio (bawialnia)',
 '43.136597%, 42.744446%, 24.705505%':'0-120 panele tapicerowane, >120 tapeta Caselio',
 '74.508667%, 51.763916%, 35.68573%':'panele akustyczne',
 '45.097351%, 45.097351%, 45.097351%':'płytki Mirage Norr Melk 120x120',
 '30.195618%, 30.195618%, 30.195618%':'0-120 Fossil 5x25, >120 farba wodoodporna',
 '76.861572%, 90.586853%, 67.449951%':'Mirage Elysian Line 120x278',
 '47.842407%, 78.822327%, 27.058411%':'Mirage Elysian 120x120',
 '23.136902%, 40.391541%, 11.764526%':'0-120 Caesar 120x120, >120 Swan 5x25',
 '17.64679%, 30.979919%, 9.01947%':'płytki na wannie Bars Swan (kreskowane)',
}
CM=0.25  # cm per drawing unit (calibrated on drawing 10 labels)
K=200/72
PX_CM=0.25/(0.119955*K)  # rooms2.json polygons are stored in cm
rooms=json.load(open('rooms2.json'))
def topx(x,y): return (x*0.119955*K,(841.675974-y*0.119955)*K)
SIZE=(int(1190.55*K),int(841.89*K))  # (h,w) landscape page
masks={n:cv2.dilate(cv2.fillPoly(np.zeros(SIZE,np.uint8),[(np.array(r['poly'])/PX_CM).astype(np.int32)],1),np.ones((15,15),np.uint8)) for n,r in rooms.items()}
def room_of(pts):
    band=cv2.fillPoly(np.zeros(SIZE,np.uint8),[np.array([topx(*p) for p in pts],np.int32)],1)
    ov={n:int((band&m).sum()) for n,m in masks.items()}
    n=max(ov,key=ov.get)
    return n if ov[n] else 'poza pokojami'
out=collections.defaultdict(lambda: collections.defaultdict(float))
svg=open('svg/p11.svg').read()
for m in re.finditer(r'<path[^>]*fill="rgb\(([^)]*)\)"[^>]*d="([^"]*)"',svg):
    col,d=m.groups()
    if col not in NAMES: continue
    for sub in re.split(r'(?=M)',d):
        nums=[float(x) for x in re.findall(r'-?\d+\.?\d*',sub)]
        pts=list(zip(nums[0::2],nums[1::2]))
        if len(pts)<3: continue
        if min(p[0] for p in pts)>8000: continue  # legend
        A=abs(sum(pts[i][0]*pts[i-1][1]-pts[i-1][0]*pts[i][1] for i in range(len(pts))))/2
        P=sum(math.dist(pts[i],pts[i-1]) for i in range(len(pts)))
        disc=max(P*P/4-4*A,0)
        L=(P/2+math.sqrt(disc))/2  # centreline of a thin band: P=2L+2t, A=L*t
        cx=sum(p[0] for p in pts)/len(pts); cy=sum(p[1] for p in pts)/len(pts)
        out[NAMES[col]][room_of(pts)]+=L*CM/100
res={k:{r:round(v,2) for r,v in rs.items()} for k,rs in out.items()}
for k,rs in res.items(): print(f'{k}: {round(sum(rs.values()),2)} mb  {rs}')
json.dump(res,open('finishes.json','w'),ensure_ascii=False,indent=1)
