/**
 * Tree-sitter type definitions
 */

declare module 'tree-sitter-typescript' {
  import Parser from 'tree-sitter';
  
  export const typescript: Parser.Language;
  export const tsx: Parser.Language;
}

declare module 'tree-sitter-javascript' {
  import Parser from 'tree-sitter';
  
  const JavaScript: Parser.Language;
  export = JavaScript;
}

declare module 'tree-sitter-python' {
  import Parser from 'tree-sitter';
  
  const Python: Parser.Language;
  export = Python;
}

declare module 'tree-sitter-java' {
  import Parser from 'tree-sitter';
  
  const Java: Parser.Language;
  export = Java;
}