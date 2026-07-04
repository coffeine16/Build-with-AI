"""
Pipeline scheduler — the container's entrypoint.
Runs the full recompute every PIPELINE_INTERVAL seconds, forever.
One bad tick never kills the container (try/except), and
`restart: unless-stopped` in compose survives crashes/reboots.

The actual pipeline logic lives in /pipeline (repo root); this folder is
just the container packaging. At build time, copy the pipeline code here
or adjust the Dockerfile COPY path to ../../pipeline.
"""
import os
import time
import traceback


def run_pipeline():
    # Import here so a syntax error in pipeline code doesn't kill the loop process
    from main import run  # pipeline/main.py should expose run()
    run()


if __name__ == "__main__":
    interval = int(os.environ.get("PIPELINE_INTERVAL", "300"))
    print(f"[scheduler] recompute every {interval}s. Ctrl+C to stop.")
    while True:
        try:
            t0 = time.time()
            run_pipeline()
            print(f"[scheduler] tick OK in {time.time() - t0:.1f}s")
        except Exception:
            print("[scheduler] tick FAILED (continuing):")
            traceback.print_exc()
        time.sleep(interval)
