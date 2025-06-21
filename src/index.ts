/**
 * Main entry point for the Project Analysis MCP Server
 */

import { getLogger, setLogLevel, LogLevel } from '@/utils/logger.js';
import { createMCPServer } from '@/mcp/server.js';

async function main(): Promise<void> {
  // Set log level from environment variable
  const logLevel = process.env.LOG_LEVEL?.toUpperCase();
  switch (logLevel) {
    case 'ERROR':
      setLogLevel(LogLevel.ERROR);
      break;
    case 'WARN':
      setLogLevel(LogLevel.WARN);
      break;
    case 'INFO':
      setLogLevel(LogLevel.INFO);
      break;
    case 'DEBUG':
      setLogLevel(LogLevel.DEBUG);
      break;
    case 'TRACE':
      setLogLevel(LogLevel.TRACE);
      break;
    default:
      setLogLevel(LogLevel.INFO);
  }

  const logger = getLogger('main');
  
  try {
    logger.info('Initializing Project Analysis MCP Server');

    // Create and start the MCP server
    const server = createMCPServer();
    
    // Handle graceful shutdown
    const shutdown = async (signal: string) => {
      logger.info(`Received ${signal}, shutting down gracefully`);
      try {
        await server.stop();
        process.exit(0);
      } catch (error) {
        logger.error('Error during shutdown', error as Error);
        process.exit(1);
      }
    };

    process.on('SIGINT', () => shutdown('SIGINT'));
    process.on('SIGTERM', () => shutdown('SIGTERM'));

    // Handle uncaught exceptions
    process.on('uncaughtException', (error) => {
      logger.error('Uncaught exception', error);
      process.exit(1);
    });

    process.on('unhandledRejection', (reason, promise) => {
      logger.error('Unhandled rejection', new Error(String(reason)), {
        promise: promise.toString()
      });
      process.exit(1);
    });

    // Start the server
    await server.start();
    
    logger.info('Project Analysis MCP Server is running');
  } catch (error) {
    logger.error('Failed to start server', error as Error);
    process.exit(1);
  }
}

// Only run if this file is being executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((error) => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
}