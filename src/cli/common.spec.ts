import { describe, expect, it } from 'vitest';
import { CLICommandParser } from './common';

describe('CLICommandParser', () => {
  // Extra white space intentional
  const subject = new CLICommandParser(
    'run tmp/test.sh --env production --in workspace    --flag arg'.split(' '),
  );

  it('constructor: builds object correctly', () => {
    expect(subject.command).toEqual('run');
    expect(subject.env).toEqual('production');
    expect(subject.args).toEqual([
      'tmp/test.sh',
      '--in',
      'workspace',
      '--flag',
      'arg',
    ]);
  });

  describe('parseOptions', () => {
    it('detects params and booleans', () => {
      const res = subject.parseOptions({
        params: ['--in'],
        booleans: ['--flag'],
      });
      expect(res.args).toEqual(['tmp/test.sh', 'arg']);
      expect(res.argsStr).toEqual('tmp/test.sh arg');
      expect(res.options).toEqual({ '--in': 'workspace', '--flag': true });
    });

    it('leaves intact params that are not in the list', () => {
      const res = subject.parseOptions();
      expect(res.args).toEqual([
        'tmp/test.sh',
        '--in',
        'workspace',
        '--flag',
        'arg',
      ]);
      expect(res.argsStr).toEqual('tmp/test.sh --in workspace --flag arg');
      expect(res.options).toEqual({});
    });

    it('handles passthrough args when they exist', () => {
      const altSubject = new CLICommandParser(
        'run tmp/test.sh --env production --in workspace --flag arg -- p1 p2'.split(
          ' ',
        ),
      );
      const res = altSubject.parseOptions({
        params: ['--in'],
        booleans: ['--flag'],
        passthroughArgs: true,
      });
      expect(res.args).toEqual(['tmp/test.sh', 'arg']);
      expect(res.argsStr).toEqual('tmp/test.sh arg');
      expect(res.options).toEqual({ '--in': 'workspace', '--flag': true });
      expect(res.passthrough).toEqual(['p1', 'p2']);
    });

    it('handles passthrough args when they do not exist', () => {
      const altSubject = new CLICommandParser(
        'run tmp/test.sh --env production --in workspace --flag arg'.split(' '),
      );
      const res = altSubject.parseOptions({
        params: ['--in'],
        booleans: ['--flag'],
        passthroughArgs: true,
      });
      expect(res.args).toEqual(['tmp/test.sh', 'arg']);
      expect(res.argsStr).toEqual('tmp/test.sh arg');
      expect(res.options).toEqual({ '--in': 'workspace', '--flag': true });
      expect(res.passthrough).toEqual([]);
    });
  });
});
