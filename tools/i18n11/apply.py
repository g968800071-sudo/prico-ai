import sys, json, re
sys.path.insert(0,'/workspace/prico/tools/i18n11')
from keys import G
import importlib
D='/workspace/prico/www/i18n/'
for l in ['en','ru','uk','es','pt','de','fr','tr','ar','hi','id']:
    T = None if l=='en' else importlib.import_module(l).T
    src=open(D+l+'.js').read()
    existing=set(re.findall(r'(?:^|[\s,{])([A-Za-z_][A-Za-z0-9_]*)\s*:',src))
    lines=[]
    for g,(ks,v) in G.items():
        vals = v if T is None else T[g]
        assert len(vals)==len(v),(l,g)
        pairs=[f"{k}: {json.dumps(x, ensure_ascii=False)}" for k,x in zip(ks.split(),vals) if k not in existing]
        if pairs: lines.append('  '+', '.join(pairs)+',')
    i=src.rstrip().rfind('};')
    src=src[:i]+'  // v1.1\n'+'\n'.join(lines)+'\n};\n'
    open(D+l+'.js','w').write(src)
    print(l, sum(len(x.split(': '))-1 for x in lines))
