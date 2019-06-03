'use strict';

const EventEmitter = require('events');

class DeviceMessage extends EventEmitter {
  /**
   *
   * @param {String} id   Indentifier of the message
   * @param {String} type Type of message
   * @param {String} key  Key of what are you asking about
   * @param {Date}   timestamp Creation time
   *
   */

  constructor(message) {
    super();

    if(message){
      this.id   = undefined;
      this.type = message.type;
      this.key  = message.key;
      this.timestamp = new Date();
    }
  }
}

module.exports = DeviceMessage;
