# Geometry of the 02-oliwa raster plan. Pixel coordinates read off 4x gridded zooms of rzut.png.
# Calibration: 670 cm = y107..y637 (530 px); 339 cm = x525..x793 (268 px).
s670 = 530/670; s339 = 268/339
S = (s670+s339)/2          # px per cm
cm = lambda px: px/S
print(f"scale 670: {s670:.4f} px/cm, 339: {s339:.4f} px/cm, diff {abs(s670-s339)/S*100:.2f}%  -> {1/S:.4f} cm/px")
checks = {"401 bedroom (y318..637)":(319,401),"296 bathroom (y77..310)":(233,296),"157 bathroom (x307..432)":(125,157),
          "102 shower (x307..387.5)":(80.5,102),"86 shower (y242.5..310)":(67.5,86)}
for k,(px,printed) in checks.items():
    print(f"  check {k}: {cm(px):.0f} cm vs printed {printed} ({(cm(px)-printed)/printed*100:+.1f}%)")

def area(poly):
    a=0
    for (x1,y1),(x2,y2) in zip(poly,poly[1:]+poly[:1]): a+=x1*y2-x2*y1
    return abs(a)/2/S/S/1e4
def perim(poly):
    return sum(((x2-x1)**2+(y2-y1)**2)**.5 for (x1,y1),(x2,y2) in zip(poly,poly[1:]+poly[:1]))/S/100

open_space=[(441,77),(585,77),(585,162),(597,162),(597,107),(793,107),(793,637),(527,637),(527,250),(518,250),(518,310),(441,310)]
alcove=[(441,255),(518,255),(518,310),(441,310)]   # szafa gosp. 70 cm (built-in)
bedroom=[(307,318),(518,318),(518,637),(307,637)]
wardrobe=[(307,318),(450,318),(450,367),(307,367)] # szafa na ubrania i pawlacz
hall_closet=[(535,82),(585,82),(585,162),(535,162)] # unlabeled built-in by the entrance
bathroom=[(307,77),(432,77),(432,310),(307,310)]
bath_pion=[(307,77),(355,77),(355,107),(307,107)]   # hatched pion block top-left
kitchen_lower=[(597,107),(793,107),(793,305),(745,305),(745,153),(597,153)]  # fridge col + counter L
for n,p in [("open space (hol+kuchnia+salon)",open_space),("  alcove szafa gosp",alcove),("bedroom",bedroom),("  wardrobe",wardrobe),
            ("  hall closet",hall_closet),("bathroom rect",bathroom),("  bath pion",bath_pion),("kitchen cabinets footprint",kitchen_lower)]:
    print(f"{n}: area {area(p):.2f} m2, perimeter {perim(p):.2f} m")
L=lambda a,b: abs(b-a)/S/100
print("lengths m:")
for n,v in {"entrance door x447..530":L(447,530),"bath door y170..240":L(170,240),"bedroom door y322..398":L(322,398),
            "bedroom window x350..480":L(350,480),"salon window x560..760":L(560,760),
            "kitchen top wall x597..793":L(597,793),"kitchen right wall y107..305":L(107,305),
            "maskownica bedroom x307..518":L(307,518),"maskownica salon x527..793":L(527,793),
            "bath W x307..432":L(307,432),"bath D y77..310":L(77,310)}.items():
    print(f"  {n}: {v:.2f}")
