"""Decode a Figma .fig canvas (fig-kiwi binary) into JSON.

Usage: python fig_decode.py <canvas.fig> <out.json>
"""
import json
import struct
import sys
import zlib

import zstandard


def decompress(buf):
    if buf[:4] == b"\x28\xb5\x2f\xfd":
        return zstandard.ZstdDecompressor().decompressobj().decompress(buf)
    return zlib.decompress(buf, -15)


class Reader:
    def __init__(self, data):
        self.d = data
        self.o = 0

    def byte(self):
        v = self.d[self.o]
        self.o += 1
        return v

    def bool(self):
        return self.byte() != 0

    def uint(self):
        shift = 0
        result = 0
        while True:
            b = self.byte()
            result |= (b & 127) << shift
            shift += 7
            if not (b & 128):
                break
        return result

    def int(self):
        v = self.uint()
        return (v >> 1) ^ -(v & 1)

    def float(self):
        first = self.byte()
        if first == 0:
            return 0.0
        b1, b2, b3 = self.d[self.o:self.o + 3]
        self.o += 3
        bits = first | (b1 << 8) | (b2 << 16) | (b3 << 24)
        bits = ((bits << 23) | (bits >> 9)) & 0xFFFFFFFF
        return struct.unpack("<f", struct.pack("<I", bits))[0]

    def string(self):
        end = self.d.index(0, self.o)
        s = self.d[self.o:end].decode("utf-8", "replace")
        self.o = end + 1
        return s

    def bytes_(self, n):
        v = self.d[self.o:self.o + n]
        self.o += n
        return v


def read_schema(data):
    r = Reader(data)
    defs = []
    for _ in range(r.uint()):
        name = r.string()
        kind = r.byte()
        fields = []
        for _ in range(r.uint()):
            fname = r.string()
            ftype = r.int()
            is_array = r.byte()
            value = r.uint()
            fields.append((fname, ftype, is_array, value))
        defs.append((name, kind, fields))
    return defs


PRIMS = {-1: "bool", -2: "byte", -3: "int", -4: "uint", -5: "float", -6: "string", -7: "int64", -8: "uint64"}


class Decoder:
    def __init__(self, defs):
        self.defs = defs
        self.by_name = {d[0]: i for i, d in enumerate(defs)}

    def value(self, r, t):
        if t < 0:
            p = PRIMS[t]
            if p == "int64":
                return r.int()
            if p == "uint64":
                return r.uint()
            return getattr(r, p)()
        name, kind, fields = self.defs[t]
        if kind == 0:  # enum
            v = r.uint()
            for fname, _, _, fv in fields:
                if fv == v:
                    return fname
            return v
        if kind == 1:  # struct
            return {f[0]: self.field(r, f) for f in fields}
        out = {}  # message
        by_id = {f[3]: f for f in fields}
        while True:
            fid = r.uint()
            if fid == 0:
                return out
            f = by_id[fid]
            out[f[0]] = self.field(r, f)

    def field(self, r, f):
        _, t, is_array, _ = f
        if is_array:
            if t == -2:
                return list(r.bytes_(r.uint()))
            return [self.value(r, t) for _ in range(r.uint())]
        return self.value(r, t)


def decode(path):
    b = open(path, "rb").read()
    assert b[:8] == b"fig-kiwi", "not a fig-kiwi file"
    o = 12
    chunks = []
    while o < len(b):
        n = struct.unpack("<I", b[o:o + 4])[0]
        chunks.append(b[o + 4:o + 4 + n])
        o += 4 + n
    defs = read_schema(decompress(chunks[0]))
    dec = Decoder(defs)
    return dec.value(Reader(decompress(chunks[1])), dec.by_name["Message"])


if __name__ == "__main__":
    msg = decode(sys.argv[1])
    with open(sys.argv[2], "w") as fp:
        json.dump(msg, fp, ensure_ascii=False, default=lambda x: None)
    print(len(msg.get("nodeChanges", [])), "nodes")
