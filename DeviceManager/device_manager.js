'use strict';

// Libs
//  Public
const WebSocket = require('ws');
const EventEmitter = require('events');
//  Custom
const auth = require('./auth/devices.js');
const DeviceConnection = require('./device_connection.js');

class DeviceManager extends EventEmitter {
  /**
   *
   * @param {Object}  options Options for server creation
   * @param {Integer}   options.port    Port to listen
   * @param {String}    options.path    Path to listen
   * @param {Object}    options.handshake Options for connection hanshake
   * @param {Integer}     options.handshae.timeout Timeout to reach a successfull handshake
   * @param {String}      options.hanshake.algorithm   Algorithm for hmac
   * @param {Integer}     options.hanshake.nonce_size  Size for nonce
   * @param {Object}    options.connections Options for new connections
   * @param {Integer}     options.connections.timeout     Timeout for devices connections
   * @param {Object}      options.connections.messages    Options for connections messages
   * @param {Integer}       options.connections.messages.timeout      Timeout for messages response
   * @param {Integer}       options.connections.messages.queue_limit  Ammount of pending messages
   *
   * @param {Object}  connections Object to store devices connections
   * @param {Integer}   connections.counter
   *
   */

  constructor(options) {
    super();

    var self = this;

    self.options = {
      port:    options.port,
      path:    options.path,
      handshake: {
        timeout:    options.handshake.timeout,
        algorithm:  options.handshake.algorithm,
        nonce_size: options.handshake.nonce_size
      },
      connections: {
        timeout: options.connections.timeout,
        messages: {
          timeout:     options.connections.messages.timeout,
          queue_limit: options.connections.messages.queue_limit
        }
      }
    };

    self.connections = { counter: 0 };

    const wss_options = {
       port: self.options.port,
       path: self.options.path
    };

    const WebSocketServer = new WebSocket.Server(wss_options);

    WebSocketServer.on('error', function(err){
      self.emit(err);
    });

    WebSocketServer.on('connection', function(ws, req){
      // Handshake
      //  Remove Listeners first
      ws.removeAllListeners('message');

      //  Process Handshake
      auth.challenge_method(ws, self.options.handshake, function(err, deviceId){
        if(err){
          console.error(err);
          ws.terminate();

        } else {
          // Handshake OK
          // Connection general info
          const id       = self.connections.counter;
          var ip_address = req.headers['x-forwarded-for'] || req.connection.remoteAddress;
          ip_address = ip_address.split(':');
          if(1 < ip_address.length){
            ip_address = ip_address[3];
          } else {
            ip_address = ip_address[0];
          }

          // Delete old device connection if exists
          if(self.connections[deviceId]){
            for(var ev of self.connections[deviceId].eventNames()){
              self.connections[deviceId].removeAllListeners(ev);
            }

            self.connections[deviceId].kill();
          }

          // Add connection to connections list
          var connection = new DeviceConnection(id, deviceId, ip_address, ws, self.options.connections);
          self.connections[deviceId] = connection;
          self.connections.counter++;

          // Pipe event
          self.emit('connection', connection);

          // Listen connection events
          //  Remove from list on close
          connection.on('close', function(reason){
            delete self.connections[deviceId];
          });
        }
      });
    });
  }
}

module.exports = DeviceManager;
