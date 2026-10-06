# Exact-key comparison (section + description) of the AI kosztorys (#168) against the owner's (#175),
# with szablon #165 as the reference for "[NEW]" positions. Both bathroom sections fold into one
# because the AI wrote both bathrooms into a single „Łazienka". Same work under a different position
# is NOT paired here — that pairing is manual, in ../owner-comparison.md.
# Snapshot: prod backup 2026-10-05 16:34 UTC, exported with
#   select i.investment_id, s.name sec, s.display_order so, i.display_order io, i.id,
#          replace(i.description,E'\n',' ') d, i.unit, i.planned_qty, i.client_price,
#          coalesce(replace(i.note,E'\n',' '),'') note, i.created_at::date
#   from kosztorys_items i join kosztorys_sections s on s.id=i.section_id
#   where i.investment_id in (165,168,175) order by 1,3,4
import collections, csv, os, re
S = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'owner') + '/'
rows = list(csv.DictReader(open(S + 'items-165-168-175.tsv'), delimiter='\t'))
def norm(s): return re.sub(r'\s+', ' ', (s or '').strip().lower())
def sec(s): return 'Łazienka' if s.startswith('Łazienka') else s
by = collections.defaultdict(list)
for r in rows:
    r['q'] = float(r['planned_qty']); r['p'] = float(r['client_price']); r['v'] = r['q'] * r['p']
    by[r['investment_id']].append(r)
tpl = {(sec(r['sec']), norm(r['d'])): r for r in by['165']}

def agg(inv):
    out = collections.OrderedDict()
    for r in by[inv]:
        k = (sec(r['sec']), norm(r['d']))
        a = out.setdefault(k, dict(d=r['d'], unit=r['unit'], q=0, v=0, prices=set()))
        a['q'] += r['q']; a['v'] += r['v']; a['prices'].add(r['p'])
    return out
ai, ow = agg('168'), agg('175')
keys = list(dict.fromkeys(list(ow) + list(ai)))
out = []
for k in keys:
    a, o = ai.get(k), ow.get(k)
    aq = a['q'] if a else 0; oq = o['q'] if o else 0
    av = a['v'] if a else 0; ov = o['v'] if o else 0
    if not aq and not oq and not av and not ov:
        continue
    base = o or a
    price_ai = sorted(a['prices']) if a else []
    price_ow = sorted(o['prices']) if o else []
    out.append(dict(sec=k[0], d=base['d'][:110], unit=base['unit'], aq=aq, oq=oq, av=av, ov=ov,
                    pa=price_ai, po=price_ow, in_tpl=k in tpl))
def f(x): return f'{x:,.1f}'.replace(',', ' ')
tot_a = sum(r['av'] for r in out); tot_o = sum(r['ov'] for r in out)
print('TOTAL ai', round(tot_a), 'owner', round(tot_o))
cats = collections.Counter()
for r in out:
    c = 'both' if r['aq'] and r['oq'] else 'ai_only' if r['aq'] else 'owner_only'
    r['cat'] = c; cats[c] += 1
print(cats)
for c in ['both', 'owner_only', 'ai_only']:
    sub = [r for r in out if r['cat'] == c]
    print(f'\n### {c}  n={len(sub)}  ai={round(sum(r["av"] for r in sub))}  owner={round(sum(r["ov"] for r in sub))}')
    for r in sorted(sub, key=lambda r: -abs(r['ov'] - r['av'])):
        pr = '' if r['pa'] == r['po'] or not r['pa'] or not r['po'] else f' PRICE ai{r["pa"]} ow{r["po"]}'
        new = '' if r['in_tpl'] else ' [NEW]'
        print(f"{r['sec'][:14]:14} | {r['d'][:70]:70} | {r['unit']:4} | ai {f(r['aq']):>7} ow {f(r['oq']):>7} | Δzł {round(r['ov']-r['av']):>7} | p {r['po'] or r['pa']}{pr}{new}")
