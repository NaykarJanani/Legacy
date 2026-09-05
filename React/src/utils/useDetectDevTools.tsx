// useDetectDevTools.tsx
import { useEffect, useRef } from "react";

type Options = {
    onDetect?: (reason: string) => void; // custom callback when detection happens
    blockUI?: boolean; // show overlay blocking UI (default: true)
    redirectOnDetect?: boolean; // redirect to about:blank on detect (default: false)
    disableCopyCut?: boolean; // also block copy/cut (default: true)
    checkIntervalMs?: number; // how often to run heuristics (default: 1000)
};

const isLocalhost = () => {
    try {
        const host = window.location.hostname;
        return (
              host === "localhost"
        );
    } catch {
        return false;
    }
};

export const useDetectDevTools = (opts?: Partial<Options>) => {
    const options: Options = {
        onDetect: opts?.onDetect,
        blockUI: opts?.blockUI ?? true,
        redirectOnDetect: opts?.redirectOnDetect ?? false,
        disableCopyCut: opts?.disableCopyCut ?? true,
        checkIntervalMs: opts?.checkIntervalMs ?? 1000,
    };

    const detectedRef = useRef(false);
    const overlayId = "__devtools_block_overlay";

    useEffect(() => {
        if (isLocalhost()) {
            // disable security while developing locally
            // console.info("DevTools detection OFF on localhost");
            return;
        }

        // --- utility: fire detection action once ---
        const handleDetection = (reason: string) => {
            if (detectedRef.current) return;
            detectedRef.current = true;

            try {
                if (options.onDetect) options.onDetect(reason);
            } catch (e) {
                // swallow callback error
            }

            try {
                alert(`⚠️ Security Alert: DevTools/tampering detected (${reason})`);
            } catch { }

            if (options.blockUI) {
                // add a full-screen overlay to block interaction
                if (!document.getElementById(overlayId)) {
                    const ov = document.createElement("div");
                    ov.id = overlayId;
                    ov.style.position = "fixed";
                    ov.style.top = "0";
                    ov.style.left = "0";
                    ov.style.width = "100%";
                    ov.style.height = "100%";
                    ov.style.zIndex = "2147483647";
                    ov.style.background = "rgba(0,0,0,0.9)";
                    ov.style.color = "white";
                    ov.style.display = "flex";
                    ov.style.flexDirection = "column";
                    ov.style.alignItems = "center";
                    ov.style.justifyContent = "center";
                    ov.style.fontSize = "20px";
                    ov.style.textAlign = "center";
                    ov.style.padding = "20px";
                    ov.innerHTML = `
  <div style="max-width:700px; text-align:center;">
    <h2 style="margin-bottom:10px;">⚠️ Security Lock</h2>
    <p style="margin-bottom:14px;">
      This page is locked because suspicious activity was detected.
    </p>
    <ul style="list-style:none; padding:0; text-align:left; margin:0 auto 18px; max-width:500px; line-height:1.6;">
      <li>❌ DevTools / Inspect Element opened</li>
      <li>❌ Blocked keys (F12, Ctrl+Shift+I, Ctrl+U)</li>
      <li>❌ Right-click / Copy-cut attempt</li>
      <li>❌ Debugger or code tampering detected</li>
    </ul>
    <p style="margin-bottom:18px;">
      ✅ Please <strong>close DevTools</strong> and <strong>reload</strong> the page.
    </p>
    
    <div style="margin-top:14px; font-size:12px; opacity:0.7;">
      URL: ${window.location.href}<br/>
      Time: ${new Date().toLocaleString()}
    </div>
  </div>
`;
                    document.body.appendChild(ov);
                }
            }

            if (options.redirectOnDetect) {
                // try a redirect (some browsers may block)
                try {
                    window.location.href = "about:blank";
                } catch { }
            }
        };

        // --- 1) window size heuristic ---
        let lastSizeCheck = 0;
        // const sizeCheck = () => {
        //     const wDiff = Math.abs(window.outerWidth - window.innerWidth);
        //     const hDiff = Math.abs(window.outerHeight - window.innerHeight);

        //     const widthThreshold = 160; // px
        //     const heightThreshold = 200; // px

        //     // ignore small vertical bars (like Edge download bar ~80px)
        //     const ignoreSmallHeight = hDiff > 0 && hDiff < 120;

        //     if (wDiff > widthThreshold || (hDiff > heightThreshold && !ignoreSmallHeight)) {
        //         handleDetection("size-difference");
        //     }
        // };


        // // --- 2) debug-time heuristic: measure time it takes to run a function that contains `debugger` ---
        // const debugTimingCheck = () => {
        //     const start = performance.now();
        //     // eslint-disable-next-line no-debugger
        //     // intentionally trigger debugger; if devtools open, this may pause and increase runtime
        //     // Place inside try to avoid strict CSP issues in some environments
        //     try {
        //         // small function with debugger statement; most browsers won't pause unless devtools is open
        //         // We wrap in Function to avoid bundler stripping debugger in some build steps
        //         const fn = new Function("/* debug-check */; debugger;");
        //         fn();
        //     } catch (e) {
        //         // calling debugger in dynamic Function can throw in some environments; ignore
        //     }
        //     const end = performance.now();
        //     if (end - start > 100) {
        //         // if execution took >100ms, likely paused by debugger
        //         handleDetection("debugger-pause");
        //     }
        // };

        // --- 3) getter trick: reading console may trigger getter when panel open ---
        const getterCheck = () => {
            const element = document.createElement("div");
            let opened = false;
            Object.defineProperty(element, "id", {
                get() {
                    opened = true;
                    throw new Error("devtools-getter-detected");
                },
            });
            // console.log will try to read .id in some consoles; wrapping in try/catch so it doesn't break
            try {
                console.log(element);
            } catch (e) {
                // if the getter threw, treat as detection
                if (opened) handleDetection("console-getter");
            }
        };

        // --- 4) debugger statement execution time repeated (safer) ---
        const debuggerCheck = () => {
            // Another variation - measures a small loop and expects it to be fast
            const start = performance.now();
            for (let i = 0; i < 1000000; i++) {
                // a tiny no-op loop
            }
            const delta = performance.now() - start;
            if (delta > 200) {
                // unexpectedly long -> suspicious
                handleDetection("slow-exec");
            }
        };

        // --- 5) override common developer console methods to detect opening/overrides ---
        const originalConsoleWarn = console.warn;
        const originalConsoleError = console.error;
        // Simple monkeypatch to detect someone messing with console
        console.warn = function (...args: any[]) {
            if (!detectedRef.current) {
                // if someone tried to override console... suspicious
                handleDetection("console-warn-call");
            }
            return originalConsoleWarn.apply(console, args);
        };
        console.error = function (...args: any[]) {
            if (!detectedRef.current) {
                handleDetection("console-error-call");
            }
            return originalConsoleError.apply(console, args);
        };

        // --- 6) block keys and right-click ---
        const onKeyDown = (e: KeyboardEvent) => {
            // F12, Ctrl+Shift+I/J/C, Ctrl+U, Ctrl+Shift+C (inspect elements), Ctrl+Shift+K
            const blocked =
                e.key === "F12" ||
                (e.ctrlKey && e.shiftKey && ["I", "i", "J", "j", "C", "c", "K", "k"].includes(e.key)) ||
                (e.ctrlKey && ["U", "u"].includes(e.key)) ||
                (e.metaKey && e.altKey && e.key === "I"); // mac variant
            if (blocked) {
                e.preventDefault();
                e.stopPropagation();
                handleDetection("blocked-key");
                return false;
            }
            return true;
        };

        const onContextMenu = (e: MouseEvent) => {
            e.preventDefault();
            handleDetection("contextmenu");
            return false;
        };

        const onCopyCut = (e: ClipboardEvent) => {
            if (options.disableCopyCut) {
                e.preventDefault();
                handleDetection("copy-cut");
                return false;
            }
            return true;
        };

        // --- set periodic checks ---
        const interval = window.setInterval(() => {
            // sizeCheck();
            getterCheck();
            // debugTimingCheck(); // optional — may be noisy in some environments; comment if false positives
            debuggerCheck();
            lastSizeCheck++;
        }, options.checkIntervalMs);

        // attach listeners
        window.addEventListener("keydown", onKeyDown, true);
        window.addEventListener("contextmenu", onContextMenu, true);
        document.addEventListener("copy", onCopyCut, true);
        document.addEventListener("cut", onCopyCut, true);

        // clean up on unmount
        return () => {
            window.clearInterval(interval);
            window.removeEventListener("keydown", onKeyDown, true);
            window.removeEventListener("contextmenu", onContextMenu, true);
            document.removeEventListener("copy", onCopyCut, true);
            document.removeEventListener("cut", onCopyCut, true);
            // restore console
            console.warn = originalConsoleWarn;
            console.error = originalConsoleError;
            // remove overlay if left behind
            const ov = document.getElementById(overlayId);
            if (ov && ov.parentNode) ov.parentNode.removeChild(ov);
        };
    }, []); // run once on mount
};
