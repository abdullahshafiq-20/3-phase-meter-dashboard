import mqtt from 'mqtt';
import { config } from './index.js';
import { logger } from '../common/logger.js';

let client = null;

const topicHandlers = new Map();

export const hivemqClient = {
  /**
   * Connect to HiveMQ broker. Resolves once the connection is established.
   */
  connect() {
    return new Promise((resolve, reject) => {
      const { host, port, username, password } = config.hivemq;
      const url = `mqtts://${host}:${port}`;

      client = mqtt.connect(url, {
        username,
        password,
        protocol: 'mqtts',
        protocolVersion: 5,
        reconnectPeriod: 5000,
        connectTimeout: 10000,
        rejectUnauthorized: true,
      });

      client.on('connect', () => {
        logger.info(`HiveMQ connected to ${host}:${port}`);
        resolve(client);
      });

      client.on('reconnect', () => {
        logger.warn('HiveMQ reconnecting ...');
      });

      client.on('error', (err) => {
        logger.error(`HiveMQ error: ${err.message}`);
        reject(err);
      });

      client.on('message', (topic, message) => {
        try {
          const payload = JSON.parse(message.toString());

          for (const [pattern, handler] of topicHandlers) {
            if (topicMatches(pattern, topic)) {
              handler(topic, payload);
            }
          }
        } catch (err) {
          logger.error(`HiveMQ message parse error on ${topic}: ${err.message}`);
        }
      });
    });
  },

  /**
   * Subscribe to a topic pattern and register a callback.
   * @param {string} topicPattern  MQTT topic (supports + and # wildcards)
   * @param {(topic: string, payload: any) => void} handler
   */
  subscribe(topicPattern, handler) {
    if (!client) throw new Error('HiveMQ client not connected');
    topicHandlers.set(topicPattern, handler);
    client.subscribe(topicPattern, { qos: 1 }, (err) => {
      if (err) {
        logger.error(`HiveMQ subscribe error for ${topicPattern}: ${err.message}`);
      } else {
        logger.info(`HiveMQ subscribed to ${topicPattern}`);
      }
    });
  },

  /**
   * Publish a message to a topic.
   */
  publish(topic, payload, options = {}) {
    if (!client) throw new Error('HiveMQ client not connected');
    const message = typeof payload === 'string' ? payload : JSON.stringify(payload);
    client.publish(topic, message, { qos: 1, ...options });
  },

  getClient() {
    return client;
  },

  disconnect() {
    if (client) {
      client.end();
      client = null;
      logger.info('HiveMQ disconnected');
    }
  },
};

function topicMatches(pattern, topic) {
  const patternParts = pattern.split('/');
  const topicParts = topic.split('/');

  for (let i = 0; i < patternParts.length; i++) {
    if (patternParts[i] === '#') return true;
    if (patternParts[i] === '+') continue;
    if (patternParts[i] !== topicParts[i]) return false;
  }

  return patternParts.length === topicParts.length;
}
