"""Tiny UI Automator helper for manual checks on the Pleos emulator: dump | tap <text-or-tag> | shot <file>."""
import re, subprocess, sys, time
ADB = [f"{__import__('os').path.expanduser('~')}/Library/Android/sdk/platform-tools/adb", "-s", sys.argv[1]]
def sh(cmd): return subprocess.run(ADB + ["shell", cmd], capture_output=True, text=True).stdout
def nodes():
    sh("uiautomator dump /sdcard/ui.xml >/dev/null")
    out = []
    for n in re.findall(r"<node [^>]*>", sh("cat /sdcard/ui.xml")):
        t = re.search(r' text="([^"]*)"', n).group(1); d = re.search(r'content-desc="([^"]*)"', n).group(1)
        x1, y1, x2, y2 = map(int, re.search(r'bounds="\[(\d+),(\d+)\]\[(\d+),(\d+)\]"', n).groups())
        if t or d: out.append((t, d, (x1 + x2) // 2, (y1 + y2) // 2))
    return out
cmd = sys.argv[2]
if cmd == "dump":
    for t, d, x, y in nodes(): print(repr(t), repr(d), x, y)
elif cmd == "tap":
    want = sys.argv[3]
    for _ in range(20):
        hit = next((n for n in nodes() if n[1] == want or want in n[0]), None)
        if hit: sh(f"input tap {hit[2]} {hit[3]}"); print("tapped", hit[0] or hit[1]); break
        time.sleep(0.5)
    else: sys.exit(f"not found: {want}")
elif cmd == "shot":
    open(sys.argv[3], "wb").write(subprocess.run(ADB + ["exec-out", "screencap", "-p"], capture_output=True).stdout)
