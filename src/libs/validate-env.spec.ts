import { describe, expect, it, vi } from 'vitest';
import {
  CombinedEnvValidator,
  DotEnvParser,
  SingleEnvValidator,
} from './validate-env';

// eslint-disable-next-line @typescript-eslint/no-unsafe-function-type
function withEnvVars(envVars: Record<string, string>, callbackFn: Function) {
  Object.entries(envVars).forEach(([key, value]) => (process.env[key] = value));
  try {
    callbackFn();
  } finally {
    Object.keys(envVars).forEach((key) => delete process.env[key]);
  }
}

describe('SingleEnvValidator', () => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  function createSubject(yamlContent: any) {
    const subject = new SingleEnvValidator('dummy-path.yaml');
    vi.spyOn(subject, '_readFile').mockReturnValue(yamlContent);
    return subject;
  }

  describe('invalid yaml files', () => {
    it('contains parsingError when not an array', () => {
      const subject = createSubject({ DUMMY1: 'optional' });
      subject.validate();
      expect(subject.parsingError).toContain(
        'env.yaml file must resolve to an array',
      );
    });

    it('contains parsingError when an object has multiple keys', () => {
      const subject = createSubject([
        { DUMMY1: 'optional', DUMMY2: 'optional' },
      ]);
      subject.validate();
      expect(subject.parsingError).toContain(
        'every object in env.yaml must have one key. Error near: DUMMY1',
      );
    });

    it('contains parsingError when an object has invalid requirement', () => {
      const subject = createSubject([{ DUMMY1: 'optttttttional' }]);
      subject.validate();
      expect(subject.parsingError).toContain('invalid value for DUMMY1');
    });
  });

  describe('valid yaml file', () => {
    const validYaml = [
      'TEST_ENV_MANDATORY',
      { TEST_ENV_OPTIONAL: 'optional' },
      { TEST_ENV_BOOLEAN1: 'boolean' },
      { TEST_ENV_BOOLEAN2: 'boolean' },
      { TEST_ENV_ENUM1: ['option1', 'option2'] },
      { TEST_ENV_ENUM2: ['option1', 'option2'] },
    ];

    const defaultValues = {
      TEST_ENV_MANDATORY: 'some_value',
      TEST_ENV_BOOLEAN1: 'true',
      TEST_ENV_BOOLEAN2: 'false',
      TEST_ENV_ENUM1: 'option1',
      TEST_ENV_ENUM2: 'option2',
    };

    function withEnvVarsHelper(
      envVars: Partial<
        Record<keyof typeof defaultValues, string> & {
          TEST_ENV_OPTIONAL: string;
        }
      >,
      // eslint-disable-next-line @typescript-eslint/no-unsafe-function-type
      callbackFn: Function,
    ) {
      envVars = { ...defaultValues, ...envVars };
      withEnvVars(envVars, callbackFn);
    }

    it('works when all env vars are provided as expected', () => {
      const subject = createSubject(validYaml);
      withEnvVarsHelper({}, () => subject.validate());
      expect(subject.parsingError).toEqual(undefined);
      expect(subject.errors).toEqual({});
    });

    it('works when an optional varilable is provided', () => {
      const subject = createSubject(validYaml);
      withEnvVarsHelper({ TEST_ENV_OPTIONAL: 'value' }, () =>
        subject.validate(),
      );
      expect(subject.parsingError).toEqual(undefined);
      expect(subject.errors).toEqual({});
    });

    it('contains errors when mandatory is not provided', () => {
      const subject = createSubject(validYaml);
      withEnvVarsHelper({ TEST_ENV_MANDATORY: '' }, () => subject.validate());
      expect(subject.parsingError).toEqual(undefined);
      expect(Object.keys(subject.errors)).toEqual(['TEST_ENV_MANDATORY']);
    });

    it('contains errors when boolean is different than true or false', () => {
      const subject = createSubject(validYaml);
      withEnvVarsHelper({ TEST_ENV_BOOLEAN1: 'value' }, () =>
        subject.validate(),
      );
      expect(subject.parsingError).toEqual(undefined);
      expect(Object.keys(subject.errors)).toEqual(['TEST_ENV_BOOLEAN1']);
    });

    it('contains errors when enum is different than provided options', () => {
      const subject = createSubject(validYaml);
      withEnvVarsHelper({ TEST_ENV_ENUM1: 'option3' }, () =>
        subject.validate(),
      );
      expect(subject.parsingError).toEqual(undefined);
      expect(Object.keys(subject.errors)).toEqual(['TEST_ENV_ENUM1']);
    });
  });
});

