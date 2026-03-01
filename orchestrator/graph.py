"""LangGraph definition for the Security Review System MVP."""
from langgraph.graph import StateGraph, START, END
from langgraph.graph.state import CompiledStateGraph

from config import Config
from orchestrator.schema import SecurityState
from orchestrator.nodes import create_node_wrapper

def create_workflow() -> CompiledStateGraph:
    """Creates and compiles the linear sequential graph for security analysis."""
    graph = StateGraph(SecurityState)
    
    # Define the sequence of agents
    sequence = ["ingest"] + Config.ANALYSIS_AGENTS + ["aggregator"]
    
    # Add nodes dynamically based on the sequence
    for name in sequence:
        prompt_file = Config.AGENTS_PATH / f"{name}.md"
        node_fn = create_node_wrapper(name, prompt_file)
        graph.add_node(name, node_fn)
        
    # Add linear sequential edges
    graph.add_edge(START, sequence[0])
    
    for i in range(len(sequence) - 1):
        graph.add_edge(sequence[i], sequence[i + 1])
        
    graph.add_edge(sequence[-1], END)
    
    return graph.compile()
