"""Extract design tokens, text/effect styles and component inventory from decoded .fig JSON.

Usage: python fig_tokens.py <out_dir> <decoded.json> [<decoded.json> ...]
"""
import collections
import json
import os
import sys


def gid(g):
    return f'{g["sessionID"]}:{g["localID"]}'


def hexcolor(c):
    to = lambda v: max(0, min(255, round(v * 255)))
    a = to(c.get("a", 1))
    rgb = f'{to(c["r"]):02X}{to(c["g"]):02X}{to(c["b"]):02X}'
    return f"#{rgb}" if a == 255 else f"#{a:02X}{rgb}"


def ref_of(r):
    if "assetRef" in r:
        return r["assetRef"]["key"]
    return gid(r["guid"])


class Tokens:
    def __init__(self):
        self.vars = {}  # ref -> node
        self.sets = {}  # ref -> node
        self.src = {}

    def add(self, nodes, src):
        for n in nodes:
            t = n.get("type")
            if t not in ("VARIABLE", "VARIABLE_SET"):
                continue
            target = self.vars if t == "VARIABLE" else self.sets
            for ref in filter(None, [n.get("key"), gid(n["guid"]) if "guid" in n else None]):
                target.setdefault(ref, n)
                self.src.setdefault(ref, src)

    def modes(self, var):
        s = self.sets.get(ref_of(var["variableSetID"]))
        return {gid(m["id"]): m["name"] for m in (s or {}).get("variableSetModes", [])}

    def set_name(self, var):
        s = self.sets.get(ref_of(var["variableSetID"]))
        return s["name"] if s else "?"

    def resolve(self, var, mode_name=None, depth=0):
        """Return {mode_name: value} for var; aliases resolved to the matching mode."""
        modes = self.modes(var)
        out = {}
        for e in var.get("variableDataValues", {}).get("entries", []):
            mname = modes.get(gid(e["modeID"]), gid(e["modeID"]))
            if mode_name and mname != mode_name:
                continue
            out[mname] = self.value(e["variableData"], mname, depth)
        if mode_name and not out:  # target has no such mode -> take first
            vals = self.resolve(var, None, depth)
            return {mode_name: next(iter(vals.values()), None)} if vals else {}
        return out

    def value(self, vd, mname, depth):
        v = vd.get("value", {})
        if vd.get("dataType") == "ALIAS":
            target = self.vars.get(ref_of(v["alias"]))
            if not target or depth > 10:
                return None
            r = self.resolve(target, mname, depth + 1)
            return r.get(mname) if mname in r else next(iter(r.values()), None)
        if "colorValue" in v:
            return hexcolor(v["colorValue"])
        if "floatValue" in v:
            f = v["floatValue"]
            return int(f) if float(f).is_integer() else round(f, 3)
        if "textValue" in v:
            return v["textValue"]
        if "boolValue" in v:
            return v["boolValue"]
        return None


def text_styles(nodes):
    out = {}
    for n in nodes:
        if n.get("styleType") != "TEXT":
            continue
        lh = n.get("lineHeight", {})
        ls = n.get("letterSpacing", {})
        out[n["name"]] = {
            "font": n.get("fontName", {}).get("family"),
            "weight": n.get("fontName", {}).get("style"),
            "size": n.get("fontSize"),
            "lineHeight": f'{lh.get("value")}{"%" if lh.get("units") == "PERCENT" else ""}' if lh else None,
            "letterSpacing": f'{ls.get("value")}{"%" if ls.get("units") == "PERCENT" else ""}' if ls else None,
        }
    return out


def effect_styles(nodes):
    out = {}
    for n in nodes:
        if n.get("styleType") != "EFFECT":
            continue
        out[n["name"]] = [
            {"type": e.get("type"), "x": e.get("offset", {}).get("x"), "y": e.get("offset", {}).get("y"),
             "blur": e.get("radius"), "spread": e.get("spread"), "color": hexcolor(e["color"]) if "color" in e else None}
            for e in n.get("effects", [])
        ]
    return out


def components(nodes):
    by = {gid(n["guid"]): n for n in nodes if "guid" in n}
    kids = collections.defaultdict(list)
    for n in nodes:
        p = n.get("parentIndex")
        if p:
            kids[gid(p["guid"])].append(n)

    def path(n):
        names = []
        while n:
            if n.get("type") == "CANVAS":
                names.append(n.get("name"))
                break
            p = n.get("parentIndex")
            n = by.get(gid(p["guid"])) if p else None
        return names[-1] if names else "?"

    out = []
    for n in nodes:
        if n.get("isStateGroup"):
            variants = [c.get("name") for c in kids[gid(n["guid"])] if c.get("type") == "SYMBOL"]
            props = collections.defaultdict(set)
            for v in variants:
                for kv in (v or "").split(","):
                    if "=" in kv:
                        k, val = kv.split("=", 1)
                        props[k.strip()].add(val.strip())
            s = n.get("size", {})
            out.append({"name": n.get("name"), "page": path(n), "variants": len(variants),
                        "size": f'{round(s.get("x", 0))}x{round(s.get("y", 0))}',
                        "props": {k: sorted(v) for k, v in props.items()}})
    return sorted(out, key=lambda c: (c["page"], c["name"] or ""))


def main():
    out_dir = sys.argv[1]
    os.makedirs(out_dir, exist_ok=True)
    tok = Tokens()
    loaded = []
    for path in sys.argv[2:]:
        nodes = json.load(open(path))["nodeChanges"]
        name = os.path.splitext(os.path.basename(path))[0]
        tok.add(nodes, name)
        loaded.append((name, nodes))

    # variables grouped by set name, deduped by key
    seen = set()
    grouped = collections.defaultdict(dict)
    for ref, v in tok.vars.items():
        k = v.get("key") or ref
        if k in seen:
            continue
        seen.add(k)
        grouped[f'{tok.set_name(v)} ({v.get("variableResolvedType")})'][v["name"]] = tok.resolve(v)
    grouped = {k: dict(sorted(v.items())) for k, v in sorted(grouped.items())}
    json.dump(grouped, open(f"{out_dir}/variables.json", "w"), ensure_ascii=False, indent=1)

    for name, nodes in loaded:
        json.dump({"text": text_styles(nodes), "effect": effect_styles(nodes)},
                  open(f"{out_dir}/styles_{name}.json", "w"), ensure_ascii=False, indent=1)
        json.dump(components(nodes), open(f"{out_dir}/components_{name}.json", "w"), ensure_ascii=False, indent=1)
    print({k: len(v) for k, v in grouped.items()})


if __name__ == "__main__":
    main()
