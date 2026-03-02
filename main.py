"""CLI Entry point for the Security Review System MVP."""
import argparse
import time
import shutil
from pathlib import Path

from config import Config, setup_logger
from orchestrator.graph import create_workflow

def main() -> None:
    parser = argparse.ArgumentParser(description="Security Review System MVP")
    parser.add_argument("repo_path", help="Absolute or relative path to the local repository to analyze")
    parser.add_argument("--model", default=None, help="OpenCode model to use")
    parser.add_argument("--verbose", "-v", action="store_true", help="Enable verbose logging")
    parser.add_argument(
        "--copy-report", action="store_true",
        help="Copy the final report into the analyzed repository root",
    )
    args = parser.parse_args()
    
    logger = setup_logger(verbose=args.verbose)
    
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
    
    # Initial state based on schema.py TypedDict
    initial_state = {
        "repo_path": str(repo_path),            # Original path (for reference in report)
        "working_repo": str(repo_copy_dir),      # Sandboxed copy (agents work here)
        "scan_output_dir": str(scan_dir),
        "model_override": args.model,            # Passed via state, not Config mutation
        "fingerprint": "", 
        "file_manifest": "",
        "current_agent": "", 
        "agent_outputs": {},
        "completed_steps": [], 
        "errors": [],
        "stop_requested": False,
    }
    
    # Initialize Graph
    graph = create_workflow()
    
    # Stream execution
    try:
        start_time = time.time()
        for event in graph.stream(initial_state, stream_mode="updates"):
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
    else:
        logger.warning(f"No security_report.md generated in {scan_dir}. The pipeline might have failed.")

if __name__ == "__main__":
    main()
