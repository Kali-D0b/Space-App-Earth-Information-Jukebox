#!/usr/bin/env python3
"""The Warming Song backend.
Gets NASA SVS 5207 maps + GISTEMP numbers, reads map pixel colours,
saves data/timeline.json, and serves the site.

  pip install numpy pillow
  python3 server.py            # build (first time) + serve on :8000
  python3 server.py --build    # rebuild data only
  python3 server.py --step 1   # one map per year (default: every 2nd)
"""
import argparse, csv, datetime, io, json, os, re, subprocess, time, urllib.parse, urllib.request
from http.server import ThreadingHTTPServer, SimpleHTTPRequestHandler
import numpy as np
from PIL import Image

# ---- paths + links
HR = os.path.dirname(os.path.abspath(__file__))
DT = os.path.join(HR, "data")
PB = os.path.join(HR, "public")
PG = "https://svs.gsfc.nasa.gov/5207/"
SV = "https://svs.gsfc.nasa.gov/vis/a000000/a005200/a005207/"
FR = SV + "frames/3840x2160_16x9_30p/"
CB = "giss_navy_anomaly_Vertical-both.png"   # colour bar
GL = "https://data.giss.nasa.gov/gistemp/tabledata_v4/GLB.Ts+dSST.csv"     # global temps
ZN = "https://data.giss.nasa.gov/gistemp/tabledata_v4/ZonAnn.Ts+dSST.csv"  # band temps
C2 = "https://gml.noaa.gov/webdata/ccgg/trends/co2/co2_annmean_mlo.csv"    # CO2
BD = ["64N-90N", "44N-64N", "24N-44N", "EQU-24N", "24S-EQU", "44S-24S", "64S-44S", "90S-64S"]
Y0, Y1 = 1880, 2023
UA = "warming-song/1.0"


def log(*a):
    print(time.strftime("%H:%M:%S"), *a, flush=True)


# ---- download (uses curl if old Python SSL fails)
crl = False


def get(u, to=120):
    global crl
    if not crl:
        try:
            return urllib.request.urlopen(urllib.request.Request(u, headers={"User-Agent": UA}), timeout=to).read()
        except Exception as e:
            if "SSL" not in str(e):
                raise
            log("old SSL, using curl")
            crl = True
    r = subprocess.run(["curl", "-sSL", "--fail", "--max-time", str(to), "-A", UA, u], capture_output=True)
    if r.returncode:
        raise IOError(r.stderr.decode() or "curl failed")
    return r.stdout


# download once, keep a copy
def cache(n, u):
    p = os.path.join(DT, "cache", n)
    if not os.path.exists(p):
        os.makedirs(os.path.dirname(p), exist_ok=True)
        open(p, "wb").write(get(u))
    return p


# built-in backup data from fallback-data.js
def fb(k):
    t = open(os.path.join(PB, "fallback-data.js")).read()
    return {int(y): v for y, v in json.loads(re.search(r"window\.FALLBACK = (\{.*\});", t).group(1))[k].items()}


# ---- NASA tables
def table(n, u, col):
    t = open(cache(n, u), errors="replace").read().splitlines()
    i = next(i for i, l in enumerate(t) if l.startswith("Year,"))
    o = {}
    for r in csv.DictReader(t[i:]):
        try:
            o[int(r["Year"])] = col(r)
        except (ValueError, KeyError, TypeError):
            pass
    return o


def temps():  # global yearly temp
    try:
        return table("GLB.csv", GL, lambda r: float(r["J-D"])), "data.giss.nasa.gov (GISTEMP v4)"
    except Exception as e:
        log("no GISTEMP:", e)
        return fb("gistemp"), "built-in GISTEMP copy"


def zones():  # 8 band temps
    try:
        return table("ZonAnn.csv", ZN, lambda r: [float(r[b]) for b in BD]), False
    except Exception as e:
        log("no zonal:", e)
        return fb("zones"), True


def co2():  # NOAA CO2
    try:
        o = {}
        for l in open(cache("co2.csv", C2)).read().splitlines():
            if l[:1].isdigit():
                p = l.split(",")
                o[int(p[0])] = float(p[1])
        return o
    except Exception as e:
        log("no CO2:", e)
        return fb("co2")


# ---- SVS frames
def names():  # frame file names
    try:
        h = get(FR, 60).decode(errors="replace")
        n = sorted(set(re.findall(r'href="([^"/?]+\.(?:png|tif|jpg))"', h)))
        if len(n) > 100:
            return n
    except Exception as e:
        log("no frame list:", e)
    return ["2023GISTEMP_Map.%05d.png" % i for i in range(901)]


