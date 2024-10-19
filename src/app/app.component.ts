import { Component, inject, signal } from '@angular/core';
import Graph, { DirectedGraph } from 'graphology';
import {
  catchError,
  EMPTY,
  expand,
  filter,
  forkJoin,
  map,
  of,
  pipe,
  sequenceEqual,
  toArray,
} from 'rxjs';
import { NodeInfo, Tree } from './interface';
import { SigmaComponent } from './sigma/sigma.component';
import { HttpClient } from '@angular/common/http';
import forceAtlas2 from 'graphology-layout-forceatlas2';

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
    const mapToUserSets = (level: number) =>
      pipe(
        filter((value: any) => value != null),
        map((value: { tree: Tree }) => {
          const parent = value.tree.root.name;
          const parentSelf = {
            parent: parent.split('#')[0],
            child: parent,
            relation: parent.split('#')[1],
            continue: false,
            level,
            seq: 0,
          };
          let users = value.tree.root.leaf?.users?.users ?? [];
          const sets = value.tree.root.union?.nodes
            .flatMap((node) => {
              if (node.leaf?.users) {
                users = users.concat(node.leaf.users.users);
                return [];
              }
              return node.leaf?.tupleToUserset
                ? node.leaf?.tupleToUserset?.computed ?? []
                : [node.leaf?.computed];
            })
            .filter((x) => !!x);

          const rawData = [
            parentSelf,
            ...(sets?.map((x) => ({
              parent,
              child: x.userset,
              continue: true,
              relation: '',
              level,
              seq: 0,
            })) ?? []),
            ...users.map((user) => ({
              parent,
              child: user,
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
                let [object, r] = child.split('#') ?? [];
                if (!r) {
                  r = relation;
                }
                return this.expand({ tuple_key: { object, relation: r } }).pipe(
                  mapToUserSets(level)
                );
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
      ...nodes.map((x, idx) => ({
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
      (acc, value) => {
        if (value.user == acc.current)
          return {
            current: value.object ?? value.user,
            path: [...acc.path, value],
          };

        return acc;
      },
      {
        current: user,
        path: [] as NodeInfo[],
      }
    ).path;
    let color = 'green';
    let userStep = 0;
    if (path.length === 1) {
      // if there is no correct path found.
      path = data;
      color = '';
      userStep = 1;
    } else {
      path = path.toReversed().map((x, idx) => ({ ...x, level: idx, seq: 0 }));
    }
    // add nodes and edge
    path.forEach((item) => {
      if (!graph.hasNode(item.user) && !!item.user) {
        const level = (item.level ?? 0) + userStep;
        graph.addNode(item.user, setAttribute(item.user, color));
      }

      if (!graph.hasNode(item.object) && !!item.object) {
        const level = item.level ?? 0;
        graph.addNode(item.object, setAttribute(item.object, color));
      }
      if (
        !graph.hasEdge(item.user, item.object) &&
        !!item.user &&
        !!item.object
      ) {
        graph.addEdge(item.user, item.object, createEdge(item.relation, color));
      }
    });
    let i = 0;
    graph.nodes().forEach((node) => {
      graph.setNodeAttribute(node, 'x', i++);
      graph.setNodeAttribute(node, 'y', i);
    });

    forceAtlas2.assign(graph, {
      iterations: 1000,
    });
    this.graph.set(graph);
  }
}
