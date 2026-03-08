"""CLI Entry point for the Security Review System MVP."""
import argparse
import time
import shutil
import webbrowser
from pathlib import Path

from config import Config, setup_logger
from orchestrator.graph import create_workflow

def main() -> None:
    parser = argparse.ArgumentParser(description="Security Review System MVP")
    parser.add_argument("repo_path", nargs="?", default=None,
                        help="Absolute or relative path to the local repository to analyze")
    parser.add_argument("--model", default=None, help="OpenCode model to use")
    parser.add_argument(
        "--backend", default=None, choices=["cli", "sdk"],
        help="OpenCode backend: 'cli' (subprocess, default) or 'sdk' (Python SDK)",
    )
    parser.add_argument(
        "--sdk-url", default=None,
        help="URL del server OpenCode per il backend SDK (es. http://192.168.1.100:54321)",
    )
    parser.add_argument(
        "--parallel", type=int, default=1, choices=range(1, 5),
        metavar="N", help="Number of analysis agents to run in parallel (1-4, default: 1)",
    )
    parser.add_argument("--verbose", "-v", action="store_true", help="Enable verbose logging")
    parser.add_argument(
        "--copy-report", action="store_true",
        help="Copy the final report into the analyzed repository root",
    )
    parser.add_argument(
        "--no-dashboard", action="store_true",
        help="Skip auto-opening the dashboard after scan completes",
    )
    parser.add_argument(
        "--dashboard", action="store_true",
        help="Start the dashboard server only (no scan). Ignores repo_path.",
    )
    args = parser.parse_args()

    # If --dashboard mode, start the server and exit
    if args.dashboard:
        _start_dashboard_server()
        return
    
    logger = setup_logger(verbose=args.verbose)

    # repo_path is required when not using --dashboard
    if not args.repo_path:
        parser.error("repo_path is required (unless using --dashboard)")
    
    # Resolve and validate the repo path
    repo_path = Path(args.repo_path).resolve()
    if not repo_path.exists() or not repo_path.is_dir():
        logger.error(f"Repository path does not exist or is not a directory: {repo_path}")
        return
        
    logger.info(f"Starting analysis of: {repo_path}")
    
    # Setup scan output directory
    scan_dir = Config.STATE_PATH / f"scan_{int(time.time())}"
    scan_dir.mkdir(parents=True, exist_ok=True)
    logger.info(f"Scan directory created at: {scan_dir}")
    
    # Create a sandboxed copy of the repo (agents work on the copy, never the original)
    repo_copy_dir = scan_dir / "repo_copy"
    try:
        shutil.copytree(
            repo_path, repo_copy_dir,
            ignore=shutil.ignore_patterns(*Config.COPY_IGNORE_PATTERNS),
        )
        logger.info(f"Sandboxed repo copy created at: {repo_copy_dir}")
    except Exception as e:
        logger.error(f"Failed to create sandboxed repo copy: {e}")
        return
    
    # Defensive validation: clamp parallel to safe range (argparse già filtra, ma proteggiamo da chiamate programmatiche)
    args.parallel = max(1, min(args.parallel, 4))
    
    # Initial state based on schema.py TypedDict
    logger.info(f"Parallel agents: {args.parallel}")
    
    initial_state = {
        "backend_type": args.backend or Config.OPENCODE_BACKEND,
        "max_parallel": args.parallel,            # User-configured parallelism (1-4)
        "repo_path": str(repo_path),            # Original path (for reference in report)
        "working_repo": str(repo_copy_dir),      # Sandboxed copy (agents work here)
        "scan_output_dir": str(scan_dir),
        "model_override": args.model,            # Passed via state, not Config mutation
        "sdk_url": args.sdk_url or Config.OPENCODE_SDK_URL,  # URL server SDK (None = localhost)
        "fingerprint": "", 
        "file_manifest": "",
        "current_agent": "", 
        "agent_outputs": {},
        "completed_steps": [], 
        "errors": [],
        "stop_requested": False,
    }
    
    # Initialize Graph (topologia adattata al livello di parallelismo)
    graph = create_workflow(max_parallel=args.parallel)
    
    # Stream execution
    try:
        start_time = time.time()
        # max_concurrency throttla i subprocess paralleli effettivi
        stream_config = {"max_concurrency": args.parallel}
        for event in graph.stream(initial_state, stream_mode="updates", config=stream_config):
            for node_name, state_updates in event.items():
                logger.info(f"[+] Completed node stream: {node_name}")
                if "errors" in state_updates and state_updates["errors"]:
                    logger.error(f"Errors encountered in {node_name}: {state_updates['errors'][-1]}")
    except KeyboardInterrupt:
        logger.warning("Pipeline interrupted by user (CTRL+C).")
        return
    except Exception as e:
        logger.error(f"Graph execution failed: {e}")
        return
    finally:
        # Always clean up the sandboxed repo copy
        if repo_copy_dir.exists():
            shutil.rmtree(repo_copy_dir, ignore_errors=True)
            logger.info("Sandboxed repo copy removed.")
        
    total_duration = time.time() - start_time
    logger.info(f"Graph execution completed in {total_duration:.1f}s")
    
    # Report handling: always available in scan_dir, optionally copy to repo
    report_src = scan_dir / "security_report.md"
    if report_src.exists():
        logger.info(f"Report available at: {report_src}")
        
        # Only copy to repo if explicitly requested
        if args.copy_report:
            report_dst = repo_path / "security_report.md"
            try:
                shutil.copy2(report_src, report_dst)
                logger.info(f"Report copied to repository: {report_dst}")
            except Exception as e:
                logger.error(f"Failed to copy report to repo: {e}")

        # --- Dashboard integration: persist results to DB ---
        scan_id = _persist_to_dashboard(
            repo_path, scan_dir, total_duration, report_src, logger
        )

        # Auto-open dashboard to the scan report
        if scan_id and not args.no_dashboard:
            port = Config.DASHBOARD_PORT
            url = f"http://localhost:{port}/scan/{scan_id}"
            logger.info(f"Opening dashboard: {url}")
            webbrowser.open(url)
    else:
        logger.warning(f"No security_report.md generated in {scan_dir}. The pipeline might have failed.")


