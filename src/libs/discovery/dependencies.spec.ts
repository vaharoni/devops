
import { describe, it, expect } from 'vitest';
import { WorkspaceDependencies } from './dependencies';

describe('createDependencyResolver', () => {
  const projects = {
    '@local/a': { language: "node" as const, rootPath: 'applications/a', name: '@local/a', dependencyNames: ['@local/b', '@local/d', 'external1'] },
    '@local/b': { language: "node" as const, rootPath: 'applications/b', name: '@local/b', dependencyNames: ['@local/c', 'external2'] },
    '@local/c': { language: "node" as const, rootPath: 'applications/c', name: '@local/c', dependencyNames: [ 'external3' ] },
    '@local/d': { language: "node" as const, rootPath: 'applications/d', name: '@local/d', dependencyNames: [] },
    '@local/e': { language: "node" as const, rootPath: 'applications/e', name: '@local/e', dependencyNames: ['@local/f'] },
    '@local/f': { language: "node" as const, rootPath: 'applications/f', name: '@local/f', dependencyNames: ['@local/e'] } 
  };

  it('should return dependents of a given project', () => {
    const resolver = new WorkspaceDependencies(() => projects);

    expect(resolver.getDependents('@local/a')).toEqual(['@local/a', '@local/b', '@local/c', '@local/d']);
    expect(resolver.getDependents('@local/b')).toEqual(['@local/b', '@local/c']);
    expect(resolver.getDependents('@local/c')).toEqual(['@local/c']);
    expect(resolver.getDependents('@local/d')).toEqual(['@local/d']);
    expect(resolver.getDependents('@local/e')).toEqual(['@local/e', '@local/f']);
    expect(resolver.getDependents('@local/f')).toEqual(['@local/f', '@local/e']);
  });
});