'use strict';

const EventEmitter  = require('events');
const DeviceMessage = require('./message.js');

const CLOSED_REASON = {
  1000: 'CLOSED',
  1006: 'KILLED'
};

const ERROR_CODES = {
  1: 'ERROR',
  2: 'NOT SUPPORTED',
  3: 'NOT SELECTED',
  4: 'NOT AVAILABLE'
}

class DeviceConnection extends EventEmitter {
  /**
   *
   * @param {Integer}   id		      Connection Id
   * @param {Integer}   device      Device
   * @param {Object}    _socket     Connection websocket
   * @param {String}    ip_address  Connection IP address
   * @param {Object}    _messages   Current connection's messages
   * @param {Integer}     _messages.counter   New message id
   * @param {Integer}     _messages.timeout   Response timeout for messages
   * @param {Integer}     _messages.limit     Max size for messages list
   * @param {Integer}   timeout          Connection timeout
   * @param {Object}    _timeout_handler Timeout handler
   * @param {Integer}   _last_id    Last message's id
   *
   */

  constructor(id, deviceId, ip_address, socket, options){
    super();

    var self = this;

    self.id = id;
    self.device = deviceId;
    self._socket = socket;
    self.ip_address = ip_address;
    self._messages = { counter: 0, timeout: options.messages.timeout, limit: options.messages.queue_limit };
    self.timeout = options.timeout;
    self._timeout_handler = setTimeout(function(){
        self.emit('timeout');
        self.kill();
    }, options.timeout);
    self._last_id = undefined;

    // Handle error
    self._socket.on('error', function(err){
      self.emit('error', err);
    });

    // Handle close
    self._socket.on('close', function(code, reason){
      // Remove timeout
      clearTimeout(self._timeout_handler);

      // Send response to pending requests
      for(var id in self._messages){
        var message = self._messages[id];
        if(message && message.id != null){
          clearTimeout(message.timeout);
          message.emit('response', {error: 'Connection closed'});
        }
      }

      // Emit close event
      self.emit('close', reason || (CLOSED_REASON[code] || 'UNKNOWN'));
    });

    // Handle ping
    self._socket.on('ping', function(){
      self._timeout_handler.refresh();
      self.emit('ping');
    });

    // Handle message
    self._socket.on('message', function(message){
      // Reset timeout on every message
      self._timeout_handler.refresh();

      // Retrieve message
      try {
        // Parse message
        try {
          message = JSON.parse(message);
        } catch(e) {
          self.emit('error', 'Bad JSON input (%s)', message);
          return;
        }

        // Discriminate between types of messages
        // Ack
        if(message.type === 'ack'){
          if(message.id != null){
              self._messages[message.id].emit('ack');
          }

        // Goodbye
        } else if(message.type === 'goodbye'){
          self.emit('goodbye');

        // Incoming message
        } else if(message.id != null){

          // Send response
          self._socket.send(JSON.stringify({ type: 'ack', id: message.id }));

          // Check if message is duplicated
          if(message.id == self._last_id)
            return;
          // Update last id
          self._last_id = message.id;

          // Check if its a response
          if(message.code != null){

            // Find corresponding request
            // Get type compatible requests
            var requests = Object.values(self._messages).filter(function(msg){
              return msg.type == message.type && msg.key == message.key;
            });

            // Order by timestamp asc
            requests.sort(function(a, b){
              return a.timestamp < b.timestamp ? -1 : b.timestamp < a.timestamp ? 1 : 0;
            });

            // Send response
            if(requests[0]){
              // Translate error code if needed
              if(message.code != 0){
                message.error = ERROR_CODES[message.code] ? ERROR_CODES[message.code] : 'UNKNOWN';
              }

              // Clear response
              delete message.id;
              delete message.code;

              // Emit response
              requests[0].emit('response', message);

              // Remove it from _messages queue
              delete self._messages[requests[0].id];
            }

          } else {
            // Pipe message
            self.emit('message', message);
            self.emit(message.type, message);
          }

        } else {
          self.emit('error', 'Wrong message format');

        }
      } catch(e) {
        self.emit('error', e);
      }
    });
  }

  send(message, callback){
    if(typeof(callback) != 'function'){
      return;
    }

    var self = this;
    message = new DeviceMessage(message);

    message.id = self._messages.counter;

    if(!self._messages[message.id]){
      self._messages[message.id] = message;
      self._messages.counter = (self._messages.counter + 1) % self._messages.limit;

      try {
        var outgoing_json = JSON.stringify({ id: message.id, type: message.type, key: message.key });
        self._socket.send(outgoing_json);

        //  Get response
        var enable_ack = true;
        var enable_response = true;
        var ack_timeout = setTimeout(function(){
          enable_ack = false;
          delete self._messages[message.id];

          // Pipe error
          callback('Ack timeout');
        }, self._messages.timeout);

        // Get Ack first
        message.once('ack', function(response){
          if(enable_ack){
            clearTimeout(ack_timeout);

            var res_timeout = setTimeout(function(){
              enable_response = false;
              delete self._messages[message.id];

              // Pipe error
              callback('Response timeout');
            }, self._messages.timeout);

            // Get Response
            message.once('response', function(response){
              if(enable_response){
                if(response.error){
                  callback(err);
                } else {
                  clearTimeout(res_timeout);

                  callback(null, response);
                }
              }
            });
          }
        });
      } catch(e) {
        callback(e);
      }
    } else {
      callback('Messages queue is full');
    }
  }

  close(){
    this._socket.close(1000, 'CLOSED');
  }

  kill(){
    this._socket.terminate();
  }
}

module.exports = DeviceConnection;
