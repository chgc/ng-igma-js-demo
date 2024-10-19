export interface Tree {
  root: TreeNode;
}

interface TreeNode {
  name: string;
  union?: UnionNode | undefined;
  leaf?: LeafNode | undefined;
}

interface UnionNode {
  nodes: TreeNode[];
}

interface LeafNode {
  computed?: ComputedData;
  tupleToUserset?: TupleToUserset | undefined;
  users?: Users;
}

interface Users {
  users: string[];
}
interface ComputedData {
  userset: string;
}

interface TupleToUserset {
  tupleset: string;
  computed: ComputedData[];
}

export interface NodeInfo {
  user: string;
  object?: string;
  color?: string;
  relation?: string;
  seq?: number;
  level?: number;
}
