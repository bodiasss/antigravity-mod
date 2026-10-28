'use strict';

/**
 * Tool Executor for Subagents
 * Provides real workspace file and command execution for subagents
 * across any model (Claude, DeepSeek, GPT-4o, Gemini).
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

class ToolExecutor {
  constructor(defaultWorkspace = process.cwd()) {
    this.workspace = defaultWorkspace;
  }

  resolvePath(p) {
    if (path.isAbsolute(p)) return p;
    return path.resolve(this.workspace, p);
  }

  getToolDeclarations() {
    return [
      {
        type: 'function',
        function: {
          name: 'read_file',
          description: 'Read contents of a text file with optional line range',
          parameters: {
            type: 'object',
            properties: {
              Path: { type: 'string', description: 'Absolute or relative file path' },
              StartLine: { type: 'number', description: 'Start line (1-indexed)' },
              EndLine: { type: 'number', description: 'End line (1-indexed)' }
            },
            required: ['Path']
          }
        }
      },
      {
        type: 'function',
        function: {
          name: 'write_file',
          description: 'Create or overwrite a file with given content',
          parameters: {
            type: 'object',
            properties: {
              Path: { type: 'string', description: 'Target file path' },
              Content: { type: 'string', description: 'Full text content to write' }
            },
            required: ['Path', 'Content']
          }
        }
      },
      {
        type: 'function',
        function: {
          name: 'edit_file',
          description: 'Perform an exact string replacement in a file',
          parameters: {
            type: 'object',
            properties: {
              Path: { type: 'string', description: 'Target file path' },
              Target: { type: 'string', description: 'Exact string to be replaced' },
              Replacement: { type: 'string', description: 'Replacement string' }
            },
            required: ['Path', 'Target', 'Replacement']
          }
        }
      },
      {
        type: 'function',
        function: {
          name: 'run_command',
          description: 'Execute a PowerShell command in the workspace and return output',
          parameters: {
            type: 'object',
            properties: {
              CommandLine: { type: 'string', description: 'PowerShell command string' }
            },
            required: ['CommandLine']
          }
        }
      }
    ];
  }

  async executeTool(name, args) {
    try {
      switch (name) {
        case 'read_file': {
          const filePath = this.resolvePath(args.Path);
          if (!fs.existsSync(filePath)) return `Error: File not found: ${filePath}`;
          const raw = fs.readFileSync(filePath, 'utf8');
          const lines = raw.split(/\r?\n/);
          const start = Math.max(1, args.StartLine || 1) - 1;
          const end = Math.min(lines.length, args.EndLine || lines.length);
          const sliced = lines.slice(start, end).map((l, i) => `${start + i + 1}: ${l}`).join('\n');
          return sliced || '(empty file)';
        }

        case 'write_file': {
          const filePath = this.resolvePath(args.Path);
          fs.mkdirSync(path.dirname(filePath), { recursive: true });
          fs.writeFileSync(filePath, args.Content || '', 'utf8');
          return `Successfully wrote ${args.Content ? args.Content.length : 0} bytes to ${filePath}`;
        }

        case 'edit_file': {
          const filePath = this.resolvePath(args.Path);
          if (!fs.existsSync(filePath)) return `Error: File not found: ${filePath}`;
          let content = fs.readFileSync(filePath, 'utf8');
          if (!content.includes(args.Target)) {
            return `Error: Target string not found in ${filePath}`;
          }
          content = content.replace(args.Target, args.Replacement);
          fs.writeFileSync(filePath, content, 'utf8');
          return `Successfully replaced target in ${filePath}`;
        }

        case 'run_command': {
          const cmd = args.CommandLine;
          const output = execSync(cmd, {
            cwd: this.workspace,
            encoding: 'utf8',
            timeout: 30000,
            shell: 'powershell.exe'
          });
          return output || '(command completed with no output)';
        }

        default:
          return `Error: Unknown tool: ${name}`;
      }
    } catch (err) {
      return `Execution error: ${err.message || String(err)}`;
    }
  }
}

module.exports = ToolExecutor;
