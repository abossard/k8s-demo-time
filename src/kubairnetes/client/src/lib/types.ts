// ---- K8s Resources ----

export interface K8sResource {
  filePath: string;
  kind: string;
  name: string;
  namespace?: string;
  apiVersion: string;
  raw: string;
  labels?: Record<string, string>;
  relationships: ResourceRelationship[];
}

export interface ResourceRelationship {
  type: 'targets' | 'selects' | 'owns' | 'references';
  targetKind: string;
  targetName: string;
}

// ---- Command Execution ----

export interface CommandExecution {
  id: string;
  command: string;
  status: 'running' | 'completed' | 'failed' | 'cancelled';
  output: string;
  exitCode: number | null;
  startedAt: string;
  completedAt: string | null;
  dryRun: boolean;
}

// ---- Cluster State ----

export interface ClusterState {
  nodes: ClusterNode[];
  pods: ClusterPod[];
  services: ClusterService[];
  deployments: ClusterDeployment[];
  fetchedAt: string;
  error?: string;
}

export interface ClusterNode {
  name: string;
  status: string;
  roles: string[];
  cpu: { capacity: string; allocatable: string };
  memory: { capacity: string; allocatable: string };
  conditions: { type: string; status: string }[];
}

export interface ClusterPod {
  name: string;
  namespace: string;
  nodeName: string;
  status: string;
  phase: string;
  containers: {
    name: string;
    image: string;
    ready: boolean;
    restartCount: number;
    state: string;
  }[];
  labels: Record<string, string>;
  createdAt: string;
}

export interface ClusterService {
  name: string;
  namespace: string;
  type: string;
  clusterIP: string;
  ports: { port: number; targetPort: number | string; protocol: string }[];
  selector: Record<string, string>;
}

export interface ClusterDeployment {
  name: string;
  namespace: string;
  replicas: number;
  readyReplicas: number;
  selector: Record<string, string>;
}

// ---- AI-Generated Presentation ----

export interface AIPresentation {
  title: string;
  description: string;
  audienceLevel: 'beginner' | 'intermediate' | 'expert';
  slides: AISlide[];
  generatedAt: string;
  sourceHash: string;
}

export interface AISlide {
  id: string;
  title: string;
  subtitle?: string;
  headline: string;
  explanation: string;
  buildSteps: BuildStep[];
  keyTakeaways: string[];
  visuals: SlideVisual[];
  commands: AICommand[];
  speakerNotes: string;
  transition?: string;
  rawSection?: string;
  order: number;
}

export interface BuildStep {
  type: 'text' | 'code' | 'command' | 'visual_highlight' | 'reveal';
  content: string;
  label?: string;
}

export interface SlideVisual {
  type: 'hpa' | 'probes' | 'resources' | 'qos' | 'vpa' | 'rollout' | 'mermaid' | 'architecture' | 'custom' | 'none';
  mermaidCode?: string;
  customCode?: string;
  description?: string;
  config?: Record<string, unknown>;
}

export interface AICommand {
  raw: string;
  explanation: string;
  expectedOutcome: string;
  isDangerous: boolean;
  order: number;
}

// ---- Chat ----

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
}

export interface ChatRequest {
  message: string;
  context: {
    currentSlide?: AISlide;
    yamlFiles?: K8sResource[];
    recentCommands?: CommandExecution[];
  };
  history: ChatMessage[];
}

// ---- File Browsing ----

export interface FileEntry {
  name: string;
  path: string;
  type: 'file' | 'directory';
  isReadme: boolean;
  isYaml: boolean;
  children?: FileEntry[];
}
