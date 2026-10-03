import re, sys
ORANGE='97.253418%, 59.999084%, 11.764526%'
GREEN='7.450867%, 60.783386%, 28.234863%'
PURPLE='39.215088%, 12.940979%, 39.607239%'
MASK='38.822937%, 39.215088%, 39.99939%'
def paths(svg, color):
    out=[]
    for m in re.finditer(r'<path[^>]*?stroke="rgb\(%s\)"[^>]*?d="([^"]*)"' % re.escape(color), svg):
        nums=[float(x) for x in re.findall(r'-?\d+\.?\d*', m.group(1))]
        xs, ys = nums[0::2], nums[1::2]
        out.append((min(xs),min(ys),max(xs),max(ys)))
    return out
if __name__=='__main__':
    svg=open(sys.argv[1]).read()
    for name,c in [('orange',ORANGE),('green',GREEN),('purple',PURPLE)]:
        ps=paths(svg,c)
        print(name,len(ps))
        for b in sorted(set(ps)):
            w,h=b[2]-b[0],b[3]-b[1]
            print(f'  x{b[0]:7.0f}-{b[2]:7.0f} y{b[1]:7.0f}-{b[3]:7.0f}  w{w:6.0f} h{h:6.0f}')
