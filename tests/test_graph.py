"""Tests for orchestrator/graph.py — workflow topology validation."""
from orchestrator.graph import create_workflow, INDEPENDENT_AGENTS, SEQUENTIAL_PHASES


class TestCreateWorkflowSequential:
    """Verifica la topologia sequenziale (max_parallel=1)."""

    def test_all_nodes_registered(self):
        """Tutti gli agenti previsti sono registrati come nodi."""
        graph = create_workflow(max_parallel=1)
        node_names = set(graph.get_graph().nodes.keys())
        # Tutti i nodi dovrebbero essere presenti (+ __start__, __end__)
        for agent in ["ingest"] + INDEPENDENT_AGENTS + ["compliance", "aggregator"]:
            assert agent in node_names, f"Nodo '{agent}' mancante nel grafo"

    def test_sequential_topology_starts_with_ingest(self):
        """In modalità sequenziale, il primo nodo dopo START è ingest."""
        graph = create_workflow(max_parallel=1)
        graph_data = graph.get_graph()
        # __start__ deve avere un edge verso ingest
        start_edges = [e for e in graph_data.edges if e.source == "__start__"]
        targets = {e.target for e in start_edges}
        assert "ingest" in targets


class TestCreateWorkflowParallel:
    """Verifica la topologia fan-out/fan-in (max_parallel > 1)."""

    def test_fanout_from_ingest(self):
        """Con max_parallel > 1, ingest ha edge verso tutti gli agenti indipendenti."""
        graph = create_workflow(max_parallel=2)
        graph_data = graph.get_graph()
        ingest_edges = [e for e in graph_data.edges if e.source == "ingest"]
        targets = {e.target for e in ingest_edges}
        for agent in INDEPENDENT_AGENTS:
            assert agent in targets, f"Manca edge ingest → {agent}"

    def test_fanin_to_compliance(self):
        """Tutti gli agenti indipendenti convergono su compliance."""
        graph = create_workflow(max_parallel=3)
        graph_data = graph.get_graph()
        compliance_sources = {e.source for e in graph_data.edges if e.target == "compliance"}
        for agent in INDEPENDENT_AGENTS:
            assert agent in compliance_sources, f"Manca edge {agent} → compliance"

    def test_aggregator_is_final(self):
        """Aggregator è l'ultimo nodo prima di END."""
        graph = create_workflow(max_parallel=2)
        graph_data = graph.get_graph()
        end_edges = [e for e in graph_data.edges if e.target == "__end__"]
        sources = {e.source for e in end_edges}
        assert "aggregator" in sources
