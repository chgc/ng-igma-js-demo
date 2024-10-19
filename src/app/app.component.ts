import { Component, inject, signal } from '@angular/core';

import { HttpClient } from '@angular/common/http';
import Graph, { DirectedGraph } from 'graphology';
import forceAtlas2 from 'graphology-layout-forceatlas2';
// import circlepack from 'graphology-layout/circlepack';
import random from 'graphology-layout/random';
import {
  catchError,
  expand,
  filter,
  forkJoin,
  map,
  of,
  pipe,
  toArray,
} from 'rxjs';
import { NodeInfo, Tree } from './interface';
import { SigmaComponent } from './sigma/sigma.component';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [SigmaComponent],
  templateUrl: './app.component.html',
  styleUrl: './app.component.css',
})
export class AppComponent {
  title = 'ng-sigma';
  graph = signal<Graph | undefined>(undefined);

  http = inject(HttpClient);

  expand(body: any) {
    return this.http
      .post<{ tree: Tree } | null>(
        `http://localhost:8080/stores/01HVB8GBE194NYZR9W3QP0VP05/expand`,
        body
      )
      .pipe(catchError(() => of(null)));
  }
  target: string = '';
  debugCheckPermission(object: string, relation: string, user: string) {
    this.target = object;
    const flattern = pipe(map((x: any[]) => x.flatMap((m) => m)));
    const parentSelf = (child: string) => {
      const [parent, relation] = child.split('#');
      return {
        parent,
        child,
        relation,
        continue: false,
        level,
        seq: 0,
      };
    };
    const mapToUserSets = (level: number) =>
      pipe(
        filter((value: any) => value != null),
        map((value: { tree: Tree }) => {
          const parent = value.tree.root.name;
          let users = value.tree.root.leaf?.users?.users ?? [];
          const sets: string[] =
            value.tree.root.union?.nodes
              .flatMap((node) => [
                ...(node.leaf?.users?.users ?? []),
                ...(node.leaf?.tupleToUserset?.computed.map((x) => x.userset) ??
                  []),
                node.leaf?.computed?.userset,
              ])
              .filter((x) => x !== undefined) ?? [];

          const rawData = [
            parentSelf(parent),
            ...sets.concat(users).map((child) => ({
              parent,
              child,
              continue: true,
              relation,
              level,
              seq: 0,
            })),
          ];

          return rawData;
        })
      );

    let level = 0;
    this.expand({
      tuple_key: {
        object,
        relation,
      },
    })
      .pipe(
        mapToUserSets(++level),
        expand((values) => {
          level += 1;
          return forkJoin(
            values
              .filter((m) => m.continue)
              .map(({ child, relation }) => {
                const [object, _relation = relation] = child.split('#') ?? [];
                return this.expand({
                  tuple_key: { object, relation: _relation },
                }).pipe(mapToUserSets(level));
              })
          ).pipe(flattern);
        }),
        toArray(),
        flattern
      )
      .subscribe({
        next: (value) => {
          const data = this.prepareNodes(object, relation, user, value);
          this.load(user, data);
        },
      });
  }

  prepareNodes(
    object: string,
    relation: string,
    user: string,
    nodes: { parent: string; child: string; seq: number; level: number }[]
  ) {
    return [
      {
        object,
        relation,
        user: `${object}#${relation}`,
        level: 0,
        seq: 0,
      },
      ...nodes.map((x) => ({
        object: x.parent,
        user: x.child,
        level: x.level,
        seq: x.seq,
      })),
      { user, seq: 0, level: -2 },
    ];
  }

  load(user: string, data: NodeInfo[]) {
    const graph = new DirectedGraph();
    const setAttribute = (label: string, color: string = 'green') => ({
      size: 12,
      label,
      color,
    });

    const createEdge = (label?: string, color: string = 'green') => ({
      type: 'arrow',
      size: 5,
      label,
      color,
    });

    // find graph path
    let path = data.reverse().reduce(
      (acc, value) =>
        value.user == acc.current
          ? {
              current: value.object ?? value.user,
              path: [...acc.path, value],
            }
          : acc,
      {
        current: user,
        path: [] as NodeInfo[],
      }
    ).path;
    let color = 'green';
    if (path.length === 1) {
      // if there is no correct path found.
      path = data;
      color = '';
    } else {
      path = path.toReversed().map((x, idx) => ({ ...x, level: idx, seq: 0 }));
    }
    // add nodes and edge
    path.forEach((item) => {
      if (!!item.user && !graph.hasNode(item.user)) {
        graph.addNode(item.user, setAttribute(item.user, color));
      }

      if (!!item.object && !graph.hasNode(item.object)) {
        graph.addNode(item.object, setAttribute(item.object, color));
      }

      if (
        !!item.user &&
        !!item.object &&
        !graph.hasEdge(item.user, item.object)
      ) {
        graph.addEdge(item.user, item.object, createEdge(item.relation, color));
      }
    });

    random.assign(graph);
    // circlepack.assign(graph);

    // const sensibleSettings = forceAtlas2.inferSettings(graph);
    const sensibleSettings = forceAtlas2.inferSettings(500);

    forceAtlas2.assign(graph, {
      iterations: 50,
      settings: sensibleSettings,
    });
    this.graph.set(graph);
  }
}
