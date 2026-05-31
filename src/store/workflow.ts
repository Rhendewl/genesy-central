import { create } from "zustand";
import { addEdge, applyNodeChanges, applyEdgeChanges } from "@xyflow/react";
import type { NodeChange, EdgeChange, Connection, XYPosition } from "@xyflow/react";
import type {
  WorkflowNode,
  WorkflowEdge,
  WorkflowNodeType,
  WorkflowNodeData,
  WorkflowJSON,
  NodeExecutionStatus,
} from "@/lib/workflow/types";
import { serializeWorkflow, deserializeWorkflow } from "@/lib/workflow/types";
import { DEFAULT_NODE_DATA, STARTER_WORKFLOW } from "@/components/criativos/nodes/nodeConfig";

export type WorkflowExecutionState = "idle" | "running" | "completed" | "error";

interface WorkflowStore {
  projectId: string | null;
  projectName: string;
  setProject: (id: string, name: string) => void;

  nodes: WorkflowNode[];
  edges: WorkflowEdge[];

  onNodesChange: (changes: NodeChange<WorkflowNode>[]) => void;
  onEdgesChange: (changes: EdgeChange<WorkflowEdge>[]) => void;
  onConnect: (connection: Connection) => void;

  selectedNodeId: string | null;
  setSelectedNodeId: (id: string | null) => void;

  addNode: (type: WorkflowNodeType, position: XYPosition) => void;
  updateNodeData: (id: string, data: Partial<WorkflowNodeData>) => void;
  removeNode: (id: string) => void;

  setNodeExecutionStatus: (id: string, status: NodeExecutionStatus, output?: unknown, error?: string) => void;
  resetExecutionStatus: () => void;

  executionState: WorkflowExecutionState;
  setExecutionState: (state: WorkflowExecutionState) => void;

  runTrigger: number;
  runTargetResultId: string | null;
  requestRun: () => void;
  requestRunForResult: (nodeId: string) => void;

  isDirty: boolean;
  isSaving: boolean;
  setIsSaving: (v: boolean) => void;
  markDirty: () => void;
  markClean: () => void;

  toJSON: () => WorkflowJSON;
  loadFromJSON: (json: WorkflowJSON) => void;
  loadStarter: () => void;

  reset: () => void;
}

let nodeCounter = 0;
function generateNodeId(type: string) {
  return `${type}-${Date.now()}-${++nodeCounter}`;
}

export const useWorkflowStore = create<WorkflowStore>((set, get) => ({
  projectId: null,
  projectName: "Novo Projeto",
  setProject: (id, name) => set({ projectId: id, projectName: name }),

  nodes: [],
  edges: [],

  onNodesChange: (changes) => {
    set((s) => ({
      nodes: applyNodeChanges(changes, s.nodes) as WorkflowNode[],
      isDirty: true,
    }));
  },

  onEdgesChange: (changes) => {
    set((s) => ({
      edges: applyEdgeChanges(changes, s.edges) as WorkflowEdge[],
      isDirty: true,
    }));
  },

  onConnect: (connection) => {
    set((s) => ({
      edges: addEdge(
        {
          ...connection,
          id: `edge-${Date.now()}`,
          animated: true,
          type: "smoothstep",
          style: { stroke: "rgba(139,92,246,0.65)", strokeWidth: 1.5 },
        },
        s.edges
      ) as WorkflowEdge[],
      isDirty: true,
    }));
  },

  selectedNodeId: null,
  setSelectedNodeId: (id) => set({ selectedNodeId: id }),

  addNode: (type, position) => {
    const id = generateNodeId(type);
    const defaultData = DEFAULT_NODE_DATA[type] ?? {};
    const newNode: WorkflowNode = {
      id,
      type,
      position,
      data: { ...defaultData } as WorkflowNodeData,
    };
    set((s) => ({
      nodes: [...s.nodes, newNode],
      isDirty: true,
    }));
  },

  updateNodeData: (id, data) => {
    set((s) => ({
      nodes: s.nodes.map((n) =>
        n.id === id ? { ...n, data: { ...n.data, ...data } } : n
      ) as WorkflowNode[],
      isDirty: true,
    }));
  },

  removeNode: (id) => {
    set((s) => ({
      nodes: s.nodes.filter((n) => n.id !== id),
      edges: s.edges.filter((e) => e.source !== id && e.target !== id),
      selectedNodeId: s.selectedNodeId === id ? null : s.selectedNodeId,
      isDirty: true,
    }));
  },

  setNodeExecutionStatus: (id, status, output, error) => {
    set((s) => ({
      nodes: s.nodes.map((n) =>
        n.id === id
          ? {
              ...n,
              data: {
                ...n.data,
                executionStatus: status,
                executionOutput: output,
                executionError: error,
              },
            }
          : n
      ) as WorkflowNode[],
    }));
  },

  resetExecutionStatus: () => {
    set((s) => ({
      nodes: s.nodes.map((n) => ({
        ...n,
        data: {
          ...n.data,
          executionStatus: "idle" as NodeExecutionStatus,
          executionOutput: undefined,
          executionError: undefined,
        },
      })) as WorkflowNode[],
      executionState: "idle",
    }));
  },

  executionState: "idle",
  setExecutionState: (state) => set({ executionState: state }),

  runTrigger: 0,
  runTargetResultId: null,
  requestRun: () => set((s) => ({ runTrigger: s.runTrigger + 1, runTargetResultId: null })),
  requestRunForResult: (nodeId) => set((s) => ({ runTrigger: s.runTrigger + 1, runTargetResultId: nodeId })),

  isDirty: false,
  isSaving: false,
  setIsSaving: (v) => set({ isSaving: v }),
  markDirty: () => set({ isDirty: true }),
  markClean: () => set({ isDirty: false }),

  toJSON: () => {
    const { nodes, edges } = get();
    return serializeWorkflow(nodes, edges);
  },

  loadFromJSON: (json) => {
    const { nodes, edges } = deserializeWorkflow(json);
    set({ nodes, edges, isDirty: false });
  },

  loadStarter: () => {
    const nodes: WorkflowNode[] = STARTER_WORKFLOW.nodes.map(n => ({
      id: n.id,
      type: n.type,
      position: n.position,
      data: n.data as WorkflowNodeData,
    }));
    const edges: WorkflowEdge[] = STARTER_WORKFLOW.edges.map(e => ({
      id: e.id,
      source: e.source,
      target: e.target,
      animated: e.animated,
      style: e.style,
    }));
    set({ nodes, edges, isDirty: false });
  },

  reset: () =>
    set({
      projectId: null,
      projectName: "Novo Projeto",
      nodes: [],
      edges: [],
      selectedNodeId: null,
      executionState: "idle",
      isDirty: false,
      isSaving: false,
      runTrigger: 0,
      runTargetResultId: null,
    }),
}));