describe('DotEnvParser', () => {
  function createSubject(text: string) {
    const subject = new DotEnvParser('dummy-path.env');
    vi.spyOn(subject, '_readFile').mockReturnValue(text);
    return subject;
  }

  it('works, taking into account comments and ignoring empty lines', () => {
    const subject = createSubject(`
        
    # Ignored
    TEST1=hello

    TEST2=world   # also ignored


    TEST3 = spaces should not normally be allowed in .env   # so the parser is not strict

    `);
    subject.parse();
    expect(subject.keys).toEqual(['TEST1', 'TEST2', 'TEST3']);
  });
});

describe('CombinedEnvValidator', () => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  function createSubject(yamlContent: any[], dotEnvContent: string[]) {
    const yamlPaths = yamlContent.map((_, i) => `dummy-yaml-${i}`);
    const dotEnvPaths = dotEnvContent.map((_, i) => `dummy-dotenv-${i}`);

    const yamlValidators = yamlContent.map((content, i) => {
      const validator = new SingleEnvValidator(yamlPaths[i]);
      vi.spyOn(validator, '_readFile').mockReturnValue(content);
      return validator;
    });

    const dotEnvParsers = dotEnvContent.map((content, i) => {
      const parser = new DotEnvParser(dotEnvPaths[i]);
      vi.spyOn(parser, '_readFile').mockReturnValue(content);
      return parser;
    });

    const subject = new CombinedEnvValidator(yamlPaths, dotEnvPaths);
    vi.spyOn(subject, '_loadYamlFiles').mockImplementation(
      () => (subject.yamlValidators = yamlValidators),
    );
    vi.spyOn(subject, '_loadDotEnvFiles').mockImplementation(
      () => (subject.dotEnvParsers = dotEnvParsers),
    );
    return subject;
  }

  it('works when no errors and no warnings', () => {
    const yaml1 = ['TEST_ENV1', 'TEST_ENV2'];
    const yaml2 = [{ TEST_ENV3: 'optional' }];
    const dotEnv1 = 'TEST_ENV1=hi';
    const dotEnv2 = 'TEST_ENV2=bye';

    const subject = createSubject([yaml1, yaml2], [dotEnv1, dotEnv2]);
    withEnvVars({ TEST_ENV1: 'hi', TEST_ENV2: 'bye' }, () =>
      subject.validate(),
    );

    expect(subject.warnings).toEqual([]);
    expect(subject.errors).toEqual({});
  });

  it('emits warnings', () => {
    const yaml1 = ['TEST_ENV1', 'TEST_ENV2'];
    const yaml2 = [{ TEST_ENV3: 'optional' }];
    const dotEnv1 = 'TEST_ENV1=hi';
    const dotEnv2 = 'TEST_ENV2=bye';
    const dotEnv3 = 'TEST_ENV4=boo';

    const subject = createSubject([yaml1, yaml2], [dotEnv1, dotEnv2, dotEnv3]);
    withEnvVars({ TEST_ENV1: 'hi', TEST_ENV2: 'bye' }, () =>
      subject.validate(),
    );

    expect(subject.warnings.length).toEqual(1);
    expect(subject.warnings[0]).toContain('TEST_ENV4');
    expect(subject.errors).toEqual({});
  });

  it('emits errors', () => {
    vi.spyOn(process, 'exit').mockReturnValue(undefined as never);
    const yaml1 = ['TEST_ENV1', 'TEST_ENV2'];
    const yaml2 = [{ TEST_ENV3: 'optional' }];
    const dotEnv1 = 'TEST_ENV1=hi';

    const subject = createSubject([yaml1, yaml2], [dotEnv1]);
    withEnvVars({ TEST_ENV1: 'hi' }, () => subject.validate());
    expect(process.exit).toHaveBeenCalledWith(1);

    expect(subject.warnings).toEqual([]);
    expect(Object.keys(subject.errors)).toEqual(['TEST_ENV2']);
  });
});