MO = {m: i for i, m in enumerate("jan feb mar apr may jun jul aug sep oct nov dec".split(), 1)}


def times(n):  # frame -> year (from time.txt)
    o = {}
    try:
        for l in open(cache("time.txt", SV + "time.txt"), errors="replace"):
            d = re.findall(r"\d+", l)
            y = re.search(r"\b(18[89]\d|19\d\d|20[0-2]\d)\b", l)
            if not d or not y:
                continue
            y = int(y.group(1))
            k = int(d[0]) if int(d[0]) != y else len(o)
            m = next((MO[w[:3].lower()] for w in re.findall(r"[A-Za-z]{3,}", l) if w[:3].lower() in MO), 6)
            o[k] = y + (m - .5) / 12
    except Exception as e:
        log("no time.txt:", e)
    if len(o) < n / 2:  # spread evenly
        o = {i: Y0 + i / (n - 1) * (Y1 + 1 - Y0) for i in range(n)}
    return o


def bar(p, n=128):  # colour bar -> list of colours, cold to hot
    a = np.asarray(Image.open(p).convert("RGBA")).astype(np.int16)
    c, al = a[..., :3], a[..., 3]
    m = (al >= 128) if al[1, 1] < 128 else (np.abs(c - c[1, 1]).max(-1) > 40)
    m &= (c.max(-1) - c.min(-1)) > 25  # colourful only
    s = m.sum(0)
    x = np.where(s >= s.max() * .8)[0]
    r = np.where(m[:, x.min():x.max() + 1].any(1))[0]
    ys = np.linspace(r.max(), r.min(), n).astype(int)  # bottom to top
    return c[ys][:, x.min():x.max() + 1].mean(1).astype(np.float32)


# Robinson projection tables
RL = np.arange(0, 95, 5.0)
RP = np.array([0, .062, .124, .186, .248, .31, .372, .434, .4958, .5571, .6176, .6769, .7346, .7903, .8435, .8936, .9394, .9761, 1])
RN = np.array([1, .9986, .9954, .99, .9822, .973, .96, .9427, .9216, .8962, .8679, .835, .7986, .7597, .7186, .6732, .6213, .5722, .5322])


def rows(h):  # lat + area weight per map row
    y = 1 - 2 * (np.arange(h) + .5) / h
    la = np.sign(y) * np.interp(abs(y), RP, RL)
    w = np.cos(np.radians(la)) / (np.interp(abs(la), RL, RN) * np.interp(abs(la), RL, np.gradient(RP, RL)))
    return la, w


def read(im, cb, mt=55):  # each pixel -> spot on colour bar (0-1)
    a = np.asarray(im.convert("RGB").resize((1280, 720))).astype(np.float32)
    f = a.reshape(-1, 3)
    p = np.full(len(f), np.nan, np.float32)
    for i in range(0, len(f), 50000):
        d = ((f[i:i + 50000, None] - cb[None]) ** 2).sum(-1)
        j = d.argmin(1)
        ok = d[np.arange(len(j)), j] <= mt * mt
        p[i:i + 50000][ok] = j[ok] / (len(cb) - 1)
    p = p.reshape(720, 1280)
    v = np.isfinite(p)
    r, c = np.where(v.mean(1) > .08)[0], np.where(v.mean(0) > .08)[0]
    if len(r) < 50 or len(c) < 100:
        raise RuntimeError("no map found")
    bx = (int(c.min()), int(r.min()), int(c.max()) + 1, int(r.max()) + 1)
    return p[bx[1]:bx[3], bx[0]:bx[2]], bx, a


def stats(p):  # area-weighted averages
    la, w = rows(p.shape[0])
    W = w[:, None] * np.isfinite(p)
    q = np.nan_to_num(p)
    L = la[:, None] * np.ones_like(q)
    def m(s):
        ww = W * s
        return float((q * ww).sum() / ww.sum()) if ww.sum() else float("nan")
    return {"all": m(1), "arctic": m(L > 64), "tropics": m(abs(L) < 23.5), "antarctic": m(L < -64), "q": q, "W": W}


