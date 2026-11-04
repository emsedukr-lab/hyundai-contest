import json, sys, collections
m = json.load(open(sys.argv[1]))
nodes = m["nodeChanges"]
gid = lambda g: f'{g["sessionID"]}:{g["localID"]}'
by = {gid(n["guid"]): n for n in nodes}
kids = collections.defaultdict(list)
for n in nodes:
    p = n.get("parentIndex")
    if p: kids[gid(p["guid"])].append(n)
for k in kids.values(): k.sort(key=lambda n: n["parentIndex"]["position"])
print("types:", collections.Counter(n.get("type") for n in nodes).most_common())
depth = int(sys.argv[2]) if len(sys.argv) > 2 else 2
def walk(n, d):
    s = n.get("size") or {}
    print("  " * d + f'{n.get("type")} "{n.get("name")}" {round(s.get("x",0))}x{round(s.get("y",0))}  [{len(kids[gid(n["guid"])])}]')
    if d < depth:
        for c in kids[gid(n["guid"])]: walk(c, d + 1)
root = [n for n in nodes if n.get("type") == "DOCUMENT"][0]
walk(root, 0)
