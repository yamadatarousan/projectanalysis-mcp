/**
 * Basic functionality tests
 */

describe('Project Analysis MCP Server', () => {
  test('should be able to import main modules', () => {
    expect(() => {
      require('../src/types/index.js');
      require('../src/utils/index.js');
    }).not.toThrow();
  });

  test('should have correct package.json structure', () => {
    const pkg = require('../package.json');
    expect(pkg.name).toBe('projectanalysis-mcp');
    expect(pkg.version).toBeDefined();
    expect(pkg.dependencies).toBeDefined();
    expect(pkg.scripts.build).toBe('tsc');
  });

  test('basic math operations work', () => {
    expect(2 + 2).toBe(4);
    expect(10 * 5).toBe(50);
  });
});