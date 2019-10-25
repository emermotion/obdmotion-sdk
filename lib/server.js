'use strict';

// Libs
//  Public
const WebSocket = require('ws');
const EventEmitter = require('events');
const crypto = require('crypto');

//  Custom
const DeviceConnection = require('./connection.js');

// Defines
const HS_ALGORITHM  = 'sha1';
const HS_TIMEOUT    = 90000;
const HS_NONCE_SIZE = 24;

class DeviceManager extends EventEmitter {
  /**
   *
   * @param {Object}  options Options for server creation
   * @param {Integer}   options.port    Port to listen
   * @param {String}    options.path    Path to listen
   * @param {Function}  options.find_device Search the device by public_key in the persistence unit
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
      find_device: options.find_device,
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
      challenge_method(ws, self.options.find_device, function(err, device){
        if(err){
          ws.terminate();
          self.emit('error', err);

        } else {
          // Kill old connection if needed
          if(self.connections[device]){
            self.connections[device].removeAllListeners();
            self.connections[device].kill();
          }

          // Add connection to connections list
          var connection = new DeviceConnection(device, ws, self.options.connections);
          self.connections[device] = connection;

          // Pipe event
          self.emit('connection', connection);

          // Remove from list on close
          connection.on('close', function(reason){
            delete self.connections[device];
          });
        }
      });
    });
  }
}

function challenge_method(ws, find_device, callback){
  var device = null;
  var expected_signature = null;

  var timeout = setTimeout(function(){
    ws.removeAllListeners();
    callback('Handshake timeout');
  }, HS_TIMEOUT);

  ws.on('error', function(err){
    ws.removeAllListeners();
    clearTimeout(timeout);
    callback(err);
  });

  ws.on('close', function(){
    ws.removeAllListeners();
    clearTimeout(timeout);
    callback('Connection closed during handshake');
  });

  // Get first message
  ws.on('message', function(message){
    // Parse message
    try {
      message = JSON.parse(message);
    } catch(e) {
      ws.removeAllListeners();
      clearTimeout(timeout);
      callback('JSON parse error ('+message+')');
    }

    if(message && message.type === 'hello' && message.public_key != null && !expected_signature){
      // Get device connection keys
      find_device(message.public_key, function(err, res){
        if(err || !res){
          ws.removeAllListeners();
          clearTimeout(timeout);
          callback(err || 'Unkown');

        } else {
          // Prepare signature
          device = res.id;
          const nonce = crypto.randomBytes(HS_NONCE_SIZE).toString('base64');
          var hmac = crypto.createHmac(HS_ALGORITHM, res.private_key);
          hmac.update(nonce);
          expected_signature = hmac.digest('base64');

          // Send challenge
          try {
            ws.send(JSON.stringify({ type: 'challenge', nonce: nonce }));
          } catch(err) {
            ws.removeAllListeners();
            clearTimeout(timeout);
            callback(err);
          }
        }
      });
    } else if(message && message.type === 'authenticate' && expected_signature){
      ws.removeAllListeners();
      clearTimeout(timeout);
      if(message.sign == expected_signature){
        // Clear Listeners and timeout
        clearTimeout(timeout);
        ws.removeAllListeners();

        // Send welcome and callback
        try {
          ws.send(JSON.stringify({ type: "welcome" }));
        } catch(err){
          callback(err);
          return;
        }
        callback(null, device.id);
      } else {
        callback('Bad signature ('+ JSON.stringify(message) +')');
      }
    } else {
      ws.removeAllListeners();
      clearTimeout(timeout);
      callback('Bad sequence ('+ JSON.stringify(message) +')');
    }
  });
}

module.exports = DeviceManager;
