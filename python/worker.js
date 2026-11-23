/* Runs Python (Pyodide) off the main thread so the page never freezes. */
/* Python core is self-hosted (works even where the CDN is blocked); the CDN is a
 * fallback for the core and the source for optional packages like numpy. */
const CDN_URL = "https://cdn.jsdelivr.net/pyodide/v0.27.2/full/";
const LOCAL_URL = new URL("pyodide/", self.location.href).href;
let PYODIDE_URL = LOCAL_URL;
try {
  importScripts(LOCAL_URL + "pyodide.js");
} catch (e) {
  PYODIDE_URL = CDN_URL;
  importScripts(CDN_URL + "pyodide.js");
}

let pyodide = null;
let ctrl = null; // Int32Array [state, length] in shared memory (interactive input)
let inputBytes = null; // Uint8Array for the typed line
let stdinLines = []; // fallback when shared memory is unavailable

const post = (type, data) => self.postMessage({ type, data });

const RUNNER = `
import sys, traceback, io, base64, linecache

def _setup_matplotlib():
    import matplotlib
    matplotlib.use("Agg")
    import matplotlib.pyplot as plt
    if getattr(plt.show, "_web_patched", False):
        return
    def show(*args, **kwargs):
        for num in plt.get_fignums():
            fig = plt.figure(num)
            buf = io.BytesIO()
            fig.savefig(buf, format="png", bbox_inches="tight", dpi=110)
            _emit_image(base64.b64encode(buf.getvalue()).decode())
        plt.close("all")
    show._web_patched = True
    plt.show = show

def _run_user_code(code):
    if "matplotlib" in code:
        try:
            _setup_matplotlib()
        except Exception:
            pass
    linecache.cache["main.py"] = (len(code), None, code.splitlines(True), "main.py")
    ns = {"__name__": "__main__", "__builtins__": __builtins__}
    ok = True
    try:
        exec(compile(code, "main.py", "exec"), ns)
    except SystemExit as e:
        if e.code not in (None, 0):
            print(e.code if isinstance(e.code, str) else f"Exited with code {e.code}", file=sys.stderr)
            ok = False
    except BaseException as e:
        tb = e.__traceback__.tb_next if e.__traceback__ else None
        traceback.print_exception(type(e), e, tb)
        ok = False
    finally:
        mpl = sys.modules.get("matplotlib.pyplot")
        if mpl is not None and mpl.get_fignums():
            try:
                mpl.show()
            except Exception:
                pass
        sys.stdout.flush()
        sys.stderr.flush()
    return ok
`;

function readLine() {
  if (!ctrl) {
    return stdinLines.length ? stdinLines.shift() + "\n" : undefined; // undefined = EOF
  }
  Atomics.store(ctrl, 0, 0);
  post("input");
  Atomics.wait(ctrl, 0, 0);
  if (Atomics.load(ctrl, 0) === 2) throw new Error("Execution stopped");
  const len = ctrl[1];
  const copy = new Uint8Array(len);
  copy.set(inputBytes.subarray(0, len));
  return new TextDecoder().decode(copy) + "\n";
}

function makeWriter(type) {
  const dec = new TextDecoder();
  return {
    write(buf) {
      post(type, dec.decode(buf, { stream: true }));
      return buf.length;
    },
  };
}

async function init(msg) {
  if (msg.sab) {
    ctrl = new Int32Array(msg.sab, 0, 2);
    inputBytes = new Uint8Array(msg.sab, 8);
  }
  try {
    pyodide = await loadPyodide({ indexURL: PYODIDE_URL });
  } catch (e) {
    if (PYODIDE_URL === CDN_URL) throw e;
    PYODIDE_URL = CDN_URL; // local files missing/broken: try the CDN
    pyodide = await loadPyodide({ indexURL: CDN_URL });
  }
  // Packages (numpy, pandas, ...) aren't self-hosted: fetch them from the CDN.
  if (pyodide._api && pyodide._api.config) pyodide._api.config.indexURL = CDN_URL;
  if (msg.interrupt) pyodide.setInterruptBuffer(new Uint8Array(msg.interrupt));
  pyodide.setStdout(makeWriter("stdout"));
  pyodide.setStderr(makeWriter("stderr"));
  pyodide.setStdin({ stdin: readLine });
  pyodide.globals.set("_emit_image", (b64) => post("image", b64));
  pyodide.runPython(RUNNER);
  const version = pyodide.runPython("import sys; sys.version.split()[0]");
  post("ready", { version, interactive: !!ctrl });
}

async function run(msg) {
  stdinLines = (msg.stdin || "").split("\n");
  if (stdinLines.length && stdinLines[stdinLines.length - 1] === "") stdinLines.pop();
  let ok = false, pkgError = false;
  try {
    await pyodide.loadPackagesFromImports(msg.code, {
      messageCallback: (m) => {
        if (/^Loading /.test(m)) post("info", m);
      },
      errorCallback: (m) => { pkgError = true; post("stderr", m + "\n"); },
    });
    if (pkgError) post("stderr", "(Extra packages download from cdn.jsdelivr.net, which may be blocked on this network.)\n\n");
    const fn = pyodide.globals.get("_run_user_code");
    ok = fn(msg.code);
    fn.destroy();
  } catch (err) {
    post("stderr", String(err && err.message ? err.message : err) + "\n");
  }
  post("done", { ok });
}

self.onmessage = async (e) => {
  const msg = e.data;
  try {
    if (msg.type === "init") await init(msg);
    else if (msg.type === "run") await run(msg);
  } catch (err) {
    post("fatal", String(err && err.message ? err.message : err));
  }
};
