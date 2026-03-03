"""LangGraph state definition for the Security Review System MVP."""
from typing import TypedDict, Optional, Dict, List, Annotated
import operator


class AgentResult(TypedDict):
    """Result of a single agent's execution (TypedDict for LangGraph compatibility)."""
    success: bool
    duration: float
    output: str
    error: Optional[str]


def _merge_agent_outputs(current: Dict[str, AgentResult], update: Dict[str, AgentResult]) -> Dict[str, AgentResult]:
    """Custom reducer: merge new agent outputs into the existing dict."""
    merged = {**current, **update}
    return merged


def _keep_true(current: bool, update: bool) -> bool:
    """Latch reducer: once True, stays True regardless of subsequent updates."""
    return current or update


def _last_value(current: str, update: str) -> str:
    """Simple reducer: last writer wins (safe for parallel nodes)."""  
    return update


class SecurityState(TypedDict):
    """Shared state for the LangGraph pipeline."""
    max_parallel: int                                       # Number of analysis agents to run in parallel (1-4)
    repo_path: str                                          # Absolute path of the original repo (for reference)
    working_repo: str                                       # Sandboxed copy of the repo (agents work here)
    scan_output_dir: str                                    # Directory to save intermediate and final results
    model_override: Optional[str]                           # Model override from CLI (avoids Config mutation)
    fingerprint: str                                        # Markdown string of the tech footprint
    file_manifest: str                                      # List of relevant source files (markdown)
    current_agent: Annotated[str, _last_value]               # Agent currently executing (last-writer-wins in parallel)
    agent_outputs: Annotated[                               # agent_name -> AgentResult
        Dict[str, AgentResult], _merge_agent_outputs
    ]                                 
    completed_steps: Annotated[List[str], operator.add]     # Completed agents (append-merge)
    errors: Annotated[List[str], operator.add]              # List of errors (append-merge)
    stop_requested: Annotated[bool, _keep_true]             # Latch: stays True once set
