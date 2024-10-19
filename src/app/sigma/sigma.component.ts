import {
  afterNextRender,
  Component,
  computed,
  effect,
  ElementRef,
  input,
  signal,
  untracked,
  viewChild,
} from '@angular/core';
import Graph from 'graphology';
import { Sigma } from 'sigma';
import { EdgeDisplayData, NodeDisplayData } from 'sigma/types';

@Component({
  selector: 'app-sigma',
  standalone: true,
  imports: [],
  template: ` <div #container></div> `,
  styleUrl: './sigma.component.css',
})
export class SigmaComponent {
  graph = input.required<Graph | undefined>();
  container = viewChild('container', { read: ElementRef });
  renderer = signal<Sigma | undefined>(undefined);
  hoverNode = signal<string | undefined>(undefined);
  displayNode = signal<string[]>([]);
  displayEdge = signal<string[]>([]);

  neighbors = computed(() => {
    const hoverNode = this.hoverNode();
    return hoverNode ? this.graph()?.outNeighbors(hoverNode) ?? [] : [];
  });
  rendererRef = effect(() => {
    const graph = this.graph();
    const renderer = this.renderer();
    if (graph && renderer) {
      untracked(() => {
        this.displayEdge.set([]);
        this.displayNode.set([]);
      });
      renderer.clear();
      renderer.setGraph(graph);
    }
  });

  refreshRef = effect(() => {
    this.refreshGraph(this.displayNode(), this.displayEdge());
  });

  constructor() {
    afterNextRender(() => {
      const sigmaInstance = new Sigma(
        new Graph(),
        this.container()?.nativeElement,
        {
          allowInvalidContainer: true,
          renderEdgeLabels: true,
          edgeLabelSize: 16,
          labelSize: 16,
        }
      );
      sigmaInstance.on('enterNode', ({ node }) => {
        this.hoverNode.set(node);
        this.test1();
      });
      sigmaInstance.on('leaveNode', () => {
        this.hoverNode.set(undefined);
        this.test1();
      });

      sigmaInstance.setSetting('nodeReducer', (node, data) => {
        const res: Partial<NodeDisplayData> = { ...data };
        if (
          this.displayNode().length > 0 &&
          this.displayNode().length !== this.graph()?.nodes().length
        ) {
          res.color = 'green';
        } else {
          res.color = '';
        }
        return res;
      });

      sigmaInstance.setSetting('edgeReducer', (edge, data) => {
        const res: Partial<EdgeDisplayData> = { ...data };
        if (
          this.displayEdge().length > 0 &&
          this.displayEdge().length !== this.graph()?.edges().length
        ) {
          res.color = 'green';
        } else {
          res.color = '';
        }
        return res;
      });

      this.renderer.set(sigmaInstance);
    });
  }

  test1() {
    if (this.hoverNode() === undefined) {
      const nodes = this.graph()?.nodes() ?? [];
      const edges = this.graph()?.edges() ?? [];
      this.displayNode.set(nodes);
      this.displayEdge.set(edges);
      return;
    }

    let nodes = [this.hoverNode()!, ...this.neighbors()];
    let n = this.neighbors();

    do {
      n = this.findOutNeighbors(n[0]);
      nodes = nodes.concat(...n);
    } while (n.length > 0);

    const edges =
      this.graph()?.filterEdges((e) => {
        const [n1, n2] = this.graph()?.extremities(e) ?? [,];
        const idx = nodes.findIndex((x) => x === n1);
        return idx > -1 && nodes[idx + 1] === n2;
      }) ?? [];

    this.displayNode.set(nodes);
    this.displayEdge.set(edges);
  }

  findOutNeighbors(node: string) {
    if (node === undefined) return [];
    return this.graph()?.outNeighbors(node) ?? [];
  }

  refreshGraph(nodes: string[], edges: string[]) {
    this.renderer()?.refresh({
      partialGraph: {
        nodes,
        edges,
      },
      skipIndexation: true,
    });
  }
}
