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
      //  Remove Listeners first
      ws.removeAllListeners('message');

      //  Process Handshake
      challenge_method(ws, self.options.find_device, function(err, device){
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
          if(self.connections[device]){
            for(var ev of self.connections[device].eventNames()){
              self.connections[device].removeAllListeners(ev);
            }

            self.connections[device].kill();
          }

          // Add connection to connections list
          var connection = new DeviceConnection(id, device, ip_address, ws, self.options.connections);
          self.connections[device] = connection;
          self.connections.counter++;

          // Pipe event
          self.emit('connection', connection);

          // Listen connection events
          //  Remove from list on close
          connection.on('close', function(reason){
            delete self.connections[device];
          });
        }
      });
    });
  }
}

function challenge_method(ws, find_device, callback){
  if(typeof(callback) != 'function'){
    return;
  }

  var device = undefined;
  var nonce  = undefined;

  var timeout = setTimeout(function(){
    ws.removeAllListeners('message');
    callback('Handshake timeout');
  }, HS_TIMEOUT);

  // Get first message
  ws.on('message', function(message){

    // Parse message
    try {
      message = JSON.parse(message);
    } catch(e) {
      clearTimeout(timeout);
      callback('JSON parse error ('+message+')');
    }

    // Check format
    if(message && message.type === 'hello' && message.public_key != null){

      // Check sequence
      if(nonce == null && device == null){

        // Find device by public_key
        find_device(message.public_key, function(err, res){
          if(err || res == null){
            clearTimeout(timeout);
            callback(err || 'Unkown');
          } else {
            // Build nonce
            device = res;
            nonce = crypto.randomBytes(HS_NONCE_SIZE).toString('base64');

            // Send challenge
            ws.send(JSON.stringify({ type: 'challenge', nonce: nonce }));
          }
        });
      } else {
        clearTimeout(timeout);
        callback('Bad sequence ('+ JSON.stringify(message) +')');
      }
    } // Check format
      else if(message && message.type === 'authenticate'){

        // Check sequence
        if(device != null && nonce != null){

          // Create signature
          var hmac = crypto.createHmac(HS_ALGORITHM, device.private_key);
          hmac.update(nonce);
          const expected_signature = hmac.digest('base64');

          if(message.sign == expected_signature){
            // Clear Listeners and timeout
            clearTimeout(timeout);
            ws.removeAllListeners('message');

            // Send welcome and callback
            ws.send(JSON.stringify({ type: "welcome" }));
            callback(null, device.id);

          } else {
            clearTimeout(timeout);
            callback('Bad signature ('+ JSON.stringify(message) +')');
          }

      } else {
        clearTimeout(timeout);
        callback('Bad sequence ('+ JSON.stringify(message) +')');
      }
    } else {
      clearTimeout(timeout);
      callback('Bad format ('+ JSON.stringify(message) +')');
    }
  });
}

module.exports = DeviceManager;
