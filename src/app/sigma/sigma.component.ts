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
import { bidirectional } from 'graphology-shortest-path/unweighted';
import { edgePathFromNodePath } from 'graphology-shortest-path/utils';
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
  object = input.required<string>();
  container = viewChild('container', { read: ElementRef });
  renderer = signal<Sigma | undefined>(undefined);
  displayNode = signal<string[]>([]);
  displayEdge = signal<string[]>([]);
  isHover = false;

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
        this.isHover = true;
        this.findPath(node);
      });
      sigmaInstance.on('leaveNode', () => {
        this.isHover = false;
        this.findPath(undefined);
      });

      sigmaInstance.setSetting('nodeReducer', (node, data) => {
        return { ...data, color: this.isHover ? 'green' : '' };
      });

      sigmaInstance.setSetting('edgeReducer', (edge, data) => {
        return { ...data, color: this.isHover ? 'green' : '' };
      });

      this.renderer.set(sigmaInstance);
    });
  }

  findPath(node: string | undefined) {
    if (node === undefined) {
      const nodes = this.graph()?.nodes() ?? [];
      const edges = this.graph()?.edges() ?? [];
      this.displayNode.set(nodes);
      this.displayEdge.set(edges);
      return;
    }
    const path = bidirectional(this.graph()!, node, this.object()) ?? [];

    const edges =
      path.length === 0 ? [] : edgePathFromNodePath(this.graph()!, path);

    this.displayNode.set(path);
    this.displayEdge.set(edges);
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