# ---- build timeline.json
def build(step, lo, hi):
    os.makedirs(os.path.join(DT, "frames"), exist_ok=True)
    tp, src = temps()
    cc, (zz, zfb) = co2(), zones()
    cb = bar(cache(CB, SV + CB))
    nm = names()
    tm = times(len(nm))
    ys = list(range(Y0, Y1 + 1, step))
    if ys[-1] != Y1:
        ys.append(Y1)
    st = {}
    for y in ys:
        k0 = min(tm, key=lambda i: abs(tm[i] - (y + .95)))  # frame nearest end of year
        bd = None
        for k in (k0, k0 - 1, k0 + 1, k0 - 2, k0 + 2):  # try neighbours too
            if 0 <= k < len(nm):
                try:
                    bd = get(FR + nm[k])
                    break
                except Exception:
                    pass
        if bd is None:
            log(y, "no frame")
            continue
        try:
            p, bx, sm = read(Image.open(io.BytesIO(bd)), cb)
        except Exception as e:
            log(y, "skipped:", e)
            continue
        st[y] = stats(p)
        w, h = bx[2] - bx[0], bx[3] - bx[1]
        Image.fromarray(sm.astype(np.uint8)).crop(bx).resize((1024, 1024 * h // w)).save(os.path.join(DT, "frames", f"{y}.jpg"), quality=82)
        log(y, "ok")
    if not st:
        raise SystemExit("No maps read. Check internet.")
    # colour spot -> °C (fit to NASA numbers, 2-yr mean like the maps)
    k = sorted(st)
    if lo is not None and hi is not None:
        a, b, r2 = lo, hi - lo, None
    else:
        X = np.array([st[y]["all"] for y in k])
        Y = np.array([(tp.get(y, np.nan) + tp.get(y - 1, tp.get(y, np.nan))) / 2 for y in k])
        ok = np.isfinite(X) & np.isfinite(Y)
        b, a = np.polyfit(X[ok], Y[ok], 1)
        r2 = float(np.corrcoef(X[ok], Y[ok])[0, 1] ** 2)
        log(f"scale: {a:+.2f} to {a + b:+.2f} °C (R²={r2:.3f})")
    out = []
    for y in range(Y0, Y1 + 1):
        r = {"year": y, "anomaly": tp.get(y), "co2": cc.get(y), "zones": zz.get(y)}
        if y in st:
            s = st[y]
            hot = (((a + b * s["q"]) > 1) * s["W"]).sum() / s["W"].sum()
            r.update(image=f"data/frames/{y}.jpg", map_mean=round(a + b * s["all"], 3), arctic=round(a + b * s["arctic"], 3),
                     tropics=round(a + b * s["tropics"], 3), antarctic=round(a + b * s["antarctic"], 3), hot_share=round(float(hot), 3))
        out.append(r)
    json.dump({"source": "NASA SVS 5207 (GISTEMP v4, vs 1951–1980)", "page": PG, "temps_from": src,
               "built": datetime.date.today().isoformat(), "zone_bands": BD,
               "zones_from": "built-in copy" if zfb else "data.giss.nasa.gov (ZonAnn)",
               "calibration": {"coldest_c": round(float(a), 3), "warmest_c": round(float(a + b), 3), "r2": r2}, "years": out},
              open(os.path.join(DT, "timeline.json"), "w"), indent=1)
    log(f"saved timeline.json ({len(st)} maps)")


# ---- web server (public/ + /data/)
class Hd(SimpleHTTPRequestHandler):
    def __init__(s, *a, **k):
        super().__init__(*a, directory=PB, **k)

    def log_message(s, *a):
        pass

    def translate_path(s, p):
        p2 = urllib.parse.urlparse(p).path
        if p2.startswith("/data/"):
            return os.path.join(DT, os.path.normpath(p2[6:]).lstrip("/\\."))
        return super().translate_path(p)

    def end_headers(s):
        s.send_header("Cache-Control", "no-store")
        super().end_headers()


def main():
    global PG, SV, FR, GL, ZN, C2
    ap = argparse.ArgumentParser()
    ap.add_argument("--port", type=int, default=8000)
    ap.add_argument("--build", action="store_true")
    ap.add_argument("--step", type=int, default=2)
    ap.add_argument("--cb-min", type=float)
    ap.add_argument("--cb-max", type=float)
    ap.add_argument("--base", help=argparse.SUPPRESS)  # for testing
    a = ap.parse_args()
    if a.base:  # test server for all links
        b = a.base.rstrip("/")
        PG, SV = b + "/5207/", b + "/vis/a000000/a005200/a005207/"
        FR, GL, ZN, C2 = SV + "frames/3840x2160_16x9_30p/", b + "/gistemp/GLB.Ts+dSST.csv", b + "/gistemp/ZonAnn.Ts+dSST.csv", b + "/co2_annmean_mlo.csv"
    if a.build or not os.path.exists(os.path.join(DT, "timeline.json")):
        build(a.step, a.cb_min, a.cb_max)
        if a.build:
            return
    log(f"open http://localhost:{a.port}")
    ThreadingHTTPServer(("0.0.0.0", a.port), Hd).serve_forever()


if __name__ == "__main__":
    main()
