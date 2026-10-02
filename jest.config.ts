import type { Config } from 'jest';

const config: Config = {
  moduleFileExtensions: ['js', 'json', 'ts'],
  rootDir: '.',
  testRegex: '.*\\.spec\\.ts$',
  transform: {
    '^.+\\.ts$': [
      'ts-jest',
      {
        tsconfig: {
          module: 'commonjs',
          moduleResolution: 'node16',
          resolvePackageJsonExports: false,
          target: 'ES2021',
          isolatedModules: true,
          esModuleInterop: true,
        },
      },
    ],
  },
  // With --experimental-vm-modules, Jest 30 handles ESM packages natively
  // via vm.SourceTextModule (supportsSyncEvaluate). No need to transform
  // node_modules — only our .ts source files get compiled to CJS by ts-jest.
  collectCoverageFrom: [
    'src/**/*.ts',
  ],
  coverageDirectory: './coverage',
  testEnvironment: 'node',
};

export default config;