def _persist_to_dashboard(
    repo_path: Path, scan_dir: Path, duration: float,
    report_path: Path, logger
) -> int | None:
    """Parse the report, insert project + scan + findings into dashboard DB."""
    try:
        from dashboard.db import init_db, upsert_project, insert_scan, insert_findings
        from dashboard.report_parser import parse_report, extract_severity_counts

        init_db(Config.DB_PATH)

        # Create or find the project
        project_id = upsert_project(
            name=repo_path.name, repo_path=str(repo_path), db_path=Config.DB_PATH
        )

        # Parse report findings
        report = parse_report(report_path)
        counts = extract_severity_counts(report.findings)

        scan_id = insert_scan(
            project_id=project_id,
            scan_dir=str(scan_dir),
            duration_seconds=duration,
            status="completed",
            total_findings=len(report.findings),
            critical=counts["CRITICAL"],
            high=counts["HIGH"],
            medium=counts["MEDIUM"],
            low=counts["LOW"],
            db_path=Config.DB_PATH,
        )

        findings_dicts = [
            {
                "title": f.title, "severity": f.severity, "owasp": f.owasp,
                "file": f.file, "description": f.description,
                "remediation": f.remediation,
            }
            for f in report.findings
        ]
        if findings_dicts:
            insert_findings(scan_id, findings_dicts, Config.DB_PATH)

        logger.info(f"Dashboard: scan #{scan_id} persisted ({len(report.findings)} findings)")
        return scan_id
    except Exception as e:
        logger.warning(f"Dashboard persistence skipped: {e}")
        return None


def _start_dashboard_server() -> None:
    """Start the FastAPI dashboard server (blocking)."""
    import uvicorn
    from dashboard.db import init_db

    init_db(Config.DB_PATH)
    port = Config.DASHBOARD_PORT
    print(f"Starting Security Review Dashboard on http://localhost:{port}")
    uvicorn.run("dashboard.app:app", host="0.0.0.0", port=port, reload=False)


if __name__ == "__main__":
    main()
