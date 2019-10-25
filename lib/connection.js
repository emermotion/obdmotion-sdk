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
   * @param {Integer}   device      Device
   * @param {Object}    _socket     Connection websocket
   * @param {Object}    _messages   Current connection's messages
   * @param {Integer}     _messages.counter   New message id
   * @param {Integer}     _messages.timeout   Response timeout for messages
   * @param {Integer}     _messages.limit     Max size for messages list
   * @param {Object}      _messages.list      List to store messages
   * @param {Integer}   timeout          Connection timeout
   * @param {Object}    _timeout_handler Timeout handler
   * @param {Integer}   _last_id    Last message's id
   *
   */

  constructor(device, socket, options){
    super();

    var self = this;

    self.device = device;
    self.socket = socket;
    self._messages = { counter: 0, timeout: options.messages.timeout, limit: options.messages.queue_limit };
    self.timeout = options.timeout;
    self._timeout_handler = setTimeout(function(){
      self.emit('timeout');
      self.kill();
    }, options.timeout);
    self._last_id = undefined;

    // Handle error
    socket.on('error', function(err){
      self.emit('error', err);
    });

    // Handle close
    socket.on('close', function(code, reason){
      clearTimeout(self._timeout_handler);
      // Send response to pending requests
      for(var id in self._messages.list){
        self._messages.list[id].emit('response', 'Connection closed');
      }

      self.emit('close', reason || (CLOSED_REASON[code] || 'UNKNOWN'));
    });

    // Handle ping
    socket.on('ping', function(){
      self._timeout_handler.refresh();
    });

    // Handle message
    socket.on('message', function(message){
      // Reset timeout on every message
      self._timeout_handler.refresh();

      // Parse message
      try {
        message = JSON.parse(message);
      } catch(e) {
        self.emit('error', 'Bad JSON input (%s)', message);
        return;
      }

      // Discriminate between types of messages
      // Ack
      if(message.type === 'ack' && message.id != null && self._messages.list[message.id]){
        self._messages.list[message.id].emit('ack');

        // Goodbye
      } else if(message.type === 'goodbye'){
        self.emit('goodbye');

        // Incoming message
      } else if(message.id != null && message.type != null){

        // Send response
        try {
          self._socket.send(JSON.stringify({ type: 'ack', id: message.id }));
        } catch(err) {
          self.emit('error', err);
        }

        // Check if message is duplicated
        if(message.id == self._last_id){
          return;
        }
        self._last_id = message.id;

        // Check if its a response
        if(message.code != null){
          // Find corresponding request
          //   Get type compatible requests
          var requests = Object.values(self._messages.list).filter(function(msg){
            return msg.type == message.type && msg.key == message.key;
          });

          //   Order by timestamp asc
          requests.sort(function(a, b){
            return a.timestamp < b.timestamp ? -1 : b.timestamp < a.timestamp ? 1 : 0;
          });

          // Send response
          if(requests[0]){
            // Translate error code if needed
            if(message.code != 0){
              requests[0].emit('response', ERROR_CODES[message.code] ? ERROR_CODES[message.code] : 'UNKNOWN');
            } else {
              // Clear response
              delete message.id;
              delete message.code;

              // Emit response
              requests[0].emit('response', null, message);

              // Remove it from _messages queue
              delete self._messages.list[requests[0].id];
            }
          }
        } else {
          // Pipe message
          self.emit('message', message);
          self.emit(message.type, message);
        }
      } else {
        self.emit('error', 'Wrong message format');
      }
    });
  }

  send(message, callback){
    var self = this;

    if(self._messages.list[self._messages.counter]){
      calback('Messages queue is full');
      return;
    }

    message = new DeviceMessage(message);
    message.id = self._messages.counter;

    try {
      self._socket.send(JSON.stringify({ id: message.id, type: message.type, key: message.key }));
    } catch(err) {
      callback(err);
      return;
    }

    self._messages.list[message.id] = message;
    self._messages.counter = (self._messages.counter + 1) % self._messages.limit;

    // Timeout
    var timeout = setTimeout(function(){
      message.removeAllListeners();
      delete self._messages[message.id];

      // Pipe error
      callback('Timeout');
    }, self._messages.timeout);

    // Get Ack first
    message.once('ack', function(){
      timeout.refresh();

      message.once('response', function(err, response){
        clearTimeout(timeout);
        callback(err, response);
      });
    });
  }

  close(){
    this._socket.close(1000, 'CLOSED');
  }

  kill(){
    this._socket.terminate();
  }
}

module.exports = DeviceConnection;
