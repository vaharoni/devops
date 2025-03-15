import { describe, it, expect } from 'vitest';
import { WorkspaceDependencies } from './dependencies';

describe('createDependencyResolver', () => {
  const projects = {
    '@local/a': { rootPath: 'applications/a', data: { name: '@local/a', dependencies: { '@local/b': 'workspace:*', '@local/d': 'workspace:*', external1: "^1.0.0" } } },
    '@local/b': { rootPath: 'applications/b', data: { name: '@local/b', dependencies: { '@local/c': 'workspace:*', external2: "^1.0.0" } } },
    '@local/c': { rootPath: 'applications/c', data: { name: '@local/c', dependencies: { external3: "^1.0.0" } } },
    '@local/d': { rootPath: 'applications/d', data: { name: '@local/d' } },
    '@local/e': { rootPath: 'applications/e', data: { name: '@local/e', dependencies: { '@local/f': 'workspace:*' } } },
    '@local/f': { rootPath: 'applications/e', data: { name: '@local/e', dependencies: { '@local/e': 'workspace:*' } } },
  };

  it('should return dependents of a given project', () => {
    const resolver = new WorkspaceDependencies(() => projects);

    expect(resolver.getDependents('@local/a')).toEqual(['@local/b', '@local/c', '@local/d']);
    expect(resolver.getDependents('@local/b')).toEqual(['@local/c']);
    expect(resolver.getDependents('@local/c')).toEqual([]);
    expect(resolver.getDependents('@local/d')).toEqual([]);
    expect(resolver.getDependents('@local/e')).toEqual(['@local/f']);
    expect(resolver.getDependents('@local/f')).toEqual(['@local/e']);
  });
});