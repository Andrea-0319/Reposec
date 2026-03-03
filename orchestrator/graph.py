"""LangGraph definition for the Security Review System MVP.

Supports configurable parallel execution of independent analysis agents
via fan-out / fan-in topology when max_parallel > 1.
"""
from langgraph.graph import StateGraph, START, END
from langgraph.graph.state import CompiledStateGraph

from config import Config
from orchestrator.schema import SecurityState
from orchestrator.nodes import create_node_wrapper


# Agenti indipendenti: dipendono solo da fingerprint.md (parallelizzabili)
INDEPENDENT_AGENTS = ["backend_security", "frontend_security", "secrets_config", "dependency_risk"]

# Fasi sempre sequenziali
SEQUENTIAL_PHASES = ["ingest", "compliance", "aggregator"]


def create_workflow(max_parallel: int = 1) -> CompiledStateGraph:
    """Creates and compiles the analysis graph.
    
    Args:
        max_parallel: Number of agents to run concurrently (1 = sequential, 2-4 = fan-out/fan-in).
    """
    graph = StateGraph(SecurityState)
    
    # Registra tutti i nodi
    all_agents = ["ingest"] + INDEPENDENT_AGENTS + ["compliance", "aggregator"]
    for name in all_agents:
        prompt_file = Config.AGENTS_PATH / f"{name}.md"
        node_fn = create_node_wrapper(name, prompt_file)
        graph.add_node(name, node_fn)
    
    if max_parallel <= 1:
        # Sequenziale completo (backward-compatible)
        graph.add_edge(START, "ingest")
        sequence = ["ingest"] + INDEPENDENT_AGENTS + ["compliance", "aggregator"]
        for i in range(len(sequence) - 1):
            graph.add_edge(sequence[i], sequence[i + 1])
        graph.add_edge("aggregator", END)
    else:
        # Fan-out / Fan-in: 4 agenti indipendenti in parallelo
        graph.add_edge(START, "ingest")
        
        # ingest → 4 agenti paralleli (LangGraph li esegue nello stesso super-step)
        for agent in INDEPENDENT_AGENTS:
            graph.add_edge("ingest", agent)
        
        # 4 agenti → compliance (fan-in: attende il completamento di tutti)
        for agent in INDEPENDENT_AGENTS:
            graph.add_edge(agent, "compliance")
        
        graph.add_edge("compliance", "aggregator")
        graph.add_edge("aggregator", END)
    
    return graph.compile()
